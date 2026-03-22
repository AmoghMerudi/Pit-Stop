from pit_window import get_pit_window
from rival_model import find_undercut_threats

CROSSOVER_PIT_THRESHOLD = 3  # pit if crossover is within this many laps


def recommend(
    driver: str,
    driver_states: dict[str, dict],
    curves: dict[str, dict],
    circuit: str | None = None,
) -> dict:
    """
    Produce a pit stop recommendation for a driver.

    Returns:
        recommend_pit (bool), reason (str), optimal_lap (int),
        crossover_lap (int), net_delta (float), undercut_threats (list[str])
    """
    if driver not in driver_states:
        raise ValueError(f"Driver {driver} not found in session data")

    state = driver_states[driver]
    window = get_pit_window(state, curves, circuit)

    undercut_threats = find_undercut_threats(driver, driver_states)

    crossover_lap = window["crossover_lap"]
    net_delta = window["net_delta"]

    pit_for_crossover = crossover_lap <= CROSSOVER_PIT_THRESHOLD
    pit_for_undercut = len(undercut_threats) > 0

    recommend_pit = pit_for_crossover or pit_for_undercut

    threat_names = ", ".join(t["driver"] for t in undercut_threats)

    if pit_for_crossover and pit_for_undercut:
        reason = (
            f"Pit now — crossover in {crossover_lap} lap(s) and undercut threat "
            f"from {threat_names}"
        )
    elif pit_for_crossover:
        reason = f"Pit now — crossover lap is {crossover_lap} lap(s) away"
    elif pit_for_undercut:
        reason = f"Pit to defend against undercut from {threat_names}"
    elif crossover_lap >= 999:
        reason = "Stay out — tyre showing minimal degradation"
    elif window["overcut_window"]:
        reason = f"Stay out — overcut opportunity in {crossover_lap - CROSSOVER_PIT_THRESHOLD} laps"
    else:
        reason = "Stay out — no pit window yet"

    optimal_lap = max(1, crossover_lap) if crossover_lap < 999 else 0

    return {
        "driver": driver,
        "recommend_pit": recommend_pit,
        "reason": reason,
        "optimal_lap": optimal_lap,
        "crossover_lap": crossover_lap,
        "net_delta": round(net_delta, 3),
        "undercut_threats": undercut_threats,
    }
