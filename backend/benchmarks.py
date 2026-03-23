"""
Degradation baseline for live race strategy analysis.

Provides:
1. BENCHMARK_CURVES — generic F1 degradation values per compound
2. load_baseline_curves() — hybrid loader: prior race → historical pool → benchmarks
3. load_historical_degradation() — multi-race pooling for same circuit across years
"""

import hashlib
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from pathlib import Path

import numpy as np
import pandas as pd

from constants import COMPOUNDS, ROUND_TO_CIRCUIT
from degradation import compute_delta, fit_all_compounds, fuel_correct_laptimes
from ingestion import get_laps, get_weather_data, load_session

logger = logging.getLogger(__name__)

BASELINE_LOAD_TIMEOUT = 30  # seconds
CACHE_DIR = Path(__file__).parent / ".cache" / "degradation"

# Realistic F1 degradation benchmarks derived from multi-year data.
# Quadratic benchmarks: coeffs = [a, b, c] where delta = a*age² + b*age + c
BENCHMARK_CURVES: dict[str, dict] = {
    "SOFT":         {"type": "quadratic", "coeffs": [0.003, 0.05, 0.0], "degree": 2, "slope": 0.05, "intercept": 0.0, "r2": 0.0, "cliff_lap": None, "temp_coefficient": None},
    "MEDIUM":       {"type": "quadratic", "coeffs": [0.0015, 0.03, 0.0], "degree": 2, "slope": 0.03, "intercept": 0.0, "r2": 0.0, "cliff_lap": None, "temp_coefficient": None},
    "HARD":         {"type": "quadratic", "coeffs": [0.0008, 0.015, 0.0], "degree": 2, "slope": 0.015, "intercept": 0.0, "r2": 0.0, "cliff_lap": None, "temp_coefficient": None},
    "INTERMEDIATE": {"type": "quadratic", "coeffs": [0.002, 0.04, 0.0], "degree": 2, "slope": 0.04, "intercept": 0.0, "r2": 0.0, "cliff_lap": None, "temp_coefficient": None},
    "WET":          {"type": "quadratic", "coeffs": [0.001, 0.025, 0.0], "degree": 2, "slope": 0.025, "intercept": 0.0, "r2": 0.0, "cliff_lap": None, "temp_coefficient": None},
}


def _load_prior_race_curves(year: int, prior_round: int) -> dict[str, dict]:
    """Load and fit degradation curves from a prior race with fuel correction."""
    session = load_session(year, prior_round)
    circuit = session.event.get("Location") if hasattr(session, "event") else None
    laps = get_laps(session)
    laps = fuel_correct_laptimes(laps)
    try:
        weather = get_weather_data(session)
        weather_df = pd.DataFrame([w if isinstance(w, dict) else w.dict() for w in weather]) if weather else None
    except Exception:
        weather_df = None
    return fit_all_compounds(laps, weather_df=weather_df, circuit_name=circuit, fit_per_driver=False)


def _cache_key(circuit: str, compound: str, years: list[int]) -> str:
    """Generate a cache key for historical degradation data."""
    raw = f"{circuit}:{compound}:{sorted(years)}"
    return hashlib.md5(raw.encode()).hexdigest()


def load_historical_degradation(circuit: str, compound: str,
                                years: list[int] | None = None) -> dict | None:
    """
    Load and pool degradation data from the same circuit across multiple years.

    Looks up all rounds for the circuit across the given years, loads lap data,
    applies fuel correction, and fits a combined curve.

    Current-year data is weighted 2x vs historical.

    Results are cached to disk to avoid repeated FastF1 loads.
    """
    if years is None:
        years = [2023, 2024]

    # Check disk cache first
    cache_file = CACHE_DIR / f"{_cache_key(circuit, compound, years)}.json"
    if cache_file.exists():
        try:
            with open(cache_file) as f:
                return json.load(f)
        except Exception:
            pass

    # Find rounds for this circuit across years
    rounds_to_load = []
    for (y, r), c in ROUND_TO_CIRCUIT.items():
        if c == circuit and y in years:
            rounds_to_load.append((y, r))

    if not rounds_to_load:
        return None

    # Collect lap data from all matching races
    all_laps = []
    for y, r in rounds_to_load:
        try:
            session = load_session(y, r)
            laps = get_laps(session)
            laps = fuel_correct_laptimes(laps)
            laps = compute_delta(laps)
            compound_laps = laps[laps["compound"] == compound]
            if not compound_laps.empty:
                # Weight current year 2x
                weight = 2 if y == max(years) else 1
                for _ in range(weight):
                    all_laps.append(compound_laps)
        except Exception as exc:
            logger.warning("Failed to load %d/%d for pooling: %s", y, r, exc)

    if not all_laps:
        return None

    combined = pd.concat(all_laps, ignore_index=True)

    if len(combined) < 5:
        return None

    from degradation import fit_curve
    try:
        result = fit_curve(combined, compound, circuit_name=circuit)

        # Cache to disk
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        # Only cache JSON-serializable fields
        cacheable = {k: v for k, v in result.items() if k not in ("_pw_breaks", "_pw_beta")}
        with open(cache_file, "w") as f:
            json.dump(cacheable, f)

        return result
    except Exception as exc:
        logger.warning("Historical pooling fit failed for %s/%s: %s", circuit, compound, exc)
        return None


def load_baseline_curves(year: int, round_number: int) -> tuple[dict[str, dict], str]:
    """
    Load degradation curves for use in live race strategy analysis.

    Strategy:
    - Round 1: no prior race — return benchmark curves immediately.
    - Round 2+: attempt prior race (with fuel correction), fall back to benchmarks.

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
