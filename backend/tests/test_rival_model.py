"""
Unit tests for rival_model.py.
"""
import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from rival_model import find_undercut_threats


def test_undercut_threat_detected(sample_driver_states):
    # HAM is behind VER, has older tyres (25 vs 20 = 5 gap), gap 2.1s < 3s
    threats = find_undercut_threats("VER", sample_driver_states)
    threat_names = [t["driver"] for t in threats]
    assert "HAM" in threat_names
    # Verify full detail is present
    ham_threat = next(t for t in threats if t["driver"] == "HAM")
    assert ham_threat["compound"] == "MEDIUM"
    assert ham_threat["tyre_age"] == 25
    assert ham_threat["position"] == 2


def test_no_undercut_threat_when_gap_too_large():
    states = {
        "VER": {"compound": "SOFT",   "tyre_age": 20, "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "MEDIUM", "tyre_age": 25, "position": 2, "gap_to_leader": 10.0},
    }
    threats = find_undercut_threats("VER", states)
    assert all(t["driver"] != "HAM" for t in threats)


def test_no_undercut_threat_when_tyre_age_gap_too_small():
    states = {
        "VER": {"compound": "SOFT",   "tyre_age": 20, "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "MEDIUM", "tyre_age": 23, "position": 2, "gap_to_leader": 1.5},
    }
    threats = find_undercut_threats("VER", states)
    assert threats == []


def test_undercut_returns_empty_for_unknown_driver(sample_driver_states):
    assert find_undercut_threats("ALO", sample_driver_states) == []


def test_no_undercut_when_rival_far_ahead_in_gap():
    """Regression: without abs(), a rival closer to the leader would always
    pass the gap check because (small - large) is negative and < threshold."""
    states = {
        "VER": {"compound": "SOFT",   "tyre_age": 20, "position": 1, "gap_to_leader": 30.0},
        "HAM": {"compound": "MEDIUM", "tyre_age": 26, "position": 2, "gap_to_leader": 5.0},
    }
    threats = find_undercut_threats("VER", states)
    assert all(t["driver"] != "HAM" for t in threats)
