# Data Contract — F1 Pit Stop Strategy Optimizer

Reference for all external API field names, types, edge cases, and internal DataFrame contracts. Open this before writing `ingestion.py`, `degradation.py`, or `rival_model.py`.

---

## FastF1 — `session.laps`

### Column reference

After calling `session.load()`, `session.laps` returns a DataFrame with the following columns relevant to this project:

| FastF1 column | Type | Notes |
|---|---|---|
| `Driver` | `str` | Three-letter abbreviation, always uppercase (e.g. `"VER"`, `"HAM"`) |
| `Compound` | `str` | Uppercase tyre name — `"SOFT"`, `"MEDIUM"`, `"HARD"`, `"INTERMEDIATE"`, `"WET"`, or `"UNKNOWN"` |
| `TyreLife` | `int` | Number of laps completed on this set of tyres at the end of this lap |
| `LapTime` | `Timedelta` | Lap duration as a pandas Timedelta — convert to float seconds with `.total_seconds()` |
| `Stint` | `int` | Stint number, 1-indexed — resets to 1 after each pit stop |
| `LapNumber` | `int` | Race lap number, 1-indexed |
| `IsAccurate` | `bool` | Whether the timing is reliable — `pick_quicklaps()` uses this internally |
| `TrackStatus` | `str` | `"1"` = green flag; `"2"` = yellow; `"4"` = safety car; `"6"` = VSC |

### FastF1 → internal column mapping

| FastF1 column | Internal column | Transformation |
|---|---|---|
| `Driver` | `driver` | None — already the right shape |
| `Compound` | `compound` | None — already uppercase |
| `TyreLife` | `tyre_age` | None — same value |
| `LapTime` | `lap_time` | `.total_seconds()` — convert Timedelta to float |
| `Stint` | `stint` | None |
| `LapNumber` | `lap_number` | None |

### What `pick_quicklaps()` removes

Call `session.laps.pick_quicklaps()` before extracting columns. It removes:
- Laps where `IsAccurate == False`
- Laps under safety car or VSC (`TrackStatus != "1"`)
- Formation/out-laps (first lap of each stint where `TyreLife == 1`)
- In-laps (final lap before a pit stop — anomalously slow)
- Statistically extreme outliers (lap times > 107% of the driver's median that stint)

Always verify the row count before and after: `print(session.laps.shape, session.laps.pick_quicklaps().shape)`.

### Edge cases

**Retired drivers** — Rows still appear up to the lap of retirement. The retirement lap's `LapTime` is typically `NaT` (null Timedelta). After calling `pick_quicklaps()` and converting to float seconds, call `.dropna(subset=["lap_time"])` to remove any remaining nulls.

**`UNKNOWN` compound** — FastF1 may return `"UNKNOWN"` for one or two laps at the start of a session before telemetry is confirmed. Filter these out: `df = df[df["compound"].isin(COMPOUNDS)]`.

**Timedelta to float** — `LapTime` is a pandas `Timedelta`, not a float. Never pass it directly to numpy. Always convert: `df["lap_time"] = df["LapTime"].dt.total_seconds()`.

**FastF1 version** — Pin `fastf1>=3.0` in `requirements.txt`. In FastF1 v2.x the column was named `TyreAge` (no space). v3+ uses `TyreLife`. Do not support v2.

**Slow first load** — First call to `session.load()` downloads and caches data; subsequent calls return from cache in <1s. Enable the cache at module level before any other call:
```python
fastf1.Cache.enable_cache(os.getenv("CACHE_DIR", "./cache"))
```

---

## OpenF1 — `/v1/stints`

Base URL from env: `OPENF1_BASE_URL` (default `https://api.openf1.org/v1`).

### Request parameters

| Parameter | Type | Notes |
|---|---|---|
| `session_key` | `int` | Unique session identifier — obtain from `/v1/sessions` |
| `driver_number` | `int` | Optional — omit to fetch all drivers |

### Response fields (per object in the array)

| Field | Type | Notes |
|---|---|---|
| `driver_number` | `int` | Permanent car number |
| `stint_number` | `int` | 1-indexed, resets each session |
| `lap_start` | `int` | First lap of this stint |
| `lap_end` | `int` or `null` | Last lap of this stint — `null` if the stint is still in progress |
| `compound` | `str` | Uppercase: `"SOFT"`, `"MEDIUM"`, `"HARD"`, `"INTERMEDIATE"`, `"WET"` |
| `tyre_age_at_start` | `int` | Number of laps the tyre had already been used before this session |

### Edge cases

**`lap_end` is null** — During a live session, the current stint has no end lap yet. Treat `null` as "still running". Do not raise an error or skip the row.

**Duplicate rows** — OpenF1 occasionally returns duplicate entries for the same stint (same `driver_number` + `stint_number`). Deduplicate before using: `pd.DataFrame(data).drop_duplicates(subset=["driver_number", "stint_number"])`.

**Early `UNKNOWN` compound** — May appear briefly at session start. Treat as null and exclude from rival tyre age calculations.

---

## OpenF1 — `/v1/laps`

### Response fields (per object in the array)

| Field | Type | Notes |
|---|---|---|
| `driver_number` | `int` | Permanent car number |
| `lap_number` | `int` | 1-indexed |
| `lap_duration` | `float` or `null` | Lap time in seconds — `null` for the current incomplete lap |
| `i1_speed` | `int` | Speed at intermediate 1 (km/h) |
| `i2_speed` | `int` | Speed at intermediate 2 (km/h) |
| `st_speed` | `int` | Speed trap at finish line (km/h) |
| `date_start` | `str` | ISO 8601 UTC timestamp of lap start |

### Edge cases

**`lap_duration` is null** — The current (incomplete) lap always returns null. Skip in any lap time calculations: `df = df[df["lap_duration"].notna()]`.

**First race lap** — `lap_number == 1` includes a rolling start and is anomalously long. Filter it out for degradation calculations: `df = df[df["lap_number"] > 1]`.

**Out-of-order delivery** — OpenF1 may return multiple entries per driver per lap when data arrives out of order. Deduplicate on `(driver_number, lap_number)` keeping the last received: `df = df.drop_duplicates(subset=["driver_number", "lap_number"], keep="last")`.

**5-second latency** — OpenF1 lags approximately 5 seconds behind real-world events. This is expected — do not treat it as an error.

---

## Internal DataFrame Contracts

These contracts govern what each module produces and consumes. Violating them will cause runtime errors downstream.

### `ingestion.py` output

The function `get_laps(session) -> pd.DataFrame` must return a DataFrame with exactly these columns:

| Column | Type | Guarantee |
|---|---|---|
| `driver` | `str` | Three-letter uppercase abbreviation, never null |
| `compound` | `str` | Always in `COMPOUNDS` set, never `"UNKNOWN"`, never null |
| `tyre_age` | `int` | Greater than 0 |
| `lap_time` | `float` | Seconds, greater than 0, no NaN |
| `stint` | `int` | Greater than 0 |
| `lap_number` | `int` | Greater than 0 |

No other columns should be passed downstream — drop everything else at the ingestion boundary.

### `degradation.py` input

The function `compute_delta(laps_df)` expects the ingestion output contract above, then adds:

| Column | Type | How it is computed |
|---|---|---|
| `lap_time_delta` | `float` | `lap_time` minus that driver's median `lap_time` for that stint |

Never pass raw `lap_time` to the curve fitting functions — the delta normalizes driver pace differences and is the only valid input.

### `rival_model.py` input

The function `build_driver_states(laps_df, current_lap)` expects:

| Column | Type | Source |
|---|---|---|
| `driver` | `str` | From ingestion output |
| `compound` | `str` | From ingestion output |
| `tyre_age` | `int` | From ingestion output |
| `position` | `int` | From OpenF1 `/v1/laps` position field — not in FastF1 data |
| `gap_to_leader` | `float` | From OpenF1 — seconds behind race leader |

The `position` and `gap_to_leader` columns must be joined from OpenF1 live data for live mode. For historical mode, derive position from lap number ordering within each lap.
