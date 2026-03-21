import pandas as pd
import pytest


@pytest.fixture
def sample_laps_df():
    """Minimal valid laps DataFrame matching the ingestion output contract."""
    return pd.DataFrame({
        "driver":     ["VER", "VER", "VER", "VER", "VER",
                       "HAM", "HAM", "HAM", "HAM", "HAM"],
        "compound":   ["SOFT"] * 5 + ["MEDIUM"] * 5,
        "tyre_age":   [1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
        "lap_time":   [90.5, 90.8, 91.2, 91.6, 92.1,
                       91.0, 91.1, 91.3, 91.4, 91.6],
        "stint":      [1] * 10,
        "lap_number": [5, 6, 7, 8, 9, 5, 6, 7, 8, 9],
    })


@pytest.fixture
def sample_degradation_curves():
    """Pre-built curve dict matching the output of fit_all_compounds."""
    return {
        "SOFT":   {"slope": 0.15, "intercept": 0.0, "r2": 0.92},
        "MEDIUM": {"slope": 0.08, "intercept": 0.0, "r2": 0.88},
        "HARD":   {"slope": 0.04, "intercept": 0.0, "r2": 0.85},
    }


@pytest.fixture
def sample_driver_states():
    """Driver state dict as returned by rival_model.build_driver_states."""
    return {
        "VER": {"compound": "SOFT",   "tyre_age": 20, "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "MEDIUM", "tyre_age": 25, "position": 2, "gap_to_leader": 2.1},
        "LEC": {"compound": "HARD",   "tyre_age": 10, "position": 3, "gap_to_leader": 5.3},
    }
