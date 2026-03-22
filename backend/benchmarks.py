"""
Degradation baseline for live race strategy analysis.

Provides two things:
1. BENCHMARK_CURVES — generic F1 degradation values per compound, used when no
   historical session is available (round 1) or when loading fails.
2. load_baseline_curves() — hybrid loader that tries the prior race of the same
   season first (30s timeout), then falls back to BENCHMARK_CURVES.
"""
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from degradation import fit_all_compounds
from ingestion import get_laps, load_session

logger = logging.getLogger(__name__)

BASELINE_LOAD_TIMEOUT = 30  # seconds

# Realistic F1 degradation benchmarks derived from multi-year data.
# slope = seconds of additional lap time per lap of tyre age.
# r2 = 0.0 is a sentinel meaning "benchmark data, not fitted from real laps".
# Quadratic benchmarks: coeffs = [a, b, c] where delta = a*age² + b*age + c
# The quadratic term (a) models accelerating degradation (tyre cliff).
# Example: SOFT at age 30 = 0.003*900 + 0.05*30 = 2.7 + 1.5 = 4.2s
#          SOFT at age 50 = 0.003*2500 + 0.05*50 = 7.5 + 2.5 = 10.0s (cliff)
BENCHMARK_CURVES: dict[str, dict] = {
    "SOFT":         {"coeffs": [0.003, 0.05, 0.0], "degree": 2, "slope": 0.05, "intercept": 0.0, "r2": 0.0},
    "MEDIUM":       {"coeffs": [0.0015, 0.03, 0.0], "degree": 2, "slope": 0.03, "intercept": 0.0, "r2": 0.0},
    "HARD":         {"coeffs": [0.0008, 0.015, 0.0], "degree": 2, "slope": 0.015, "intercept": 0.0, "r2": 0.0},
    "INTERMEDIATE": {"coeffs": [0.002, 0.04, 0.0], "degree": 2, "slope": 0.04, "intercept": 0.0, "r2": 0.0},
    "WET":          {"coeffs": [0.001, 0.025, 0.0], "degree": 2, "slope": 0.025, "intercept": 0.0, "r2": 0.0},
}


def _load_prior_race_curves(year: int, prior_round: int) -> dict[str, dict]:
    """Load and fit degradation curves from a prior race. Runs in a thread."""
    session = load_session(year, prior_round)
    laps = get_laps(session)
    return fit_all_compounds(laps)


def load_baseline_curves(year: int, round_number: int) -> tuple[dict[str, dict], str]:
    """
    Load degradation curves for use in live race strategy analysis.

    Strategy:
    - Round 1: no prior race in this season — return benchmark curves immediately.
    - Round 2+: attempt to load the prior race (round_number - 1) via FastF1
      with a 30-second timeout. On success return fitted curves. On any
      failure (network, timeout, bad data) fall back to benchmark curves.

    Returns:
        (curves, source) where source is one of:
            "prior_race:{year}/{prior_round}"
            "benchmark"
    """
    if round_number <= 1:
        logger.info("Round 1 — no prior race available, using benchmark curves")
        return BENCHMARK_CURVES, "benchmark"

    prior_round = round_number - 1

    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_load_prior_race_curves, year, prior_round)
            curves = future.result(timeout=BASELINE_LOAD_TIMEOUT)

        source = f"prior_race:{year}/{prior_round}"
        logger.info("Loaded baseline curves from %s", source)
        return curves, source

    except FuturesTimeoutError:
        logger.warning(
            "FastF1 load for %d/%d exceeded %ds timeout — using benchmark curves",
            year, prior_round, BASELINE_LOAD_TIMEOUT,
        )
    except Exception as exc:
        logger.warning(
            "Failed to load prior race curves for %d/%d: %s — using benchmark curves",
            year, prior_round, exc,
        )

    return BENCHMARK_CURVES, "benchmark"
