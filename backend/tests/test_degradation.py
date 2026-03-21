"""
Unit tests for degradation.py.
"""
import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from degradation import compute_delta, fit_curve, fit_all_compounds, predict_delta


def test_compute_delta_adds_column(sample_laps_df):
    df = compute_delta(sample_laps_df)
    assert "lap_time_delta" in df.columns


def test_fit_curve_returns_required_keys(sample_laps_df):
    df = compute_delta(sample_laps_df)
    result = fit_curve(df, "SOFT")
    assert set(result.keys()) == {"slope", "intercept", "r2"}


def test_fit_curve_r2_between_0_and_1(sample_laps_df):
    df = compute_delta(sample_laps_df)
    result = fit_curve(df, "SOFT")
    assert 0.0 <= result["r2"] <= 1.0


def test_fit_curve_raises_on_unknown_compound(sample_laps_df):
    df = compute_delta(sample_laps_df)
    with pytest.raises(ValueError, match="Unknown compound"):
        fit_curve(df, "SUPERSOFT")


def test_fit_curve_raises_on_insufficient_laps(sample_laps_df):
    tiny = sample_laps_df[sample_laps_df["compound"] == "SOFT"].head(2)
    with pytest.raises(ValueError, match="Insufficient data"):
        fit_curve(tiny, "SOFT")


def test_fit_all_compounds_returns_dict(sample_laps_df):
    curves = fit_all_compounds(sample_laps_df)
    assert isinstance(curves, dict)
    assert "SOFT" in curves
    assert "MEDIUM" in curves


def test_predict_delta_at_age_zero_near_intercept(sample_degradation_curves):
    result = predict_delta("SOFT", 0, sample_degradation_curves)
    # intercept is 0.0, slope is 0.15, so at age=0 result should be 0.0
    assert abs(result - 0.0) < 0.001


def test_predict_delta_raises_on_missing_compound(sample_degradation_curves):
    with pytest.raises(KeyError):
        predict_delta("INTERMEDIATE", 5, sample_degradation_curves)
