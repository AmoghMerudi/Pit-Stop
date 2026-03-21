"""
Unit tests for pit_window.py.
"""
import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pit_window import calc_crossover, calc_net_delta, get_pit_loss, get_pit_window
from constants import DEFAULT_PIT_LOSS


def test_get_pit_loss_known_circuit():
    loss = get_pit_loss("Bahrain")
    assert loss == 23.0


def test_get_pit_loss_unknown_circuit_falls_back():
    loss = get_pit_loss("Atlantis")
    assert loss == DEFAULT_PIT_LOSS


def test_get_pit_loss_none_falls_back():
    loss = get_pit_loss(None)
    assert loss == DEFAULT_PIT_LOSS


def test_calc_crossover_returns_int(sample_degradation_curves):
    result = calc_crossover(10, "SOFT", 23.0, sample_degradation_curves)
    assert isinstance(result, int)


def test_calc_crossover_raises_on_missing_compound(sample_degradation_curves):
    with pytest.raises(KeyError):
        calc_crossover(10, "INTERMEDIATE", 23.0, sample_degradation_curves)


def test_get_pit_window_returns_all_keys(sample_degradation_curves):
    state = {"compound": "SOFT", "tyre_age": 20}
    result = get_pit_window(state, sample_degradation_curves, "Bahrain")
    assert set(result.keys()) == {"crossover_lap", "net_delta", "undercut_window", "overcut_window"}


def test_get_pit_window_crossover_is_int(sample_degradation_curves):
    state = {"compound": "SOFT", "tyre_age": 20}
    result = get_pit_window(state, sample_degradation_curves)
    assert isinstance(result["crossover_lap"], int)
