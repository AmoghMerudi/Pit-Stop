# Testing — F1 Pit Stop Strategy Optimizer

---

## Philosophy

Two tiers — keep them strictly separate:

1. **Unit tests** — fast, fully mocked, no external calls, run in under 10 seconds total. This is the pytest suite. Run these on every save.
2. **Integration smoke tests** — hit real FastF1 and OpenF1 APIs, take 30–90 seconds, run manually before each deploy. Never add these to the pytest suite.

If a pytest test takes more than 2 seconds, it is hitting a real API or loading a real session — fix it by mocking.

---

## Setup

Add to `backend/requirements.txt`:
```
pytest
pytest-mock
```

Run all unit tests:
```bash
cd backend
pytest tests/ -v
```

Run a specific module's tests:
```bash
pytest tests/test_degradation.py -v
```

---

## Mocking Strategy

### FastF1 sessions

Never mock FastF1 internals (`fastf1.get_session`, `session.load`). Instead, mock at your own module boundary — the `ingestion.load_session` function.

```python
def test_get_laps_drops_unknown_compound(mocker, sample_laps_df):
    mocker.patch("ingestion.load_session", return_value=None)
    # inject a DataFrame with an UNKNOWN compound row
    dirty = sample_laps_df.copy()
    dirty.loc[0, "compound"] = "UNKNOWN"
    mocker.patch("ingestion._extract_laps", return_value=dirty)
    result = get_laps(None)
    assert "UNKNOWN" not in result["compound"].values
```

### OpenF1 HTTP calls

Mock `requests.get` using `mocker.patch`. Return a mock with `.json()` returning fixture data and `.raise_for_status()` as a no-op.

```python
def test_get_live_stints_returns_empty_on_request_error(mocker):
    mock_get = mocker.patch("ingestion.requests.get")
    mock_get.return_value.raise_for_status.side_effect = Exception("connection refused")
    result = get_live_stints()
    assert result == []
```

---

## Fixtures (`tests/conftest.py`)

```python
import pytest
import pandas as pd

@pytest.fixture
def sample_laps_df():
    """Minimal valid laps DataFrame matching the ingestion output contract."""
    return pd.DataFrame({
        "driver":     ["VER", "VER", "VER", "VER", "VER",
                       "HAM", "HAM", "HAM", "HAM", "HAM"],
        "compound":   ["SOFT"] * 5 + ["MEDIUM"] * 5,
        "tyre_age":   [1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
        "lap_time":   [90.5, 90.8, 91.2, 91.6, 92.1,
                       91.0, 91.1, 91.3, 91.4, 91.6],
        "stint":      [1] * 10,
        "lap_number": [5, 6, 7, 8, 9, 5, 6, 7, 8, 9],
    })

@pytest.fixture
def sample_degradation_curves():
    """Pre-built curve dict matching the output of fit_all_compounds."""
    return {
        "SOFT":   {"slope": 0.15, "intercept": 0.0, "r2": 0.92},
        "MEDIUM": {"slope": 0.08, "intercept": 0.0, "r2": 0.88},
        "HARD":   {"slope": 0.04, "intercept": 0.0, "r2": 0.85},
    }

@pytest.fixture
def sample_driver_states():
    """Driver state dict as returned by rival_model.build_driver_states."""
    return {
        "VER": {"compound": "SOFT",   "tyre_age": 20, "position": 1, "gap_to_leader": 0.0},
        "HAM": {"compound": "MEDIUM", "tyre_age": 25, "position": 2, "gap_to_leader": 2.1},
        "LEC": {"compound": "HARD",   "tyre_age": 10, "position": 3, "gap_to_leader": 5.3},
    }
```

---

## Coverage Goals

| Module | What to test | What to skip |
|---|---|---|
| `ingestion.py` | Output column names and types match the contract; `UNKNOWN` compound is dropped; `NaN` lap times are dropped; OpenF1 error returns empty list without raising | Actual FastF1 session load |
| `degradation.py` | `fit_curve` returns `slope`, `intercept`, `r2` keys; `r2` is between 0 and 1; `predict_delta(age=0)` returns 0.0; unknown compound raises `ValueError`; fewer than 5 laps raises `ValueError` | Scipy numerical accuracy |
| `pit_window.py` | `crossover_lap` is an integer; missing circuit falls back to `25.0`; `net_delta` is positive when pitting is beneficial; `net_delta` sign is negative when not | Exact numerical values — use `pytest.approx` |
| `rival_model.py` | Undercut threat detected when rival is behind, tyre_age > yours + 5, gap < 3s; empty list returned when no rivals meet the threshold | Live OpenF1 calls |
| `strategy.py` | `recommend_pit == True` when crossover within 3 laps; `recommend_pit == False` when crossover > 3 laps away; `reason` is a non-empty string; unknown driver raises `ValueError` | Greedy algorithm edge cases |

---

## Test File Layout

```
backend/
└── tests/
    ├── conftest.py           # shared fixtures (sample_laps_df, sample_degradation_curves, etc.)
    ├── test_ingestion.py     # output contract, null handling, OpenF1 error fallback
    ├── test_degradation.py   # curve fitting output, edge cases, predict_delta
    ├── test_pit_window.py    # crossover calc, net_delta sign, circuit fallback
    ├── test_rival_model.py   # undercut/overcut detection with fixture data
    └── test_strategy.py      # recommend output shape, pit/no-pit decision
```

---

## Manual Smoke Tests (Run Before Deploy)

These hit real APIs. Do not run them in CI. Run them from the `backend/` directory.

**1. FastF1 cache verify**
```bash
python -c "
import fastf1, os
fastf1.Cache.enable_cache(os.getenv('CACHE_DIR', './cache'))
s = fastf1.get_session(2023, 1, 'R')
s.load()
print(s.laps.pick_quicklaps()[['Driver','Compound','TyreLife','LapTime']].head())
"
```
Expected: clean DataFrame with 4 columns, no NaT values, all compounds uppercase.

**2. Degradation model for 2023 Bahrain**
```bash
python -c "
from ingestion import load_session, get_laps
from degradation import fit_all_compounds
s = load_session(2023, 1)
curves = fit_all_compounds(get_laps(s))
print(curves)
assert curves['SOFT']['slope'] > curves['MEDIUM']['slope'], 'SOFT should degrade faster'
print('Slope ordering correct')
"
```
Expected: SOFT slope > MEDIUM slope > HARD slope, all R² > 0.5.

**3. Strategy endpoint via curl**
```bash
# Start backend first: uvicorn main:app --reload --port 8000
curl -s http://localhost:8000/race/2023/1/strategy/VER | python -m json.tool
```
Expected: JSON object with `recommend_pit` (bool), `reason` (string), `optimal_lap` (int).

---

## Frontend Testing

Not in scope for MVP. The frontend is render-only — all computation is in the backend. Test the frontend manually in the browser after each significant change. Playwright end-to-end tests are a V2 addition.
