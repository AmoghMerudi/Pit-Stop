"""
End-to-end tests for the precomputed short-circuit in main.py.

These tests confirm every cache-friendly endpoint returns precomputed data
without invoking FastF1 / pwlf / pandas — the critical property that makes
historical-race loads fast on a cold deploy.
"""
import json
import sys
import os
import pytest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient

import main
import precomputed_store


@pytest.fixture
def client_with_precomputed(tmp_path, monkeypatch):
    monkeypatch.setattr(precomputed_store, "PRECOMPUTED_DIR", tmp_path)
    precomputed_store.clear_cache()
    yield TestClient(main.app), tmp_path
    precomputed_store.clear_cache()


def _write_bundle(root, year, rnd, bundle):
    path = root / str(year) / str(rnd) / "bundle.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(bundle, f)


SAMPLE_BUNDLE = {
    "drivers": [{"code": "VER", "name": "Max Verstappen", "team": "Red Bull",
                 "team_color": "1e5bc6", "number": 1}],
    "degradation": [{"compound": "SOFT", "slope": 0.05, "intercept": 0.0, "r2": 0.9,
                     "coeffs": [0.003, 0.05, 0.0], "degree": 2, "cliff_lap": None,
                     "cliff_confidence": "high", "temp_coefficient": None,
                     "type": "quadratic", "per_driver": None}],
    "stints": [{"driver": "VER", "stint_number": 1, "compound": "SOFT",
                "lap_start": 1, "lap_end": 20}],
    "positions": [{"lap": 1, "positions": {"VER": 1}}],
    "laptimes": [{"driver": "VER", "median": 90.0, "q1": 89.5, "q3": 90.5,
                  "min": 89.0, "max": 91.0, "whisker_low": 89.0, "whisker_high": 91.0,
                  "lap_count": 50}],
    "pitstops": [{"driver": "VER", "lap": 20, "pit_duration": 23.4,
                  "compound_before": "SOFT", "compound_after": "MEDIUM"}],
    "weather": [{"lap": 1, "air_temp": 25.0, "track_temp": 40.0,
                 "humidity": 50.0, "rainfall": False}],
    "race_control": [],
    "summary": {"fastest_lap": None, "biggest_gainer": None, "best_pit_stop": None,
                "worst_pit_stop": None, "most_overtakes": None, "total_overtakes": 0,
                "leader_changes": 0, "safety_car_periods": 0, "red_flags": 0,
                "unique_strategies": 1, "total_pit_stops": 1},
    "total_laps": 57,
}


def test_bundle_endpoint_serves_precomputed(client_with_precomputed):
    client, root = client_with_precomputed
    _write_bundle(root, 2024, 8, SAMPLE_BUNDLE)

    # The endpoint must not touch FastF1 — patch load_session to blow up if called
    with patch("main.load_session", side_effect=AssertionError("FastF1 must not be called")):
        r = client.get("/race/2024/8/bundle")

    assert r.status_code == 200
    body = r.json()
    assert body["total_laps"] == 57
    assert body["drivers"][0]["code"] == "VER"


def test_drivers_endpoint_serves_from_bundle(client_with_precomputed):
    client, root = client_with_precomputed
    _write_bundle(root, 2024, 8, SAMPLE_BUNDLE)

    with patch("main.load_session", side_effect=AssertionError("must not load")):
        r = client.get("/race/2024/8/drivers")
    assert r.status_code == 200
    assert r.json()[0]["code"] == "VER"


def test_stints_endpoint_serves_from_bundle(client_with_precomputed):
    client, root = client_with_precomputed
    _write_bundle(root, 2024, 8, SAMPLE_BUNDLE)

    with patch("main.load_session", side_effect=AssertionError("must not load")):
        r = client.get("/race/2024/8/stints")
    assert r.status_code == 200
    assert r.json() == SAMPLE_BUNDLE["stints"]


def test_degradation_endpoint_serves_from_bundle_when_no_driver_filter(client_with_precomputed):
    client, root = client_with_precomputed
    _write_bundle(root, 2024, 8, SAMPLE_BUNDLE)

    with patch("main.load_session", side_effect=AssertionError("must not load")):
        r = client.get("/race/2024/8/degradation")
    assert r.status_code == 200
    assert r.json()[0]["compound"] == "SOFT"


def test_summary_endpoint_serves_from_bundle(client_with_precomputed):
    client, root = client_with_precomputed
    _write_bundle(root, 2024, 8, SAMPLE_BUNDLE)

    with patch("main.load_session", side_effect=AssertionError("must not load")):
        r = client.get("/race/2024/8/summary")
    assert r.status_code == 200
    body = r.json()
    assert body["total_pit_stops"] == 1


def test_gaps_endpoint_serves_from_precomputed_file(client_with_precomputed):
    client, root = client_with_precomputed
    gaps_path = root / "2024" / "8" / "gaps_VER.json"
    gaps_path.parent.mkdir(parents=True, exist_ok=True)
    gaps = [{"lap": 1, "gaps": {"HAM": 1.2}}, {"lap": 2, "gaps": {"HAM": 1.5}}]
    gaps_path.write_text(json.dumps(gaps))

    with patch("main.load_session", side_effect=AssertionError("must not load")):
        r = client.get("/race/2024/8/gaps/VER")
    assert r.status_code == 200
    assert r.json() == gaps


def test_strategy_endpoint_serves_precomputed_for_default_lap(client_with_precomputed):
    client, root = client_with_precomputed
    payload = {
        "driver": "VER", "recommend_pit": True, "reason": "tyres worn",
        "optimal_lap": 30, "crossover_lap": 32, "net_delta": -1.2,
        "undercut_threats": [], "all_drivers": [
            {"driver": "VER", "compound": "SOFT", "tyre_age": 20,
             "position": 1, "gap_to_leader": 0.0, "status": ""}
        ],
        "pit_loss": 23.0, "circuit": "Barcelona", "best_alt": "MEDIUM",
        "cliff_confidence": "high", "remaining_laps": 1,
        "total_laps": 57, "current_lap": 56,
    }
    path = root / "2024" / "8" / "strategy_VER.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload))

    with patch("main.load_session", side_effect=AssertionError("must not load")):
        r = client.get("/race/2024/8/strategy/VER")
    assert r.status_code == 200
    body = r.json()
    assert body["driver"] == "VER"
    assert body["current_lap"] == 56


def test_strategy_endpoint_bypasses_cache_when_lap_param_present(client_with_precomputed):
    """When ?lap=N is provided, precomputed strategy is ignored — fall through to live path."""
    client, root = client_with_precomputed
    payload = {"driver": "VER", "current_lap": 56}
    path = root / "2024" / "8" / "strategy_VER.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload))

    # Force live-path; load_session would normally be called, so patching it
    # to raise gives us a clear signal the short-circuit was NOT taken.
    with patch("main.load_session", side_effect=RuntimeError("live path entered")):
        r = client.get("/race/2024/8/strategy/VER?lap=10")
    # We expect a 500 because the live path is genuinely entered (and we
    # patched load_session to fail) — the important assertion is that the
    # short-circuit was not taken.
    assert r.status_code == 500
