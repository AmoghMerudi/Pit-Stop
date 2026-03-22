import pandas as pd


UNDERCUT_TYRE_AGE_GAP = 5   # rival must have this many more laps on tyres
UNDERCUT_GAP_THRESHOLD = 3.0  # seconds — rival must be within this gap


def build_driver_states(laps_df: pd.DataFrame, current_lap: int) -> dict[str, dict]:
    """
    Build a snapshot of every driver's current state at the given lap.
    Returns { driver: { compound, tyre_age, position, gap_to_leader } }

    For historical mode, position is derived from lap ordering.
    For live mode, pass laps_df with position and gap_to_leader columns already joined.
    """
    lap_data = laps_df[laps_df["lap_number"] == current_lap].copy()

    if lap_data.empty:
        # Fall back to most recent lap per driver
        lap_data = laps_df.sort_values("lap_number").groupby("driver").last().reset_index()

    states: dict[str, dict] = {}
    for _, row in lap_data.iterrows():
        driver = row["driver"]
        states[driver] = {
            "compound": row["compound"],
            "tyre_age": int(row["tyre_age"]),
            "position": int(row.get("position", 0)),
            "gap_to_leader": float(row.get("gap_to_leader", 0.0)),
        }

    return states


def find_undercut_threats(driver: str, driver_states: dict[str, dict]) -> list[dict]:
    """
    Return a list of rival details for drivers who could undercut the given driver.
    Each entry: { driver, compound, tyre_age, position }.
    Criteria: rival is behind in position, tyre_age > driver's by UNDERCUT_TYRE_AGE_GAP,
    and gap < UNDERCUT_GAP_THRESHOLD seconds.
    """
    if driver not in driver_states:
        return []

    target = driver_states[driver]
    threats = []

    for rival, state in driver_states.items():
        if rival == driver:
            continue
        behind_in_position = state["position"] > target["position"]
        older_tyres = state["tyre_age"] - target["tyre_age"] >= UNDERCUT_TYRE_AGE_GAP
        close_enough = abs(state["gap_to_leader"] - target["gap_to_leader"]) < UNDERCUT_GAP_THRESHOLD

        if behind_in_position and older_tyres and close_enough:
            threats.append({
                "driver": rival,
                "compound": state["compound"],
                "tyre_age": state["tyre_age"],
                "position": state["position"],
            })

    return threats


def build_live_driver_states(
    stints: list[dict],
    positions: list[dict],
    intervals: list[dict],
    driver_number_to_code: dict[int, str] | None = None,
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

        # Conservative tyre_age: use tyre_age_at_start (lap_end is None for current stint)
        tyre_age = int(stint.get("tyre_age_at_start", 0))
        if stint.get("lap_end") is not None and stint.get("lap_start") is not None:
            tyre_age = tyre_age + int(stint["lap_end"]) - int(stint["lap_start"])

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
