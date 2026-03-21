"""
Unit tests for strategy.py.
"""
import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from strategy import recommend


def test_recommend_returns_required_keys(sample_driver_states, sample_degradation_curves):
    result = recommend("VER", sample_driver_states, sample_degradation_curves)
    required = {"driver", "recommend_pit", "reason", "optimal_lap", "crossover_lap", "net_delta", "undercut_threats"}
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


def test_recommend_pit_false_when_no_window():
    # Fresh tyres, no rivals — should not recommend pit
    states = {
        "VER": {"compound": "SOFT", "tyre_age": 2, "position": 1, "gap_to_leader": 0.0},
    }
    curves = {"SOFT": {"slope": 0.10, "intercept": 0.0, "r2": 0.9}}
    result = recommend("VER", states, curves)
    assert result["recommend_pit"] is False
