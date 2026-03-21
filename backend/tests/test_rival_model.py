"""
Unit tests for rival_model.py.
"""
import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from rival_model import find_undercut_threats, find_overcut_opportunities


def test_undercut_threat_detected(sample_driver_states):
    # HAM is behind VER, has older tyres (25 vs 20 = 5 gap), gap 2.1s < 3s
    threats = find_undercut_threats("VER", sample_driver_states)
    assert "HAM" in threats


def test_no_undercut_threat_when_gap_too_large():
    states = {
        "VER": {"compound": "SOFT",   "tyre_age": 20, "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "MEDIUM", "tyre_age": 25, "position": 2, "gap_to_leader": 10.0},
    }
    threats = find_undercut_threats("VER", states)
    assert "HAM" not in threats


def test_no_undercut_threat_when_tyre_age_gap_too_small():
    states = {
        "VER": {"compound": "SOFT",   "tyre_age": 20, "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "MEDIUM", "tyre_age": 23, "position": 2, "gap_to_leader": 1.5},
    }
    threats = find_undercut_threats("VER", states)
    assert threats == []


def test_undercut_returns_empty_for_unknown_driver(sample_driver_states):
    assert find_undercut_threats("ALO", sample_driver_states) == []


def test_overcut_opportunity_detected():
    states = {
        "VER": {"compound": "SOFT",   "tyre_age": 10, "position": 2, "gap_to_leader": 2.0},
        "HAM": {"compound": "MEDIUM", "tyre_age": 20, "position": 1, "gap_to_leader": 0.0},
    }
    opps = find_overcut_opportunities("VER", states)
    assert "HAM" in opps


def test_overcut_returns_empty_for_unknown_driver(sample_driver_states):
    assert find_overcut_opportunities("ALO", sample_driver_states) == []
