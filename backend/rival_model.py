import pandas as pd

from pit_window import get_pit_loss


UNDERCUT_GAP_FALLBACK = 3.0   # seconds — used when no circuit data available
UNDERCUT_MAX_POSITION_GAP = 2  # rival must be within this many positions behind
UNDERCUT_MIN_SCORE = 0.2       # minimum threat score to include
UNDERCUT_MAX_THREATS = 5       # cap returned threats to avoid noise


def build_driver_states(
    laps_df: pd.DataFrame,
    current_lap: int,
    race_state: pd.DataFrame | None = None,
    driver_statuses: dict[str, str] | None = None,
) -> dict[str, dict]:
    """
    Build a snapshot of every driver's current state at the given lap.
    Returns { driver: { compound, tyre_age, position, gap_to_leader, status } }

    race_state: optional DataFrame from ingestion.get_race_state() with columns
        driver, position, gap_to_leader — provides accurate position and gap
        computed from all laps (not just quicklaps).
    driver_statuses: optional dict { driver: status_str } where status is
        "", "PIT", "DNF", "DSQ", "RETIRED".
    """
    statuses = driver_statuses or {}

    # Get all unique drivers from the full laps DataFrame + statuses
    all_drivers_set = set(laps_df["driver"].unique())
    all_drivers_set.update(statuses.keys())

    # Current lap data
    lap_data = laps_df[laps_df["lap_number"] == current_lap].copy()

    # For drivers not present at current_lap, use their most recent lap
    drivers_at_lap = set(lap_data["driver"].unique())
    missing = all_drivers_set - drivers_at_lap
    if missing:
        remaining = laps_df[laps_df["driver"].isin(missing)]
        if not remaining.empty:
            fallback = remaining.sort_values("lap_number").groupby("driver").last().reset_index()
            lap_data = pd.concat([lap_data, fallback], ignore_index=True)

    # Build a lookup from race_state if provided
    rs_lookup: dict[str, dict] = {}
    if race_state is not None:
        for _, rs_row in race_state.iterrows():
            rs_lookup[rs_row["driver"]] = {
                "position": int(rs_row["position"]),
                "gap_to_leader": float(rs_row["gap_to_leader"]),
            }

    states: dict[str, dict] = {}
    for _, row in lap_data.iterrows():
        driver = row["driver"]
        if driver in rs_lookup:
            position = rs_lookup[driver]["position"]
            gap = rs_lookup[driver]["gap_to_leader"]
        else:
            position = int(row.get("position", 0))
            gap = float(row.get("gap_to_leader", 0.0))

        states[driver] = {
            "compound": row["compound"],
            "tyre_age": int(row["tyre_age"]),
            "position": position,
            "gap_to_leader": gap,
            "status": statuses.get(driver, ""),
        }

    # Add drivers from statuses that weren't found in laps data at all (e.g. DNS, early DNF)
    for driver, status in statuses.items():
        if driver not in states and status:
            states[driver] = {
                "compound": "UNKNOWN",
                "tyre_age": 0,
                "position": 0,
                "gap_to_leader": 0.0,
                "status": status,
            }

    return states


def _calc_degradation_loss(compound: str, tyre_age: int, curves: dict[str, dict]) -> float:
    """
    Calculate total accumulated degradation loss (seconds) for a tyre at a given age.
    This is slope * tyre_age — the delta from fresh-tyre pace.
    Returns 0.0 if no curve is available for the compound.
    """
    if compound not in curves:
        return 0.0
    slope = curves[compound].get("slope", 0.0)
    return max(0.0, slope * tyre_age)


def find_undercut_threats(
    driver: str,
    driver_states: dict[str, dict],
    curves: dict[str, dict] | None = None,
    circuit: str | None = None,
) -> list[dict]:
    """
    Return a list of rival details for drivers who could undercut the given driver.

    Each entry: { driver, compound, tyre_age, position, threat_score }.

    A rival is a threat when:
    - They are directly behind or within UNDERCUT_MAX_POSITION_GAP positions behind
    - The gap between rival and target is less than the pit loss for the circuit
      (otherwise the rival would emerge behind after pitting)
    - Their tyres are more degraded than the target's (degradation-aware when
      curves are available, otherwise falls back to raw tyre age comparison)
    - The computed threat_score exceeds UNDERCUT_MIN_SCORE

    Results are sorted by threat_score descending and capped at UNDERCUT_MAX_THREATS.
    """
    if driver not in driver_states:
        return []

    target = driver_states[driver]
    gap_threshold = get_pit_loss(circuit) if circuit else UNDERCUT_GAP_FALLBACK

    threats = []

    for rival, state in driver_states.items():
        if rival == driver:
            continue

        # 1. Position: rival must be behind and within UNDERCUT_MAX_POSITION_GAP
        position_gap = state["position"] - target["position"]
        if position_gap <= 0 or position_gap > UNDERCUT_MAX_POSITION_GAP:
            continue

        # 2. Gap: rival must be within pit-loss window
        rival_gap = abs(state["gap_to_leader"] - target["gap_to_leader"])
        if rival_gap >= gap_threshold:
            continue

        # 3. Tyre degradation advantage
        if curves:
            rival_deg = _calc_degradation_loss(state["compound"], state["tyre_age"], curves)
            target_deg = _calc_degradation_loss(target["compound"], target["tyre_age"], curves)
            deg_advantage = rival_deg - target_deg
        else:
            # Fallback: use raw tyre age difference as a proxy (0.1s per lap assumed)
            deg_advantage = (state["tyre_age"] - target["tyre_age"]) * 0.1

        # Rival must have SOME degradation disadvantage to want to pit
        if deg_advantage <= 0:
            continue

        # 4. Compute threat_score (0.0 to 1.0)
        # Gap closeness: 1.0 when gap=0, 0.0 when gap=gap_threshold
        gap_score = 1.0 - (rival_gap / gap_threshold)

        # Degradation incentive: capped at 1.0; a 3s+ deg advantage is maximum
        deg_score = min(1.0, deg_advantage / 3.0)

        # Position proximity: 1.0 for 1 position behind, 0.5 for 2
        pos_score = 1.0 / position_gap

        # Weighted combination
        threat_score = 0.4 * gap_score + 0.4 * deg_score + 0.2 * pos_score

        if threat_score < UNDERCUT_MIN_SCORE:
            continue

        threats.append({
            "driver": rival,
            "compound": state["compound"],
            "tyre_age": state["tyre_age"],
            "position": state["position"],
            "threat_score": round(threat_score, 3),
        })

    # Sort by threat_score descending, cap at max
    threats.sort(key=lambda t: t["threat_score"], reverse=True)
    return threats[:UNDERCUT_MAX_THREATS]


def build_live_driver_states(
    stints: list[dict],
    positions: list[dict],
    intervals: list[dict],
    driver_number_to_code: dict[int, str] | None = None,
    current_lap: int = 0,
) -> dict[str, dict]:
    """
    Assemble driver states from three OpenF1 live data feeds.

    stints: from get_live_stints() — provides compound and tyre_age
    positions: from get_live_positions() — provides race position
    intervals: from get_live_intervals() — provides gap_to_leader (already normalised to float)

    driver_number_to_code: optional int -> "VER" mapping.
        When None, driver keys are string driver numbers ("1", "11", etc.).

    Returns the same shape as build_driver_states():
    { driver_key: { compound, tyre_age, position, gap_to_leader } }

    Drivers missing from positions or intervals get position=0 and gap_to_leader=0.0.
    Stints with compound "UNKNOWN" are skipped.
    """
    # Build lookup dicts keyed on int driver_number
    pos_lookup: dict[int, int] = {
        int(r["driver_number"]): int(r.get("position", 0))
        for r in positions
        if r.get("driver_number") is not None
    }
    gap_lookup: dict[int, float] = {
        int(r["driver_number"]): float(r.get("gap_to_leader", 0.0))
        for r in intervals
        if r.get("driver_number") is not None
    }

    # Keep only the current (highest stint_number) stint per driver
    latest_stints: dict[int, dict] = {}
    for stint in stints:
        drv_num = stint.get("driver_number")
        if drv_num is None:
            continue
        drv_num = int(drv_num)
        existing = latest_stints.get(drv_num)
        if existing is None or int(stint.get("stint_number", 0)) > int(existing.get("stint_number", 0)):
            latest_stints[drv_num] = stint

    states: dict[str, dict] = {}
    for drv_num, stint in latest_stints.items():
        compound = stint.get("compound", "UNKNOWN")
        if compound == "UNKNOWN":
            continue

        tyre_age = int(stint.get("tyre_age_at_start", 0))
        if stint.get("lap_end") is not None and stint.get("lap_start") is not None:
            # Completed stint: actual laps driven = lap_end - lap_start
            tyre_age = tyre_age + int(stint["lap_end"]) - int(stint["lap_start"])
        elif stint.get("lap_start") is not None and current_lap > 0:
            # Active stint (lap_end is None): laps driven = current_lap - lap_start
            tyre_age = tyre_age + max(0, current_lap - int(stint["lap_start"]))

        driver_key = (
            driver_number_to_code.get(drv_num, str(drv_num))
            if driver_number_to_code
            else str(drv_num)
        )

        states[driver_key] = {
            "compound": compound,
            "tyre_age": tyre_age,
            "position": pos_lookup.get(drv_num, 0),
            "gap_to_leader": gap_lookup.get(drv_num, 0.0),
        }

    return states
