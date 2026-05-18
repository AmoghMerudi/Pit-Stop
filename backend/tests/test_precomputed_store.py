"""
Tests for precomputed_store — the read side of the static-artifact short-circuit.

These tests don't touch FastF1 or pwlf; they only verify that the loader
finds files when present and returns None when missing, and that the LRU
cache can be cleared between cases.
"""
import json
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import precomputed_store


@pytest.fixture
def precomputed_root(tmp_path, monkeypatch):
    """Point precomputed_store at a temp directory and clear caches between tests."""
    monkeypatch.setattr(precomputed_store, "PRECOMPUTED_DIR", tmp_path)
    precomputed_store.clear_cache()
    yield tmp_path
    precomputed_store.clear_cache()


def _write(root, year, rnd, name, payload):
    path = root / str(year) / str(rnd) / f"{name}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(payload, f)


def test_try_load_bundle_returns_none_when_missing(precomputed_root):
    assert precomputed_store.try_load_bundle(2024, 8) is None


def test_try_load_bundle_returns_dict_when_present(precomputed_root):
    payload = {"drivers": [{"code": "VER"}], "total_laps": 57}
    _write(precomputed_root, 2024, 8, "bundle", payload)
    assert precomputed_store.try_load_bundle(2024, 8) == payload


def test_try_load_strategy_keyed_on_driver(precomputed_root):
    payload = {"driver": "VER", "recommend_pit": True}
    _write(precomputed_root, 2024, 8, "strategy_VER", payload)
    assert precomputed_store.try_load_strategy(2024, 8, "VER") == payload
    assert precomputed_store.try_load_strategy(2024, 8, "HAM") is None


def test_try_load_strategy_uppercases_driver(precomputed_root):
    payload = {"driver": "VER"}
    _write(precomputed_root, 2024, 8, "strategy_VER", payload)
    # Loader normalises to uppercase before reading
    assert precomputed_store.try_load_strategy(2024, 8, "ver") == payload


def test_try_load_gaps_returns_list(precomputed_root):
    payload = [{"lap": 1, "gaps": {"HAM": 1.2}}, {"lap": 2, "gaps": {"HAM": 1.5}}]
    _write(precomputed_root, 2024, 8, "gaps_VER", payload)
    assert precomputed_store.try_load_gaps(2024, 8, "VER") == payload


def test_corrupted_json_returns_none(precomputed_root):
    path = precomputed_root / "2024" / "8" / "bundle.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("{ this is not json")
    assert precomputed_store.try_load_bundle(2024, 8) is None
