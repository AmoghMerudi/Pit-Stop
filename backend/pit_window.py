import logging

from constants import DEFAULT_PIT_LOSS, PIT_LANE_LOSS
from degradation import predict_delta

logger = logging.getLogger(__name__)


def get_pit_loss(circuit: str | None) -> float:
    """Return pit lane time loss for the circuit, falling back to DEFAULT_PIT_LOSS."""
    if circuit is None or circuit not in PIT_LANE_LOSS:
        if circuit is not None:
            logger.warning("No pit loss data for %s, using %.1fs fallback", circuit, DEFAULT_PIT_LOSS)
        return DEFAULT_PIT_LOSS
    return PIT_LANE_LOSS[circuit]


def calc_crossover(
    current_age: int,
    compound: str,
    pit_loss: float,
    curves: dict[str, dict],
) -> int:
    """
    Calculate the lap at which pitting becomes beneficial.
    Returns the crossover lap as an integer (relative to the current lap).
    Formula: crossover = (pit_loss - current_delta) / slope
    """
    if compound not in curves:
        raise KeyError(f"No degradation curve available for {compound}")

    slope = curves[compound]["slope"]
    current_delta = predict_delta(compound, current_age, curves)

    if slope <= 0:
        # Tyre not degrading — no crossover
        return 999

    crossover = (pit_loss - current_delta) / slope
    return max(0, int(round(crossover)))


def calc_net_delta(
    current_age: int,
    compound: str,
    pit_loss: float,
    curves: dict[str, dict],
) -> float:
    """
    Net time delta of pitting now vs. staying out one more lap.
    Positive = pitting is beneficial. Negative = staying out is better.
    """
    current_delta = predict_delta(compound, current_age, curves)
    next_delta = predict_delta(compound, current_age + 1, curves)
    degradation_cost = next_delta - current_delta
    return degradation_cost - pit_loss


def get_pit_window(
    driver_state: dict,
    curves: dict[str, dict],
    circuit: str | None = None,
) -> dict:
    """
    Given a driver's current state, return pit window information.

    driver_state must have: compound (str), tyre_age (int)
    Returns: crossover_lap (int), net_delta (float), undercut_window (bool), overcut_window (bool)
    """
    compound = driver_state["compound"]
    tyre_age = driver_state["tyre_age"]
    pit_loss = get_pit_loss(circuit)

    crossover = calc_crossover(tyre_age, compound, pit_loss, curves)
    net_delta = calc_net_delta(tyre_age, compound, pit_loss, curves)

    undercut_window = crossover <= 3
    overcut_window = crossover > 3 and crossover <= 8

    return {
        "crossover_lap": crossover,
        "net_delta": net_delta,
        "undercut_window": undercut_window,
        "overcut_window": overcut_window,
    }
