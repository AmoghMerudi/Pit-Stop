"""
Unit tests for ingestion.py.
FastF1 session loads are mocked — these tests must complete in under 2 seconds.
"""
import pytest
from unittest.mock import MagicMock, patch

import pandas as pd
from pandas import Timedelta

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ingestion import get_laps, get_live_stints, get_live_laps


def make_mock_session(rows: list[dict]) -> MagicMock:
    """Build a mock FastF1 session with a laps DataFrame from the given rows."""
    df = pd.DataFrame(rows)
    laps_mock = MagicMock()
    laps_mock.pick_quicklaps.return_value = df
    session = MagicMock()
    session.laps = laps_mock
    return session


def test_get_laps_returns_correct_columns():
    session = make_mock_session([
        {"Driver": "VER", "Compound": "SOFT", "TyreLife": 5,
         "LapTime": Timedelta(seconds=90.5), "Stint": 1, "LapNumber": 6},
    ])
    df = get_laps(session)
    assert set(df.columns) == {"driver", "compound", "tyre_age", "lap_time", "stint", "lap_number"}


def test_get_laps_converts_timedelta_to_float():
    session = make_mock_session([
        {"Driver": "VER", "Compound": "SOFT", "TyreLife": 5,
         "LapTime": Timedelta(seconds=90.5), "Stint": 1, "LapNumber": 6},
    ])
    df = get_laps(session)
    assert df["lap_time"].dtype == float
    assert abs(df["lap_time"].iloc[0] - 90.5) < 0.001


def test_get_laps_drops_unknown_compound():
    session = make_mock_session([
        {"Driver": "VER", "Compound": "UNKNOWN", "TyreLife": 3,
         "LapTime": Timedelta(seconds=91.0), "Stint": 1, "LapNumber": 5},
        {"Driver": "HAM", "Compound": "MEDIUM", "TyreLife": 5,
         "LapTime": Timedelta(seconds=91.2), "Stint": 1, "LapNumber": 5},
    ])
    df = get_laps(session)
    assert "UNKNOWN" not in df["compound"].values
    assert len(df) == 1


def test_get_laps_drops_null_lap_times():
    import numpy as np
    session = make_mock_session([
        {"Driver": "VER", "Compound": "SOFT", "TyreLife": 5,
         "LapTime": pd.NaT, "Stint": 1, "LapNumber": 6},
        {"Driver": "HAM", "Compound": "MEDIUM", "TyreLife": 5,
         "LapTime": Timedelta(seconds=91.2), "Stint": 1, "LapNumber": 6},
    ])
    df = get_laps(session)
    assert df["lap_time"].isna().sum() == 0
    assert len(df) == 1


def test_get_live_stints_returns_empty_on_request_error(mocker):
    mock_get = mocker.patch("ingestion.requests.get")
    mock_get.return_value.raise_for_status.side_effect = Exception("connection refused")
    result = get_live_stints()
    assert result == []


def test_get_live_laps_returns_empty_on_timeout(mocker):
    import requests as req
    mocker.patch("ingestion.requests.get", side_effect=req.Timeout())
    result = get_live_laps()
    assert result == []


def test_get_live_stints_deduplicates(mocker):
    mock_get = mocker.patch("ingestion.requests.get")
    mock_get.return_value.raise_for_status.return_value = None
    mock_get.return_value.json.return_value = [
        {"driver_number": 1, "stint_number": 1, "compound": "SOFT"},
        {"driver_number": 1, "stint_number": 1, "compound": "SOFT"},  # duplicate
    ]
    result = get_live_stints()
    assert len(result) == 1
