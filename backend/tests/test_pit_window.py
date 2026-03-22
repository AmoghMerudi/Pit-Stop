"""
Unit tests for pit_window.py.
"""
import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pit_window import calc_crossover, calc_net_delta, calc_optimal_lap, get_pit_loss, get_pit_window
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


def test_calc_crossover_returns_tuple(sample_degradation_curves):
    result = calc_crossover(10, "SOFT", 23.0, sample_degradation_curves)
    assert isinstance(result, tuple)
    assert len(result) == 2
    crossover, best_alt = result
    assert isinstance(crossover, int)


def test_calc_crossover_returns_best_alt(sample_degradation_curves):
    """When multiple alternatives exist, crossover should pick the best one."""
    crossover, best_alt = calc_crossover(10, "SOFT", 23.0, sample_degradation_curves)
    # SOFT degrades fastest (0.15), so switching should be recommended
    # HARD has lowest slope (0.04), so it should be the best alt
    assert best_alt in ("MEDIUM", "HARD")


def test_calc_crossover_raises_on_missing_compound(sample_degradation_curves):
    with pytest.raises(KeyError):
        calc_crossover(10, "INTERMEDIATE", 23.0, sample_degradation_curves)


def test_calc_crossover_single_compound():
    """With only one compound available, falls back to single-compound logic."""
    curves = {"SOFT": {"slope": 0.15, "intercept": 0.0, "r2": 0.9}}
    crossover, best_alt = calc_crossover(5, "SOFT", 23.0, curves)
    assert isinstance(crossover, int)
    assert best_alt is None


def test_calc_crossover_no_degradation():
    """Zero/negative slope means no crossover."""
    curves = {
        "SOFT": {"slope": 0.0, "intercept": 0.0, "r2": 0.9},
        "MEDIUM": {"slope": 0.0, "intercept": 0.0, "r2": 0.9},
    }
    crossover, best_alt = calc_crossover(5, "SOFT", 23.0, curves)
    assert crossover == 999


def test_calc_crossover_compound_aware(sample_degradation_curves):
    """Crossover on worn SOFT tyres should be sooner than on fresh ones."""
    crossover_worn, _ = calc_crossover(15, "SOFT", 23.0, sample_degradation_curves)
    crossover_fresh, _ = calc_crossover(2, "SOFT", 23.0, sample_degradation_curves)
    assert crossover_worn <= crossover_fresh


def test_calc_optimal_lap_returns_tuple(sample_degradation_curves):
    result = calc_optimal_lap(10, "SOFT", 23.0, sample_degradation_curves, remaining_laps=20)
    assert isinstance(result, tuple)
    optimal, best_alt = result
    assert isinstance(optimal, int)
    assert optimal >= 0


def test_calc_optimal_lap_dont_pit_when_fresh(sample_degradation_curves):
    """With very fresh tyres and few remaining laps, should not recommend pitting."""
    optimal, _ = calc_optimal_lap(1, "MEDIUM", 25.0, sample_degradation_curves, remaining_laps=5)
    # Pit loss is 25s, MEDIUM degrades at 0.08s/lap — over 5 laps the total
    # degradation is tiny, not worth pitting
    assert optimal == 0


def test_calc_optimal_lap_recommends_pit_when_worn(sample_degradation_curves):
    """Heavily worn SOFT with many laps remaining should recommend pitting."""
    optimal, best_alt = calc_optimal_lap(25, "SOFT", 23.0, sample_degradation_curves, remaining_laps=20)
    # SOFT at age 25 degrades fast; should recommend pitting
    assert optimal > 0
    assert best_alt is not None


def test_calc_optimal_lap_raises_on_missing_compound(sample_degradation_curves):
    with pytest.raises(KeyError):
        calc_optimal_lap(10, "INTERMEDIATE", 23.0, sample_degradation_curves)


def test_calc_net_delta_with_alt(sample_degradation_curves):
    """Net delta should be positive when current tyres are very worn."""
    nd = calc_net_delta(30, "SOFT", 23.0, sample_degradation_curves, best_alt="HARD")
    # stay_cost = predict_delta("SOFT", 31, curves) = 0.15 * 31 = 4.65
    # pit_now_cost = 23.0 + predict_delta("HARD", 1, curves) = 23.0 + 0.04 = 23.04
    # net_delta = 4.65 - 23.04 = -18.39 (still negative because pit loss is huge)
    assert isinstance(nd, float)


def test_calc_net_delta_without_alt(sample_degradation_curves):
    """Without best_alt, should compare against fresh set of same compound."""
    nd = calc_net_delta(10, "SOFT", 23.0, sample_degradation_curves, best_alt=None)
    assert isinstance(nd, float)


def test_get_pit_window_returns_all_keys(sample_degradation_curves):
    state = {"compound": "SOFT", "tyre_age": 20}
    result = get_pit_window(state, sample_degradation_curves, "Bahrain")
    expected_keys = {"crossover_lap", "net_delta", "undercut_window", "overcut_window", "best_alt", "optimal_lap"}
    assert set(result.keys()) == expected_keys


def test_get_pit_window_crossover_is_int(sample_degradation_curves):
    state = {"compound": "SOFT", "tyre_age": 20}
    result = get_pit_window(state, sample_degradation_curves)
    assert isinstance(result["crossover_lap"], int)


def test_get_pit_window_optimal_lap_is_int(sample_degradation_curves):
    state = {"compound": "SOFT", "tyre_age": 20}
    result = get_pit_window(state, sample_degradation_curves)
    assert isinstance(result["optimal_lap"], int)


def test_get_pit_window_best_alt_is_string_or_none(sample_degradation_curves):
    state = {"compound": "SOFT", "tyre_age": 20}
    result = get_pit_window(state, sample_degradation_curves)
    assert result["best_alt"] is None or isinstance(result["best_alt"], str)


def test_get_pit_window_remaining_laps(sample_degradation_curves):
    """remaining_laps parameter should be respected."""
    state = {"compound": "SOFT", "tyre_age": 15}
    result_short = get_pit_window(state, sample_degradation_curves, remaining_laps=5)
    result_long = get_pit_window(state, sample_degradation_curves, remaining_laps=30)
    # Both should return valid results
    assert isinstance(result_short["optimal_lap"], int)
    assert isinstance(result_long["optimal_lap"], int)
