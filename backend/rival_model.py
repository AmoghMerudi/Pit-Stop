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


def find_undercut_threats(driver: str, driver_states: dict[str, dict]) -> list[str]:
    """
    Return a list of drivers who could undercut the given driver.
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
        close_enough = (state["gap_to_leader"] - target["gap_to_leader"]) < UNDERCUT_GAP_THRESHOLD

        if behind_in_position and older_tyres and close_enough:
            threats.append(rival)

    return threats


def find_overcut_opportunities(driver: str, driver_states: dict[str, dict]) -> list[str]:
    """
    Return a list of drivers the given driver could overcut (stay out longer than).
    Criteria: rival is ahead in position, rival's tyre_age > driver's by UNDERCUT_TYRE_AGE_GAP.
    """
    if driver not in driver_states:
        return []

    target = driver_states[driver]
    opportunities = []

    for rival, state in driver_states.items():
        if rival == driver:
            continue
        ahead_in_position = state["position"] < target["position"]
        older_tyres = state["tyre_age"] - target["tyre_age"] >= UNDERCUT_TYRE_AGE_GAP

        if ahead_in_position and older_tyres:
            opportunities.append(rival)

    return opportunities
