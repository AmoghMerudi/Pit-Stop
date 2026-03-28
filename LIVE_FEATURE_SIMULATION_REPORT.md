# Live Feature Simulation Report

**Date:** 2026-03-28
**Branch:** `claude/simulate-live-feature-2dUUX`
**Simulated against:** 2024 R1 Bahrain benchmark curves, mock mid-race data (lap 25/57), and all live API endpoints

---

## 1. Endpoints Tested

| Endpoint | Status | Response (no live session) |
|---|---|---|
| `GET /live/session` | 200 | `active: false`, all fields null |
| `GET /live/grid` | 200 | `[]` empty array |
| `GET /live/laps` | 200 | `[]` empty array |
| `GET /live/stints` | 200 | `[]` empty array |
| `GET /live/tyre-prediction` | 200 | `[]` empty array |
| `GET /live/strategy/VER` | 422 | `"No active live session"` |
| `POST /live/manual-strategy` | 200 | Full strategy response |

All endpoints handle the no-session case gracefully — no crashes, correct HTTP codes.

---

## 2. Manual Strategy: Normal Scenarios

Tested 10 scenarios (VER/HAM/NOR across SOFT/MEDIUM/HARD at various race stages):

```
Driver Compound Age Lap Pit?   Crossover    Delta Best Alt  Confidence  Reason
VER    SOFT       5   5 no            19    189.6 HARD           0.00  Stay out — pit window in ~13 laps
VER    SOFT      18  18 YES            9    180.7 MEDIUM         0.00  Pit now onto MEDIUM — saves 180.7s
VER    MEDIUM     5   5 no           999     61.9 HARD           0.00  Stay out — tyre showing minimal degradation
VER    MEDIUM    20  20 no            14     86.4 HARD           0.00  Consider pitting in 3 lap(s)
VER    MEDIUM    35  35 YES            7     73.5 HARD           0.00  Pit now onto HARD
VER    HARD      10  10 no           999    -12.6 WET            0.00  Stay out — tyre showing minimal degradation
VER    HARD      30  30 no            16     21.6 WET            0.00  Consider pitting in 2 lap(s)
VER    HARD      48  48 YES            9      1.3 SOFT           0.00  Pit now onto SOFT
HAM    MEDIUM    20  20 no            14     86.4 HARD           0.00  Consider pitting in 3 lap(s)
NOR    SOFT      15  15 no            11    174.6 MEDIUM         0.00  Consider pitting in 3 lap(s)
```

Pit trigger progression for MEDIUM compound matches expected F1 behavior:
- Laps 1–12: "Stay out — minimal degradation"
- Laps 13–18: "pit window in ~N laps"
- Laps 19–21: "consider pitting in N lap(s)"
- Lap 22+: "Pit now" (recommend_pit=True)

---

## 3. Edge Case Testing

| Scenario | HTTP Code | Result |
|---|---|---|
| SOFT on lap 50 (past tyre life) | 200 | Correctly recommends pit |
| HARD on lap 58 (past race end) | 200 | Says stay out (bad — race is over) |
| Unknown driver `XXX` | 200 | Falls back to benchmarks, recommends normally |
| Invalid compound `SUPER_SOFT` | 400 | `"Unknown compound: SUPER_SOFT"` |
| Negative `tyre_age=-5` | 400 | `"tyre_age must be >= 0"` |
| Non-existent round 99 | 400 | `"Round must be between 1 and 24"` |

---

## 4. Bugs Found

### BUG-1 (HIGH): Tyre Age Always 0 for Active Stints
**File:** `rival_model.py:235-238`

```python
# CURRENT CODE
tyre_age = int(stint.get("tyre_age_at_start", 0))
if stint.get("lap_end") is not None and stint.get("lap_start") is not None:
    tyre_age = tyre_age + int(stint["lap_end"]) - int(stint["lap_start"])
```

OpenF1 returns `lap_end=None` for the **currently active stint**. The condition `lap_end is not None` is always `False` for the current stint, so `tyre_age` is stuck at `tyre_age_at_start` — i.e., zero at the start of the race.

**Observed impact with mock data (lap 25):**

| Driver | Expected Tyre Age | Actual Tyre Age |
|---|---|---|
| VER (MEDIUM from lap 1) | 25 | **0** |
| PER (MEDIUM from lap 1) | 25 | **0** |
| HAM (MEDIUM from lap 15) | 10 | 14 (close — used second stint start which happened to have SOFT laps before) |
| LEC (HARD, tyre_age_at_start=3) | 25 | **3** |
| RUS (SOFT from lap 1) | 25 | **0** |

This causes the strategy engine to recommend pit for drivers on "fresh" 0-lap tyres and gives completely wrong crossover calculations and rival threat assessments.

**Strategy difference — VER at lap 25:**

| Tyre Age Used | RecPit | Crossover | Delta | Best Alt |
|---|---|---|---|---|
| Correct (25) | YES | 11 | +86.5s | HARD |
| Buggy (0) | YES | 999 | -7.1s | HARD |

The buggy result says "pit saves -7.1s" (a loss), so the UI would show a contradictory `recommend_pit=True` with a negative delta.

### BUG-2 (MEDIUM): `best_alt=WET` in Dry Conditions
**File:** `strategy.py` / `pit_window.py`

HARD compound at low tyre age consistently returns `best_alt=WET`:

```
HARD age=5:  best_alt=WET, net_delta=-30.5
HARD age=15: best_alt=WET, net_delta=1.5
HARD age=30: best_alt=WET, net_delta=21.6
```

The benchmark degradation model for WET has an unusually low slope (likely from wet race data), which makes it appear faster than SOFT in degradation-only comparisons for dry races. WET should be excluded from `best_alt` candidates when conditions are dry.

### BUG-3 (MEDIUM): `best_alt=None` Not Handled
When staying out is optimal, `best_alt` is `None`. Frontend TypeScript interface defines `best_alt: string`, which will cause a runtime type mismatch. Observed in the compound-at-same-stage comparison:

```
HARD  10  30 no   999  -10.7 None   ← best_alt is Python None
```

### BUG-4 (MEDIUM): Post-Race Lap Numbers Not Rejected
`current_lap=58` with `total_laps=57` returns 200 with a "stay out" recommendation instead of rejecting the request. The system should return an error or at minimum clamp `current_lap` to `total_laps`.

### BUG-5 (LOW): Unknown Driver Falls Through to Benchmark Silently
`driver=XXX` returns a valid strategy response using benchmark curves instead of a 400 error. This masks misconfigured frontend calls.

### BUG-6 (LOW): `degradation_confidence` Always 0.0 in Manual Strategy
The `/live/manual-strategy` endpoint hardcodes `degradation_confidence=0.0` (`main.py:441`). This is expected (no live Bayesian update here), but the frontend shows confidence as a metric tile — users will always see 0% confidence, which looks broken.

---

## 5. Rival Model Analysis

With correctly set tyre ages, undercut threat detection works as expected:

```
Driver Compound Age Pos  RecPit  Crossover  Delta  BestAlt  Threats
VER    MEDIUM    25   1  YES     11         +86.5  HARD     []
PER    MEDIUM    25   2  YES     11         +86.5  HARD     []
HAM    SOFT      10   3  YES     14         +77.9  HARD     [RUS]   ← RUS threat detected
LEC    HARD      28   4  YES     18         +26.6  WET      [RUS]   ← WET bug visible here
RUS    SOFT      25   5  YES     7          +183.9 MEDIUM   []
```

HAM correctly identifies RUS (on 25-lap SOFT behind him) as an undercut threat.

However, **all 5 drivers get `recommend_pit=YES` simultaneously** at lap 25 — a clean "traffic jam" scenario. The strategy logic doesn't account for track position, pit traffic, or that pitting everyone at the same time would cost track position. This is by design (each driver's strategy is computed independently), but it's worth noting.

---

## 6. Polling & Frontend Behavior (No Live Session)

Simulated frontend poll cycle:
- `/live/session` → `active=false`
- `/live/grid` → `[]`
- `/live/tyre-prediction` → `[]`

Frontend correctly renders "No active race session" state. No crashes, no undefined access.

The `LiveSessionBadge` polling `/live/laps` every 10s and `LiveTicker` polling every 15s would both receive `[]` and display the inactive state correctly.

---

## 7. OpenF1 Connectivity

Direct OpenF1 API was unreachable from this environment (network restrictions). The backend's `get_live_session_info()` correctly returned `active=false` and empty arrays for all live data endpoints rather than raising exceptions — confirming the timeout/fallback path in `ingestion.py` works.

---

## 8. Summary

| Category | Count |
|---|---|
| Endpoints tested | 7 |
| Scenarios run | 10 normal + 6 edge cases |
| Tyre age progressions analyzed | 18 data points |
| Confirmed bugs | 6 |
| Critical (blocking correctness) | 1 (BUG-1: tyre age always 0) |
| Medium severity | 3 (BUG-2, BUG-3, BUG-4) |
| Low severity | 2 (BUG-5, BUG-6) |

The most impactful fix is **BUG-1 in `rival_model.py`**: adding `current_lap - lap_start` to `tyre_age` when `lap_end is None` would make all live strategy calculations accurate. Everything else is functional but produces misleading output in edge cases.
