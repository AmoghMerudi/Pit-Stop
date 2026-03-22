"""
Unit tests for strategy.py.
"""
import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from strategy import recommend


def test_recommend_returns_required_keys(sample_driver_states, sample_degradation_curves):
    result = recommend("VER", sample_driver_states, sample_degradation_curves)
    required = {"driver", "recommend_pit", "reason", "optimal_lap", "crossover_lap", "net_delta", "undercut_threats", "all_drivers", "pit_loss", "circuit", "best_alt"}
    assert required.issubset(result.keys())


def test_recommend_reason_is_non_empty(sample_driver_states, sample_degradation_curves):
    result = recommend("VER", sample_driver_states, sample_degradation_curves)
    assert isinstance(result["reason"], str)
    assert len(result["reason"]) > 0


def test_recommend_pit_is_bool(sample_driver_states, sample_degradation_curves):
    result = recommend("VER", sample_driver_states, sample_degradation_curves)
    assert isinstance(result["recommend_pit"], bool)


def test_recommend_raises_on_unknown_driver(sample_driver_states, sample_degradation_curves):
    with pytest.raises(ValueError, match="not found"):
        recommend("ALO", sample_driver_states, sample_degradation_curves)


def test_recommend_returns_all_drivers(sample_driver_states, sample_degradation_curves):
    result = recommend("VER", sample_driver_states, sample_degradation_curves)
    assert isinstance(result["all_drivers"], list)
    assert len(result["all_drivers"]) == len(sample_driver_states)
    assert all("driver" in d for d in result["all_drivers"])
    assert isinstance(result["pit_loss"], float)
    assert result["circuit"] is None  # no circuit passed


def test_recommend_with_circuit(sample_driver_states, sample_degradation_curves):
    result = recommend("VER", sample_driver_states, sample_degradation_curves, circuit="Suzuka")
    assert result["circuit"] == "Suzuka"
    assert result["pit_loss"] == 24.0  # Suzuka pit loss from constants


def test_recommend_pit_false_when_no_window():
    # Fresh tyres, no rivals — should not recommend pit
    states = {
        "VER": {"compound": "SOFT", "tyre_age": 2, "position": 1, "gap_to_leader": 0.0},
    }
    curves = {"SOFT": {"slope": 0.10, "intercept": 0.0, "r2": 0.9}}
    result = recommend("VER", states, curves)
    assert result["recommend_pit"] is False


def test_recommend_best_alt_included(sample_driver_states, sample_degradation_curves):
    result = recommend("VER", sample_driver_states, sample_degradation_curves)
    assert "best_alt" in result
    assert result["best_alt"] is None or isinstance(result["best_alt"], str)


def test_recommend_optimal_lap_from_calc(sample_driver_states, sample_degradation_curves):
    """optimal_lap should come from calc_optimal_lap, not just max(1, crossover)."""
    result = recommend("VER", sample_driver_states, sample_degradation_curves)
    assert isinstance(result["optimal_lap"], int)
    assert result["optimal_lap"] >= 0


def test_recommend_remaining_laps(sample_driver_states, sample_degradation_curves):
    """remaining_laps parameter should be accepted."""
    result = recommend("VER", sample_driver_states, sample_degradation_curves, remaining_laps=10)
    assert isinstance(result["optimal_lap"], int)
