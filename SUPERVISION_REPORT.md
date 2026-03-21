# Supervision Report — F1 Pit Stop Strategy Optimizer

Generated: 2026-03-21

This report is the output of a full read of every source file in both the backend and frontend. It covers module status, type consistency, convention violations, missing pieces, and recommended next steps.

---

## Backend Module Status

### `constants.py` — Complete

`COMPOUNDS` set and `PIT_LANE_LOSS` dict are present. `DEFAULT_PIT_LOSS = 25.0` is defined. All compound names in the set are uppercase strings matching the DATA_CONTRACT.md spec. 12 circuits covered. No issues.

### `ingestion.py` — Complete

All four required functions are implemented: `load_session`, `get_laps`, `get_live_stints`, `get_live_laps`.

Verified behaviour:
- `fastf1.Cache.enable_cache` is called at module level before any session load.
- `get_laps` calls `pick_quicklaps()`, converts `LapTime` to float seconds via `.dt.total_seconds()`, renames FastF1 columns to the internal snake_case contract, drops null `lap_time` rows, and filters out `UNKNOWN` compound.
- Output columns exactly match the DATA_CONTRACT.md ingestion output contract: `driver`, `compound`, `tyre_age`, `lap_time`, `stint`, `lap_number`.
- `get_live_stints` deduplicates on `(driver_number, stint_number)` as required.
- `get_live_laps` skips lap 1 (rolling start), skips null `lap_duration`, and deduplicates on `(driver_number, lap_number)` keeping last, as required.
- Both live functions return an empty list on any error and never raise, matching the AGENTS.md contract.

Minor issue: `CURRENT_YEAR` is hardcoded as `2025`. The year validation check `year > CURRENT_YEAR` will reject 2026 data even though the project's current date is 2026-03-21. The ERROR_CATALOG.md specifies the error message should use `{current_year}` dynamically. This works correctly at runtime since the constant is just `2025`, but will need updating when 2026 data is available.

### `degradation.py` — Complete

All four functions implemented: `compute_delta`, `fit_curve`, `fit_all_compounds`, `predict_delta`.

Verified behaviour:
- `compute_delta` groups by `["driver", "stint"]` and subtracts the median, matching DATA_CONTRACT.md requirement for per-driver per-stint normalisation.
- `fit_curve` raises `ValueError` for unknown compound and for fewer than `MIN_LAPS_FOR_FIT` (5) laps, matching ERROR_CATALOG.md.
- R² warning is logged (not raised) when R² < 0.5, matching AGENTS.md rule.
- `predict_delta` raises `KeyError` for a missing compound, matching ERROR_CATALOG.md.
- `fit_all_compounds` calls `compute_delta` if `lap_time_delta` column is absent, preventing a silent failure.

No issues found.

### `pit_window.py` — Complete

All three functions implemented: `calc_crossover`, `calc_net_delta`, `get_pit_window`.

Verified behaviour:
- `calc_crossover` always returns an `int` via `int(round(...))`, matching AGENTS.md rule.
- Returns `999` when slope <= 0 (tyre not degrading) rather than dividing by zero.
- Falls back to `DEFAULT_PIT_LOSS` and logs a warning when circuit is not in `PIT_LANE_LOSS`, matching AGENTS.md and ERROR_CATALOG.md.
- `net_delta` sign: positive when degradation cost exceeds pit loss (staying out costs more), matching convention.

Issue: `undercut_window` is `True` when `crossover_lap <= 3` and `overcut_window` is `True` when `crossover_lap > 3 and crossover_lap <= 8`. ARCHITECTURE.md defines the crossover threshold for undercut as "within 3 laps" but does not explicitly define 8 as the overcut boundary. The value `8` is a reasonable heuristic but is undocumented in any spec file. Not a bug, but should be documented in a comment or in CONVENTIONS.md.

`get_pit_window` helper is not required by a public helper in `get_pit_loss` — this is a private helper and is fine.

### `rival_model.py` — Complete

All three functions implemented: `build_driver_states`, `find_undercut_threats`, `find_overcut_opportunities`.

Verified behaviour:
- `build_driver_states` falls back to the most recent lap per driver if no rows match `current_lap`.
- `find_undercut_threats` checks all three criteria: rival is behind in position, tyre age gap >= `UNDERCUT_TYRE_AGE_GAP` (5), and gap < `UNDERCUT_GAP_THRESHOLD` (3.0s).
- Returns empty list for unknown driver rather than raising.
- `find_overcut_opportunities` correctly checks rival is ahead and has older tyres by threshold.

Issue: In `find_undercut_threats`, the gap closeness check compares `state["gap_to_leader"] - target["gap_to_leader"] < UNDERCUT_GAP_THRESHOLD`. For historical mode, `gap_to_leader` is `0.0` for all drivers (not joined from OpenF1). This means `0.0 - 0.0 = 0.0 < 3.0`, which is always `True`. As a result, the gap threshold criterion has no filtering effect in historical mode. All rivals with older tyres and a higher position number will be flagged as undercut threats regardless of actual gap. This is a logic gap for the historical strategy endpoint, though it does not cause a crash. The ARCHITECTURE.md states position must be derived from lap ordering in historical mode — the current implementation defaults position to `0` for all drivers, which makes the position check (`state["position"] > target["position"]`) always `False` (0 > 0 is False), so undercut threats are never reported in historical mode. These two zeroing effects cancel each other, but the logic is not working as intended.

### `strategy.py` — Complete

`recommend` function implemented, combining `get_pit_window` and `find_undercut_threats` (but not `find_overcut_opportunities`).

Verified behaviour:
- Raises `ValueError` when driver not in `driver_states`, matching ERROR_CATALOG.md.
- Greedy rule: `recommend_pit = True` when `crossover_lap <= 3` OR undercut threats exist, matching AGENTS.md.
- `reason` is a human-readable non-empty string in all branches.
- Returns all seven expected keys: `driver`, `recommend_pit`, `reason`, `optimal_lap`, `crossover_lap`, `net_delta`, `undercut_threats`.

Note: `find_overcut_opportunities` is imported in `rival_model.py` but is not used in `strategy.py`. The `recommend` function only checks undercut threats. Overcut opportunities influence the `reason` string via `window["overcut_window"]` but are not separately computed per driver. This is consistent with ARCHITECTURE.md's description but `find_overcut_opportunities` is never called anywhere in the production code path.

### `models.py` — Complete

All required Pydantic models are present: `ErrorResponse`, `DegradationCurve`, `PitWindowResult`, `DriverState`, `StrategyResponse`.

`StrategyResponse` includes all seven fields returned by `strategy.recommend`: `driver`, `recommend_pit`, `reason`, `optimal_lap`, `crossover_lap`, `net_delta`, `undercut_threats`.

Note: `PitWindowResult` and `DriverState` are defined in `models.py` but are not used by any route handler in `main.py`. `PitWindowResult` is a documented model but no route currently returns it directly (the pit window data is folded into `StrategyResponse`). `DriverState` is similarly unused. These are not errors but are dead Pydantic models.

### `main.py` — Complete with one gap

Five routes are implemented:
- `GET /` — health check
- `GET /race/{year}/{round_number}/degradation` — returns `list[DegradationCurve]`
- `GET /race/{year}/{round_number}/strategy/{driver}` — returns `StrategyResponse`
- `GET /live/laps` — returns raw OpenF1 laps list
- `GET /live/stints` — returns raw OpenF1 stints list
- `GET /live/strategy/{driver}` — returns `503` stub with explicit "not yet implemented" message

Gap: ARCHITECTURE.md specifies a `GET /race/{year}/{round}` route to load a historical race session and return session metadata. This route does not exist. `main.py` has no route at `/race/{year}/{round_number}` — only at `/race/{year}/{round_number}/degradation` and `/race/{year}/{round_number}/strategy/{driver}`. The frontend `lib/api.ts` also has no corresponding `getSession` function. See the Frontend section for a matching gap.

Error handling: All route handlers follow the ERROR_CATALOG.md pattern with `try/except ValueError`, `except KeyError`, `except HTTPException`, `except Exception` in order. The `get_strategy` route correctly maps "not found" in the ValueError message to a 404, matching ERROR_CATALOG.md.

One violation: `get_degradation` does not catch `KeyError`, which can be raised by `predict_delta` (called internally by `fit_curve` if the compound dict lookup fails). However, `predict_delta` is only called within `fit_curve` for compounds already filtered from the DataFrame, so in practice this path is not reachable. It is still a theoretical uncaught exception type.

CORS: Localhost:3000 is allowed. The Vercel production URL is commented out with a placeholder — this must be updated before deploy.

### `requirements.txt` — Complete

All required packages are present: `fastapi`, `uvicorn[standard]`, `fastf1>=3.0`, `pandas`, `scipy`, `numpy`, `requests`, `pydantic`, `python-dotenv`, `pytest`, `pytest-mock`.

No version pins beyond `fastf1>=3.0`. For production stability, consider pinning `fastapi`, `pandas`, and `scipy` to major versions.

---

## Backend Test Status

All five test files are present and match the layout specified in TESTING.md.

### `conftest.py` — Complete

Three fixtures match the TESTING.md spec exactly: `sample_laps_df`, `sample_degradation_curves`, `sample_driver_states`.

### `test_ingestion.py` — Complete

Seven tests cover: correct output columns, Timedelta-to-float conversion, `UNKNOWN` compound filtering, null lap time dropping, OpenF1 error returning empty list, timeout returning empty list, and deduplication.

All tests mock at the module boundary (not FastF1 internals), matching TESTING.md mocking strategy.

### `test_degradation.py` — Complete

Eight tests cover: `compute_delta` column addition, `fit_curve` output keys, R² bounds, unknown compound ValueError, insufficient laps ValueError, `fit_all_compounds` dict output, `predict_delta` at age 0, and `predict_delta` KeyError on missing compound.

### `test_pit_window.py` — Partial

Six tests cover: known circuit pit loss, unknown circuit fallback, None fallback, `calc_crossover` return type, `calc_crossover` KeyError on missing compound, `get_pit_window` output keys, and crossover integer type.

Missing per TESTING.md coverage goals: no test for `net_delta` being positive when pitting is beneficial, and no test for the sign being negative when staying out is better.

### `test_rival_model.py` — Complete

Six tests cover: undercut detected, no undercut when gap too large, no undercut when tyre age gap too small, empty return for unknown driver, overcut detected, overcut empty return for unknown driver.

### `test_strategy.py` — Complete

Five tests cover: required keys present, reason is non-empty string, `recommend_pit` is bool, ValueError for unknown driver, `recommend_pit` False when no window.

Missing per TESTING.md coverage goal: no explicit test for `recommend_pit == True` when crossover is within 3 laps (the existing fixture with VER on SOFT at tyre_age 20 happens to produce a result, but there is no dedicated test asserting the pit threshold rule).

---

## Frontend Component Status

### `app/page.tsx` — Complete

Race selector with year (2018–2025), round (1–24), and driver code inputs. Navigates to `/race/{year}-{round}-{DRIVER}` on submit. Uses `useRouter` from `next/navigation`. No direct `fetch` calls. Dark theme applied correctly with Tailwind utility classes matching CONVENTIONS.md colour shortcuts. Driver code forced to uppercase. Form validation via `required` attributes.

### `app/layout.tsx` — Complete

Sets metadata, applies Geist fonts, dark background on body. No issues.

### `app/race/[id]/page.tsx` — MISSING

This page does not exist. The directory `frontend/app/race/` does not exist. The main dashboard — which should fetch degradation and strategy data and render `DegradationChart`, `PitWindowPanel`, and `RivalTable` — has not been created. This is the most critical missing piece in the frontend.

### `components/DegradationChart.tsx` — Complete

Recharts `LineChart` implementation with compound colours matching AGENTS.md spec: SOFT `#e8002d`, MEDIUM `#ffd700`, HARD `#ffffff`. Also handles INTERMEDIATE and WET. Custom tooltip with dark theme. Curve data is computed from slope and intercept. Returns an empty state div if no curves provided. Uses named export only (no default export violation — wait, it does use `export default`, which CONVENTIONS.md says is acceptable for components but not utility functions).

Issue: AGENTS.md specifies "Show a dot for each historical data point and a line for the fitted curve." The current implementation only renders the fitted curve as a line with `dot={false}`. There are no raw historical data points plotted. The `DegradationCurve` interface only carries `slope`, `intercept`, `r2` — not raw lap points — so the backend does not provide the raw data needed to render dots. This is both a frontend and backend gap if the spec is to be followed literally.

CONVENTIONS.md says "No default exports for utility functions — named exports only." Components may use default exports. The component files all use `export default function`, which is consistent with Next.js page conventions. However, AGENTS.md says "Add a named export only — no default exports for components." This is a contradiction between AGENTS.md and component convention. All three components (`DegradationChart`, `PitWindowPanel`, `RivalTable`) use default exports, violating the AGENTS.md rule.

### `components/PitWindowPanel.tsx` — Partial

Displays driver, reason, crossover lap, net delta, optimal lap, undercut threats. Net delta uses `+` prefix when positive. Colour coding is present but does not match the AGENTS.md spec exactly.

AGENTS.md specifies:
- `recommend_pit === true` AND `crossover_lap <= current_lap + 2` → green `#22c55e`
- `recommend_pit === true` AND `crossover_lap > current_lap + 2` → amber `#f59e0b`
- `recommend_pit === false` → gray `#888`

Current implementation:
- `recommend_pit === true` → `text-[#00cc44]` (green, but wrong hex — `#00cc44` vs specified `#22c55e`)
- `strategy.crossover_lap <= 6` → `text-[#ffd700]` (amber-ish, but uses `#ffd700` which is the MEDIUM compound colour, not `#f59e0b`)
- else → `text-[#888]` (correct)

The colour logic does not use `current_lap` at all because the component does not receive it. The component receives only `StrategyResponse`, which includes `crossover_lap` but not `current_lap`. The AGENTS.md spec requires comparing `crossover_lap` to `current_lap + 2`, which is not possible without `current_lap` in the prop.

### `components/RivalTable.tsx` — Complete with minor issue

Sorts by position ascending. Highlights undercut threat rows with `border-l-[#e8002d]`. Tyre age > 25 laps is bolded. COMPOUND_COLOURS defined. Empty state not handled — if `rows` is empty, the table renders with headers but no rows (no explicit empty state message, though this is not technically a crash).

The `DriverRow` interface is defined locally inside the component file. This is fine per CONVENTIONS.md since it is local to the file.

Note: The `DriverRow` interface is not exported from `lib/api.ts` — it is a frontend-only type. This is appropriate since it is assembled by the dashboard page, but the dashboard page does not exist yet.

### `lib/api.ts` — Partial

All five fetch functions are present: `getDegradation`, `getStrategy`, `getLiveLaps`, `getLiveStints`, `getLiveStrategy`.

Missing: `getSession(year, round)` is absent. TASKS.md Phase 4 explicitly lists "Add `getSession(year, round)` fetch function" as a task. ARCHITECTURE.md lists `GET /race/{year}/{round}` as a route, and TASKS.md says to add the corresponding function. Since the backend route also does not exist (see `main.py` gap above), this is consistently missing on both sides.

Type verification against Pydantic models:

| TypeScript interface | Pydantic model | Match |
|---|---|---|
| `DegradationCurve { compound: string, slope: number, intercept: number, r2: number }` | `DegradationCurve(compound: str, slope: float, intercept: float, r2: float)` | Exact match |
| `StrategyResponse { driver: string, recommend_pit: boolean, reason: string, optimal_lap: number, crossover_lap: number, net_delta: number, undercut_threats: string[] }` | `StrategyResponse(driver: str, recommend_pit: bool, reason: str, optimal_lap: int, crossover_lap: int, net_delta: float, undercut_threats: list[str])` | Exact match |
| `LiveLap { driver_number: number, lap_number: number, lap_duration: number | null, i1_speed: number, i2_speed: number, st_speed: number, date_start: string }` | No Pydantic model — raw OpenF1 dict returned directly | No model mismatch, but backend returns raw dicts while frontend has typed interface |
| `LiveStint { driver_number: number, stint_number: number, lap_start: number, lap_end: number | null, compound: string, tyre_age_at_start: number }` | No Pydantic model — raw OpenF1 dict returned directly | Same as above |

`PitWindowResult` Pydantic model has no corresponding TypeScript interface — but no route returns it directly so this is not a gap in the API surface.

Error handling: `apiFetch` correctly implements the ERROR_CATALOG.md frontend pattern: checks `res.ok`, parses error body, throws descriptive error. Base URL comes from `process.env.NEXT_PUBLIC_API_URL` only.

Convention check: CONVENTIONS.md says all API functions must be `async` and return typed promises with no `any` return types. The functions in `lib/api.ts` use `apiFetch<T>` which is typed, but the exported functions are NOT marked `async` — they return the result of calling `apiFetch` (a Promise) directly. This works correctly at runtime but violates the CONVENTIONS.md requirement that "All functions must be `async`". The AGENTS.md example shows `export async function getStrategy(...)`.

---

## Convention Violations

### Backend

1. `main.py` does not catch `KeyError` in `get_degradation`. Unlikely to be triggered in practice but violates the ERROR_CATALOG.md route handler pattern which shows `except KeyError as e: raise HTTPException(status_code=422, ...)`.

2. `strategy.py` imports `find_overcut_opportunities` from `rival_model` but never calls it. Dead import.

3. `ingestion.py` has `CURRENT_YEAR = 2025` as a hardcoded constant. The year 2026 is now current but would be rejected as invalid input. Should use `datetime.date.today().year`.

### Frontend

4. All three components (`DegradationChart`, `PitWindowPanel`, `RivalTable`) use `export default function` instead of named exports. AGENTS.md rule: "Add a named export only — no default exports for components."

5. `lib/api.ts` exported functions are not marked `async`. AGENTS.md and CONVENTIONS.md both require `async`.

6. `PitWindowPanel.tsx` colour logic does not use `current_lap` for the amber threshold. AGENTS.md specifies `crossover_lap <= current_lap + 2` for green vs amber distinction.

7. `PitWindowPanel.tsx` uses `#00cc44` instead of `#22c55e` for green recommendation colour. AGENTS.md specifies `#22c55e`.

8. `PitWindowPanel.tsx` uses `#ffd700` for amber recommendation colour instead of `#f59e0b`. AGENTS.md specifies `#f59e0b`.

9. `DegradationChart.tsx` renders only the fitted curve line. AGENTS.md specifies: "Show a dot for each historical data point and a line for the fitted curve." Raw data points are not passed from the backend.

10. `CONVENTIONS.md` specifies a `.prettierrc` config should exist in the frontend. No `.prettierrc` file was found.

---

## Gaps vs Architecture / Tasks

### Missing backend route

`GET /race/{year}/{round}` — defined in ARCHITECTURE.md, listed in TASKS.md Phase 1 FastAPI stub, but not implemented in `main.py`. The frontend page at `/race/[id]` would need to call this to fetch session metadata (e.g. circuit name, event name) for display.

### Missing frontend page

`app/race/[id]/page.tsx` — the main dashboard page. This is the central view of the application. It must parse the `id` param (format `{year}-{round}-{driver}`), call `getDegradation` and `getStrategy`, and render `DegradationChart`, `PitWindowPanel`, and `RivalTable`. Without this page, the race selector form on `app/page.tsx` navigates to a 404.

### Missing frontend component

`LiveTicker.tsx` — defined in ARCHITECTURE.md and TASKS.md Phase 5. Not yet created. This is Phase 5 (live mode) so it is not blocking Phase 4 completion, but it is an unbuilt component.

### Missing loading and error states

TASKS.md Phase 4 lists: "Add loading skeleton state to dashboard page" and "Add error state for API failures." These cannot be built until the dashboard page exists.

### `getSession` function in `lib/api.ts`

TASKS.md explicitly lists "Add `getSession(year, round)` fetch function." This is absent from `lib/api.ts`. This aligns with the missing `/race/{year}/{round}` backend route.

### `.env` / `.env.local` files

TASKS.md lists "Create `backend/.env`" and "Create `frontend/.env.local`." These are not committed (correctly — they are in `.gitignore`), but they must exist locally for the project to run.

### `.gitignore`

TASKS.md lists "Add `.gitignore`". A `.gitignore` file was not found in the root. If one exists it was not readable; however the `cache/`, `.env`, `__pycache__/`, `.venv/`, `node_modules/` directories should be excluded.

### `data/` column in `rival_model.py`

DATA_CONTRACT.md specifies `rival_model.build_driver_states` requires `position` and `gap_to_leader` columns from OpenF1 for live mode. In historical mode the spec says to "derive position from lap number ordering within each lap." The current implementation uses `row.get("position", 0)` which defaults to `0` for all drivers in historical mode. Position ordering is not derived from lap data. This means all drivers have `position = 0` in historical mode, making the position-based undercut/overcut detection non-functional.

---

## Type Mismatch Summary

No hard type mismatches between existing Pydantic models and TypeScript interfaces. The two matching model pairs (`DegradationCurve` and `StrategyResponse`) are exact matches in field names and compatible types (Python `float`/`int` maps to TypeScript `number`, Python `bool` maps to `boolean`, Python `list[str]` maps to `string[]`).

The `LiveLap` and `LiveStint` TypeScript interfaces have no corresponding Pydantic models in the backend — the `/live/laps` and `/live/stints` routes return raw OpenF1 dicts. The TypeScript interfaces correctly describe the expected OpenF1 response shape per DATA_CONTRACT.md, so this is not a mismatch but a documentation gap on the backend side.

---

## TASKS.md Checklist Assessment

### Phase 1 — Data Foundation

| Task | Status |
|---|---|
| Create repo on GitHub | Cannot verify — no remote check performed |
| Create `backend/` and `frontend/` directories | Done |
| Add `.gitignore` | Not confirmed present |
| Create `backend/requirements.txt` | Done |
| Create `backend/.env` | Cannot verify (not committed) |
| Set up Python virtual environment | Cannot verify |
| Create `backend/ingestion.py` | Done |
| `fastf1.Cache.enable_cache` at module level | Done |
| Implement `load_session` | Done |
| Implement `get_laps` | Done |
| Implement `get_live_stints` | Done |
| Implement `get_live_laps` | Done |
| Write `test_ingestion.py` | Done |
| Create `backend/main.py` with FastAPI app, CORS, health check | Done |
| Create `backend/models.py` with placeholder Pydantic models | Done |

### Phase 2 — Degradation Model

| Task | Status |
|---|---|
| Create `backend/degradation.py` | Done |
| Implement `compute_delta` | Done |
| Implement `fit_curve` | Done |
| Implement `fit_all_compounds` | Done |
| Implement `predict_delta` | Done |
| Add `DegradationCurve` Pydantic model to `models.py` | Done |
| Add `GET /race/{year}/{round}/degradation` route | Done |
| Manual test: 2023 Bahrain slope ordering | Not verifiable from code review |

### Phase 3 — Pit Window + Strategy

| Task | Status |
|---|---|
| Create `backend/constants.py` | Done |
| Add `PIT_LANE_LOSS` dict | Done |
| Create `backend/pit_window.py` | Done |
| Implement `calc_crossover` | Done |
| Implement `calc_net_delta` | Done |
| Implement `get_pit_window` | Done |
| Add `PitWindowResult` Pydantic model | Done |
| Create `backend/rival_model.py` | Done |
| Implement `build_driver_states` | Done |
| Implement `find_undercut_threats` | Done |
| Implement `find_overcut_opportunities` | Done |
| Create `backend/strategy.py` | Done |
| Implement `recommend` | Done |
| Add `StrategyResponse` Pydantic model | Done |
| Add `GET /race/{year}/{round}/strategy/{driver}` route | Done |
| Add `GET /live/strategy/{driver}` route | Done (stub, returns 503) |
| Manual test: VER strategy in 2023 Bahrain | Not verifiable from code review |

### Phase 4 — Frontend Shell

| Task | Status |
|---|---|
| Run `npx create-next-app` | Done (project exists) |
| Install Recharts | Done (`recharts` in dependencies) |
| Create `frontend/.env.local` | Cannot verify (not committed) |
| Set Tailwind base colours | Done (inline in components) |
| Create `frontend/lib/api.ts` | Done |
| Add `getSession(year, round)` | NOT DONE |
| Add `getDegradation(year, round)` | Done |
| Add `getStrategy(year, round, driver)` | Done |
| Add `getLiveLaps()` | Done |
| Add `getLiveStrategy(driver)` | Done |
| Define all response TypeScript interfaces | Done (partial — `getSession` type missing) |
| Build `app/page.tsx` | Done |
| Build `app/race/[id]/page.tsx` | NOT DONE |
| Build `DegradationChart.tsx` | Done (partial — no raw data dots) |
| Style DegradationChart with dark background, compound colours | Done |
| Build `PitWindowPanel.tsx` | Done (partial — colour spec violations) |
| Colour-code PitWindowPanel | Done (partial — wrong hex values) |
| Build `RivalTable.tsx` | Done |
| Add loading skeleton state | NOT DONE |
| Add error state for API failures | NOT DONE |

### Phase 5 — Live Mode

| Task | Status |
|---|---|
| Build `LiveTicker.tsx` | NOT DONE |
| Flash animation on LiveTicker | NOT DONE |
| Add mode toggle (Historical / Live) | NOT DONE |
| Wire toggle to switch endpoints | NOT DONE |
| Test live mode | NOT DONE |

### Phase 6 — Polish + Deploy

All tasks: NOT DONE

---

## Recommended Next Steps

Priority order:

1. **Create `app/race/[id]/page.tsx`** — This is the most critical missing piece. The application is non-functional without it. The page must parse the `id` param as `{year}-{round}-{driver}`, call `getDegradation` and `getStrategy` in parallel, handle loading and error states, and render all three components.

2. **Fix `CURRENT_YEAR` in `ingestion.py`** — Change `CURRENT_YEAR = 2025` to use `datetime.date.today().year`. This prevents valid 2026 race queries from being rejected.

3. **Fix historical mode position derivation in `rival_model.py`** — `build_driver_states` should derive driver position from lap ordering when `position` is not in the DataFrame, not default to `0`. This would make undercut/overcut detection functional in historical mode.

4. **Add `async` keyword to exported functions in `lib/api.ts`** — Minor but required by CONVENTIONS.md and AGENTS.md. Change `export function getDegradation(...)` to `export async function getDegradation(...)` etc.

5. **Fix `PitWindowPanel.tsx` colour logic** — Update green hex to `#22c55e`, amber hex to `#f59e0b`, and add `current_lap` prop to enable the `crossover_lap <= current_lap + 2` threshold check.

6. **Fix component default exports** — AGENTS.md requires named exports for components. Change all three components from `export default function` to named exports and update any imports.

7. **Add `GET /race/{year}/{round}` backend route** and corresponding `getSession` in `lib/api.ts`.

8. **Add `KeyError` catch to `get_degradation` in `main.py`** — Follow the ERROR_CATALOG.md route handler pattern exactly.

9. **Remove dead import** `find_overcut_opportunities` from `strategy.py` or integrate it into the recommendation logic.

10. **Add `.gitignore`** at the repository root if not already present.

11. **Add `.prettierrc`** to the frontend directory per CONVENTIONS.md.

12. **Add missing `test_pit_window.py` tests** for `net_delta` sign correctness.

13. **Add missing `test_strategy.py` test** for explicit pit-within-3-laps decision.

14. **Build `LiveTicker.tsx`** — Phase 5. Not blocking Phase 4, but required for live mode.

15. **Update CORS** in `main.py` with the Vercel production URL before deploying.
