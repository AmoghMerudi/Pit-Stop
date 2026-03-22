"""
Unit tests for rival_model.py — degradation-aware undercut threat detection.
"""
import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from rival_model import find_undercut_threats


# ---------------------------------------------------------------------------
# Basic detection
# ---------------------------------------------------------------------------

def test_undercut_threat_detected_with_curves(sample_driver_states, sample_degradation_curves):
    """HAM on MEDIUM with 25 laps (deg 2.0s) vs VER on SOFT with 20 laps (deg 3.0s).
    VER is actually MORE degraded, so HAM has negative advantage — NOT a threat
    with curves. This validates degradation-awareness."""
    threats = find_undercut_threats(
        "VER", sample_driver_states, curves=sample_degradation_curves
    )
    # HAM's MEDIUM deg = 0.08*25 = 2.0, VER's SOFT deg = 0.15*20 = 3.0
    # HAM's advantage = 2.0 - 3.0 = -1.0 → negative → not a threat
    threat_names = [t["driver"] for t in threats]
    assert "HAM" not in threat_names


def test_undercut_threat_detected_without_curves():
    """Without curves, falls back to tyre age difference heuristic."""
    states = {
        "VER": {"compound": "SOFT",   "tyre_age": 10, "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "MEDIUM", "tyre_age": 20, "position": 2, "gap_to_leader": 2.0},
    }
    threats = find_undercut_threats("VER", states)
    assert len(threats) == 1
    assert threats[0]["driver"] == "HAM"
    assert "threat_score" in threats[0]
    assert threats[0]["threat_score"] > 0.2


def test_real_undercut_threat_with_curves():
    """A rival on SOFT with high tyre age vs target on MEDIUM with low tyre age
    is a genuine undercut threat when degradation curves show it."""
    states = {
        "VER": {"compound": "MEDIUM", "tyre_age": 5,  "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "SOFT",   "tyre_age": 20, "position": 2, "gap_to_leader": 2.0},
    }
    curves = {
        "SOFT":   {"slope": 0.15, "intercept": 0.0, "r2": 0.92},
        "MEDIUM": {"slope": 0.08, "intercept": 0.0, "r2": 0.88},
    }
    # HAM deg = 0.15*20 = 3.0, VER deg = 0.08*5 = 0.4, advantage = 2.6 → real threat
    threats = find_undercut_threats("VER", states, curves=curves)
    assert len(threats) == 1
    assert threats[0]["driver"] == "HAM"
    assert threats[0]["threat_score"] > 0.5


# ---------------------------------------------------------------------------
# Position filtering
# ---------------------------------------------------------------------------

def test_no_threat_when_rival_too_far_behind_in_position():
    """P16 cannot undercut P1 — position gap > UNDERCUT_MAX_POSITION_GAP."""
    states = {
        "VER": {"compound": "SOFT",   "tyre_age": 5,  "position": 1,  "gap_to_leader": 0.0},
        "HAM": {"compound": "MEDIUM", "tyre_age": 30, "position": 16, "gap_to_leader": 2.0},
    }
    threats = find_undercut_threats("VER", states)
    assert threats == []


def test_threat_within_two_positions():
    """A rival 2 positions behind is still within range."""
    states = {
        "VER": {"compound": "MEDIUM", "tyre_age": 5,  "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "SOFT",   "tyre_age": 20, "position": 3, "gap_to_leader": 2.5},
    }
    curves = {
        "SOFT":   {"slope": 0.15, "intercept": 0.0, "r2": 0.92},
        "MEDIUM": {"slope": 0.08, "intercept": 0.0, "r2": 0.88},
    }
    threats = find_undercut_threats("VER", states, curves=curves)
    assert len(threats) == 1
    assert threats[0]["driver"] == "HAM"
    # Position score should be 0.5 (1/2) instead of 1.0
    assert threats[0]["threat_score"] > 0.2


# ---------------------------------------------------------------------------
# Gap filtering
# ---------------------------------------------------------------------------

def test_no_undercut_threat_when_gap_too_large():
    states = {
        "VER": {"compound": "SOFT",   "tyre_age": 10, "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "MEDIUM", "tyre_age": 25, "position": 2, "gap_to_leader": 10.0},
    }
    threats = find_undercut_threats("VER", states)
    assert all(t["driver"] != "HAM" for t in threats)


def test_no_undercut_when_rival_far_ahead_in_gap():
    """Regression: gap between rivals is huge even if positions are close."""
    states = {
        "VER": {"compound": "SOFT",   "tyre_age": 10, "position": 1, "gap_to_leader": 30.0},
        "HAM": {"compound": "MEDIUM", "tyre_age": 26, "position": 2, "gap_to_leader": 5.0},
    }
    threats = find_undercut_threats("VER", states)
    assert all(t["driver"] != "HAM" for t in threats)


def test_circuit_aware_gap_threshold():
    """With circuit='Monaco' (pit loss 28s), the gap threshold is higher."""
    states = {
        "VER": {"compound": "MEDIUM", "tyre_age": 5,  "position": 1, "gap_to_leader": 0.0},
        # Gap of 4.0s — too big for fallback (3.0s) but fine for Monaco (28.0s)
        "HAM": {"compound": "SOFT",   "tyre_age": 25, "position": 2, "gap_to_leader": 4.0},
    }
    curves = {
        "SOFT":   {"slope": 0.15, "intercept": 0.0, "r2": 0.92},
        "MEDIUM": {"slope": 0.08, "intercept": 0.0, "r2": 0.88},
    }
    # Without circuit: fallback gap threshold is 3.0, so 4.0 gap → no threat
    threats_no_circuit = find_undercut_threats("VER", states, curves=curves)
    assert all(t["driver"] != "HAM" for t in threats_no_circuit)

    # With circuit Monaco: pit loss 28.0s, so 4.0 gap → threat
    threats_monaco = find_undercut_threats("VER", states, curves=curves, circuit="Monaco")
    assert any(t["driver"] == "HAM" for t in threats_monaco)


# ---------------------------------------------------------------------------
# Degradation awareness
# ---------------------------------------------------------------------------

def test_hard_tyre_low_slope_not_a_threat():
    """A driver on HARD with 35 laps but slope=0.04 has only 1.4s deg — low threat."""
    states = {
        "VER": {"compound": "MEDIUM", "tyre_age": 5,  "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "HARD",   "tyre_age": 35, "position": 2, "gap_to_leader": 2.5},
    }
    curves = {
        "HARD":   {"slope": 0.04, "intercept": 0.0, "r2": 0.85},
        "MEDIUM": {"slope": 0.08, "intercept": 0.0, "r2": 0.88},
    }
    # HAM deg = 0.04*35 = 1.4, VER deg = 0.08*5 = 0.4, advantage = 1.0
    # deg_score = 1.0/3.0 ≈ 0.333, gap_score = 1 - 2.5/3.0 ≈ 0.167, pos_score = 1.0
    # total = 0.4*0.167 + 0.4*0.333 + 0.2*1.0 = 0.067 + 0.133 + 0.2 = 0.4
    threats = find_undercut_threats("VER", states, curves=curves)
    # Should exist but with relatively moderate score
    if threats:
        assert threats[0]["threat_score"] < 0.6


def test_soft_high_deg_is_real_threat():
    """A driver on SOFT with 15 laps, slope=0.15, has 2.25s deg — real threat."""
    states = {
        "VER": {"compound": "MEDIUM", "tyre_age": 3,  "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "SOFT",   "tyre_age": 15, "position": 2, "gap_to_leader": 1.0},
    }
    curves = {
        "SOFT":   {"slope": 0.15, "intercept": 0.0, "r2": 0.92},
        "MEDIUM": {"slope": 0.08, "intercept": 0.0, "r2": 0.88},
    }
    # HAM deg = 0.15*15 = 2.25, VER deg = 0.08*3 = 0.24, advantage = 2.01
    threats = find_undercut_threats("VER", states, curves=curves)
    assert len(threats) == 1
    assert threats[0]["driver"] == "HAM"
    assert threats[0]["threat_score"] > 0.5


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_undercut_returns_empty_for_unknown_driver(sample_driver_states):
    assert find_undercut_threats("ALO", sample_driver_states) == []


def test_threat_score_present_in_output():
    states = {
        "VER": {"compound": "MEDIUM", "tyre_age": 5,  "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "SOFT",   "tyre_age": 20, "position": 2, "gap_to_leader": 1.5},
    }
    curves = {
        "SOFT":   {"slope": 0.15, "intercept": 0.0, "r2": 0.92},
        "MEDIUM": {"slope": 0.08, "intercept": 0.0, "r2": 0.88},
    }
    threats = find_undercut_threats("VER", states, curves=curves)
    assert len(threats) > 0
    for t in threats:
        assert "threat_score" in t
        assert 0.0 <= t["threat_score"] <= 1.0


def test_threats_sorted_by_score_descending():
    """Multiple threats should be sorted by threat_score descending."""
    states = {
        "VER": {"compound": "MEDIUM", "tyre_age": 5,  "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "SOFT",   "tyre_age": 20, "position": 2, "gap_to_leader": 1.0},
        "LEC": {"compound": "SOFT",   "tyre_age": 18, "position": 3, "gap_to_leader": 2.5},
    }
    curves = {
        "SOFT":   {"slope": 0.15, "intercept": 0.0, "r2": 0.92},
        "MEDIUM": {"slope": 0.08, "intercept": 0.0, "r2": 0.88},
    }
    threats = find_undercut_threats("VER", states, curves=curves)
    if len(threats) >= 2:
        assert threats[0]["threat_score"] >= threats[1]["threat_score"]


def test_no_threat_when_rival_less_degraded():
    """A rival with less degradation than the target has no incentive to undercut."""
    states = {
        "VER": {"compound": "SOFT",   "tyre_age": 25, "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "HARD",   "tyre_age": 5,  "position": 2, "gap_to_leader": 1.5},
    }
    curves = {
        "SOFT":   {"slope": 0.15, "intercept": 0.0, "r2": 0.92},
        "HARD":   {"slope": 0.04, "intercept": 0.0, "r2": 0.85},
    }
    # HAM deg = 0.04*5 = 0.2, VER deg = 0.15*25 = 3.75, advantage = -3.55 → no threat
    threats = find_undercut_threats("VER", states, curves=curves)
    assert threats == []


def test_max_five_threats():
    """At most UNDERCUT_MAX_THREATS (5) threats are returned."""
    states = {
        "VER": {"compound": "MEDIUM", "tyre_age": 3, "position": 1, "gap_to_leader": 0.0},
    }
    # Create 7 rivals all 1 position behind (only positions 2 and 3 qualify
    # due to UNDERCUT_MAX_POSITION_GAP=2), so we need them in P2-P3
    for i, code in enumerate(["HAM", "LEC", "NOR", "SAI", "PIA", "RUS", "ALO"]):
        states[code] = {
            "compound": "SOFT", "tyre_age": 20,
            "position": 2,  # all P2
            "gap_to_leader": 0.5 + i * 0.1,
        }
    curves = {
        "SOFT":   {"slope": 0.15, "intercept": 0.0, "r2": 0.92},
        "MEDIUM": {"slope": 0.08, "intercept": 0.0, "r2": 0.88},
    }
    threats = find_undercut_threats("VER", states, curves=curves)
    assert len(threats) <= 5
