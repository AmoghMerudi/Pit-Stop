import logging

from constants import DEFAULT_PIT_LOSS, PIT_LANE_LOSS
from degradation import predict_delta

logger = logging.getLogger(__name__)

LOOKAHEAD_LAPS = 20


def get_pit_loss(circuit: str | None) -> float:
    """Return pit lane time loss for the circuit, falling back to DEFAULT_PIT_LOSS."""
    if circuit is None or circuit not in PIT_LANE_LOSS:
        if circuit is not None:
            logger.warning("No pit loss data for %s, using %.1fs fallback", circuit, DEFAULT_PIT_LOSS)
        return DEFAULT_PIT_LOSS
    return PIT_LANE_LOSS[circuit]


def _find_best_alt(compound: str, curves: dict[str, dict]) -> str | None:
    """Return the best alternative compound (lowest slope) available in curves."""
    alts = [c for c in curves if c != compound]
    if not alts:
        return None
    return min(alts, key=lambda c: curves[c]["slope"])


def calc_crossover(
    current_age: int,
    compound: str,
    pit_loss: float,
    curves: dict[str, dict],
) -> tuple[int, str | None]:
    """
    Compound-aware crossover calculation.

    Compares cumulative degradation of staying on current tyres vs switching to
    each alternative compound (on fresh tyres) plus paying the pit loss.

    Returns (crossover_laps, best_alt_compound).
    crossover_laps is relative: "in N laps from now".
    Returns (999, None) if no crossover found within the lookahead window.
    """
    if compound not in curves:
        raise KeyError(f"No degradation curve available for {compound}")

    alts = [c for c in curves if c != compound]
    if not alts:
        # Only one compound available — fall back to single-compound logic
        slope = curves[compound]["slope"]
        if slope <= 0:
            return 999, None
        current_delta = predict_delta(compound, current_age, curves)
        crossover = (pit_loss - current_delta) / slope
        return max(0, int(round(crossover))), None

    best_crossover = 999
    best_alt = None

    for alt in alts:
        stay_cost = 0.0
        switch_cost = 0.0

        for lap_offset in range(1, LOOKAHEAD_LAPS + 1):
            stay_cost += predict_delta(compound, current_age + lap_offset, curves)
            switch_cost += predict_delta(alt, lap_offset, curves)  # fresh tyres

            if stay_cost - switch_cost > pit_loss:
                if lap_offset < best_crossover:
                    best_crossover = lap_offset
                    best_alt = alt
                break

    return best_crossover, best_alt


def calc_optimal_lap(
    current_age: int,
    compound: str,
    pit_loss: float,
    curves: dict[str, dict],
    remaining_laps: int = 20,
) -> tuple[int, str | None]:
    """
    Find the pit lap that minimises total degradation cost over the remaining laps.

    Evaluates every possible pit lap from 1..remaining_laps and compares against
    not pitting at all.

    Returns (optimal_lap, best_alt_compound).
    optimal_lap is relative: "pit in N laps". 0 means don't pit.
    """
    if compound not in curves:
        raise KeyError(f"No degradation curve available for {compound}")

    alts = [c for c in curves if c != compound]

    # Cost of staying out for all remaining laps (no pit)
    no_pit_cost = sum(
        predict_delta(compound, current_age + i, curves)
        for i in range(1, remaining_laps + 1)
    )

    best_lap = 0  # 0 = don't pit
    best_cost = no_pit_cost
    best_alt = None

    for alt in alts:
        for pit_at in range(1, remaining_laps + 1):
            # Cost on current tyres up to pit lap
            stay_segment = sum(
                predict_delta(compound, current_age + i, curves)
                for i in range(1, pit_at + 1)
            )
            # Pit loss + cost on fresh alt tyres for remaining laps after pit
            laps_after_pit = remaining_laps - pit_at
            alt_segment = sum(
                predict_delta(alt, j, curves)
                for j in range(1, laps_after_pit + 1)
            )
            total_cost = stay_segment + pit_loss + alt_segment

            if total_cost < best_cost:
                best_cost = total_cost
                best_lap = pit_at
                best_alt = alt

    return best_lap, best_alt


def calc_net_delta(
    current_age: int,
    compound: str,
    pit_loss: float,
    curves: dict[str, dict],
    best_alt: str | None = None,
    remaining_laps: int = 20,
) -> float:
    """
    Net time saved by pitting NOW vs staying out for all remaining laps.

    Compares cumulative degradation cost of staying out on current tyres
    against pitting now (pit loss + fresh alternative tyres for remaining laps).

    Positive = pitting saves time.  Negative = staying out is better.
    """
    horizon = remaining_laps

    # Cost of staying out on current tyres
    stay_cost = sum(
        predict_delta(compound, current_age + i, curves)
        for i in range(1, horizon + 1)
    )

    # Cost of pitting now: pit loss + fresh tyres for remaining laps
    alt = best_alt if (best_alt is not None and best_alt in curves) else compound
    pit_cost = pit_loss + sum(
        predict_delta(alt, j, curves)
        for j in range(1, horizon + 1)
    )

    return stay_cost - pit_cost


def get_pit_window(
    driver_state: dict,
    curves: dict[str, dict],
    circuit: str | None = None,
    remaining_laps: int = 20,
) -> dict:
    """
    Given a driver's current state, return pit window information.

    driver_state must have: compound (str), tyre_age (int)
    Returns: crossover_lap, net_delta, undercut_window, overcut_window, best_alt, optimal_lap
    """
    compound = driver_state["compound"]
    tyre_age = driver_state["tyre_age"]
    pit_loss = get_pit_loss(circuit)

    crossover, best_alt = calc_crossover(tyre_age, compound, pit_loss, curves)
    optimal_lap, opt_alt = calc_optimal_lap(tyre_age, compound, pit_loss, curves, remaining_laps)

    # Use the alt from whichever calculation found one
    resolved_alt = best_alt or opt_alt

    net_delta = calc_net_delta(tyre_age, compound, pit_loss, curves, resolved_alt, remaining_laps)

    undercut_window = crossover <= 3
    overcut_window = crossover > 3 and crossover <= 8

    return {
        "crossover_lap": crossover,
        "net_delta": net_delta,
        "undercut_window": undercut_window,
        "overcut_window": overcut_window,
        "best_alt": resolved_alt,
        "optimal_lap": optimal_lap,
    }
