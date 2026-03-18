# Agents — F1 Pit Stop Strategy Optimizer

Instructions for any AI agent (Claude Code or otherwise) working on this codebase. Read CLAUDE.md first, then this file.

---

## Ground Rules

- Read ARCHITECTURE.md before touching any file — understand how modules relate before editing one
- Read CONVENTIONS.md before writing any code — naming, formatting, and style rules are non-negotiable
- Check TASKS.md for current build phase — do not implement features from a later phase if earlier phases are incomplete
- Never remove `fastf1.Cache.enable_cache('./cache')` — this is critical for performance
- Never add business logic to frontend components — all computation belongs in the backend

---

## Working on the Backend

### Before editing any module
1. Read the module's docstring to understand its contract
2. Identify which Pydantic models in `models.py` it produces or consumes
3. Check if any route in `main.py` depends on the function signature you're changing

### ingestion.py
- `load_session` must always check if the session is already cached before calling `session.load()`
- `get_laps` must always call `.pick_quicklaps()` to filter outlier laps — do not remove this
- Column names must match the required set in CONVENTIONS.md exactly
- If adding an OpenF1 endpoint, wrap the `requests.get` call in a try/except and return an empty list on failure — never let a live data failure crash a historical request

### degradation.py
- `fit_curve` must return R² alongside slope and intercept — callers depend on it for quality checks
- If R² < 0.5 for a compound, log a warning but still return the result — do not raise an exception
- `predict_delta` must handle `age=0` without division errors

### pit_window.py
- `calc_crossover` returns an integer lap number, not a float — always `round()` and cast to `int`
- If pit lane loss constant is missing for a circuit, fall back to `25.0` seconds and log a warning
- Net delta is positive when pitting is beneficial (you gain time), negative when staying out is better

### strategy.py
- `recommend` is the only function with permission to combine outputs from `pit_window` and `rival_model`
- The `reason` string must be human-readable — it surfaces directly in the dashboard UI
- Greedy decision rule: recommend pit if crossover is within 3 laps OR an undercut threat exists

### main.py
- Route handlers must be thin — one function call to the relevant module, then return the Pydantic model
- All routes return Pydantic models, never raw dicts
- CORS must allow the Vercel frontend origin in production

---

## Working on the Frontend

### Before editing any component
1. Check `lib/api.ts` to understand what data the component receives
2. Check the TypeScript interface for the prop shape — do not add untyped props
3. Do not add `fetch` calls inside components — use the functions in `lib/api.ts`

### DegradationChart.tsx
- Compound colours: SOFT = `#e8002d`, MEDIUM = `#ffd700`, HARD = `#ffffff`
- X-axis = tyre age (laps), Y-axis = lap time delta (seconds)
- Show a dot for each historical data point and a line for the fitted curve
- Custom tooltip must match dark theme — black background, no white borders

### PitWindowPanel.tsx
- Recommendation colour logic:
  - `recommend_pit === true` AND `crossover_lap <= current_lap + 2` → green (`#22c55e`)
  - `recommend_pit === true` AND `crossover_lap > current_lap + 2` → amber (`#f59e0b`)
  - `recommend_pit === false` → gray (`#888`)
- Display `net_delta` with a `+` prefix when positive (pitting gains time), `-` when negative

### RivalTable.tsx
- Sort by position ascending by default
- Highlight undercut threat rows with a subtle left border in `#e8002d`
- Tyre age column: bold if > 25 laps (high degradation risk threshold)

### lib/api.ts
- All functions must be `async` and return typed promises — no `any` return types
- Throw a descriptive `Error` on non-2xx responses — never silently return null
- Base URL comes from `process.env.NEXT_PUBLIC_API_URL` only

---

## Common Tasks

### Adding a new backend route
1. Add the Pydantic response model to `models.py`
2. Add the computation function to the appropriate module (not `main.py`)
3. Add a thin route handler to `main.py` that calls the function and returns the model
4. Add a typed fetch function to `frontend/lib/api.ts`

### Adding a new frontend component
1. Create `frontend/components/ComponentName.tsx`
2. Define the prop interface at the top of the file
3. Add a named export only — no default exports for components
4. Import and render it in the relevant page file

### Debugging a FastF1 data issue
1. Run `test_ingestion.py` first to confirm raw data loads correctly
2. Print the DataFrame `.dtypes` and `.head()` before filtering
3. Check that `pick_quicklaps()` is not filtering out too many laps (compare row count before and after)

### Debugging a Recharts rendering issue
1. `console.log` the data prop being passed to the chart
2. Confirm the `dataKey` strings in `<Line>` match the actual object keys
3. Check that the data array is not empty before rendering the chart (return a skeleton if empty)

---

## What Not to Do

- Do not call `session.load(telemetry=True)` unless you specifically need telemetry — it is much slower than a lap-only load
- Do not use `console.log` in production frontend code — use it during development then remove it
- Do not add new Python dependencies without adding them to `requirements.txt`
- Do not add new npm packages without a clear reason — keep the bundle lean
- Do not commit the `./cache/` directory — it can be hundreds of MB
