# Error Catalog — F1 Pit Stop Strategy Optimizer

Reference for HTTP status codes, error response shapes, and per-module failure scenarios. Open this before writing route handlers in `main.py`.

---

## HTTP Status Code Policy

| Status | When to use |
|---|---|
| `400` | Bad request — caller sent an invalid parameter (year out of range, unrecognized compound) |
| `404` | Resource not found — FastF1 has no session for the given year/round |
| `422` | Unprocessable entity — FastAPI Pydantic validation failed (wrong type, missing field) |
| `503` | Upstream unavailable — OpenF1 is down, returning non-2xx, or timed out |
| `504` | Gateway timeout — FastF1 session load exceeded the 90-second timeout |
| `500` | Unexpected internal error — always log the stack trace; should be rare |

---

## Error Response Shape

All non-2xx responses return:
```json
{ "error": "human-readable description" }
```

Never include raw Python exception messages or tracebacks in the response body — they expose internal implementation details.

Define a minimal Pydantic model in `models.py`:
```python
class ErrorResponse(BaseModel):
    error: str
```

---

## Backend Error Catalog

### `ingestion.py`

| Scenario | How to handle | HTTP status | Message |
|---|---|---|---|
| `year` < 2018 or > current year | Raise `ValueError` in `load_session`, catch in route handler | `400` | `"Year must be between 2018 and {current_year}"` |
| `round_number` < 1 or > 24 | Raise `ValueError` in `load_session`, catch in route handler | `400` | `"Round number must be between 1 and 24"` |
| FastF1 finds no session (raises internally) | Catch `Exception` with message check, re-raise as `HTTPException(404)` | `404` | `"No session found for {year} round {round_number}"` |
| FastF1 session load exceeds 90s | Wrap `session.load()` in `asyncio.wait_for(timeout=90)`, catch `TimeoutError` | `504` | `"Session load timed out — try again"` |
| OpenF1 `/v1/stints` returns non-2xx | Catch `requests.HTTPError` | `503` | `"Live timing unavailable"` |
| OpenF1 request times out (> 5s) | Set `timeout=5` in `requests.get`, catch `requests.Timeout` | `503` | `"Live timing request timed out"` |

### `degradation.py`

| Scenario | How to handle | HTTP status | Message |
|---|---|---|---|
| `compound` not in `COMPOUNDS` set | Raise `ValueError` in `fit_curve`, catch in route handler | `400` | `"Unknown compound: {compound}"` |
| Fewer than 5 laps for a compound | Raise `ValueError` in `fit_curve`, catch in route handler | `422` | `"Insufficient data for {compound} — fewer than 5 laps available"` |
| R² < 0.5 | Log a warning, do not raise — return the result with the low R² value | — | `logger.warning("Low R² for {compound}: {r2:.2f}")` |

### `pit_window.py`

| Scenario | How to handle | HTTP status | Message |
|---|---|---|---|
| Circuit not in `PIT_LANE_LOSS` dict | Log a warning, fall back to `25.0` seconds — do not raise | — | `logger.warning("No pit loss data for {circuit}, using 25.0s fallback")` |
| Degradation curve missing for the driver's compound | Raise `KeyError`, catch in route handler | `422` | `"No degradation curve available for {compound}"` |

### `strategy.py`

| Scenario | How to handle | HTTP status | Message |
|---|---|---|---|
| Driver not found in the session DataFrame | Raise `ValueError`, catch in route handler | `404` | `"Driver {driver} not found in session data"` |

---

## Timeout Policy

| Operation | Timeout | Behaviour on timeout |
|---|---|---|
| FastF1 `session.load()` | 90 seconds | Return `504`, log error, do not cache a partial result |
| OpenF1 `requests.get()` | 5 seconds | Return `503`, log warning |
| uvicorn request handling | 120 seconds (default) | Return `503` |

---

## Route Handler Pattern

All route handlers follow this structure so errors are handled consistently:

```python
@app.get("/race/{year}/{round}/degradation")
def get_degradation(year: int, round: int):
    try:
        session = load_session(year, round)
        laps = get_laps(session)
        curves = fit_all_compounds(laps)
        return curves
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except KeyError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unexpected error in /race/%d/%d/degradation: %s", year, round, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
```

---

## Frontend Error Handling

All API calls in `lib/api.ts` use this pattern:
```typescript
const res = await fetch(url)
if (!res.ok) {
  const body = await res.json().catch(() => ({ error: "Unknown error" }))
  throw new Error(`API error ${res.status}: ${body.error}`)
}
return res.json()
```

Components catch errors at the page level (not inside the component tree) and display a red error banner. Never let an unhandled error produce a blank screen.

---

## What Not to Do

- Do not swallow exceptions inside `degradation.py` or `pit_window.py` — let them propagate to the route handler
- Do not expose Python tracebacks in response bodies — catch and translate all exceptions at the route level
- Do not retry FastF1 session loads automatically — they are slow and a timeout indicates a real problem; surface it to the caller
- Do not let OpenF1 failure break historical strategy queries — the two data paths are independent; a 503 from OpenF1 should not affect `/race/{year}/{round}/strategy/{driver}`
