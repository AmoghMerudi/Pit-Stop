# Tasks — F1 Pit Stop Strategy Optimizer

Granular checklist. Check off as you go. Ordered by dependency — do not skip ahead.

---

## Phase 1 — Data Foundation

### Setup
- [ ] Create repo `pit-stop-optimizer` on GitHub
- [x] Create `backend/` and `frontend/` directories
- [ ] Add `.gitignore` — include `cache/`, `.env`, `__pycache__/`, `.venv/`, `node_modules/`
- [x] Create `backend/requirements.txt` with: `fastapi uvicorn fastf1 pandas scipy numpy requests pydantic python-dotenv`
- [ ] Create `backend/.env` with `OPENF1_BASE_URL` and `CACHE_DIR=./cache`
- [ ] Set up Python virtual environment

### ingestion.py
- [x] Create `backend/ingestion.py`
- [x] Call `fastf1.Cache.enable_cache('./cache')` at module level
- [x] Implement `load_session(year, round_number) -> fastf1.Session`
- [x] Implement `get_laps(session) -> pd.DataFrame` — filter to quicklaps, required columns only
- [x] Implement `get_live_stints() -> list[dict]` — hits OpenF1 `/v1/stints`
- [x] Implement `get_live_laps() -> list[dict]` — hits OpenF1 `/v1/laps`
- [x] Write `test_ingestion.py` — load 2023 R1, print laps head, confirm cache works (see TESTING.md for mock strategy and fixtures)

### FastAPI stub
- [x] Create `backend/main.py` with FastAPI app, CORS middleware, and health check `GET /`
- [x] Create `backend/models.py` with placeholder Pydantic models

---

## Phase 2 — Degradation Model

### degradation.py
- [x] Create `backend/degradation.py`
- [x] Implement `compute_delta(laps_df) -> pd.DataFrame` — adds `lap_time_delta` column
- [x] Implement `fit_curve(laps_df, compound) -> dict` — returns `{ slope, intercept, r2 }`
- [x] Implement `fit_all_compounds(laps_df) -> dict[str, dict]` — runs fit for all compounds present
- [x] Implement `predict_delta(compound, age, curves) -> float`
- [x] Add `DegradationCurve` Pydantic model to `models.py`
- [x] Add `GET /race/{year}/{round}/degradation` route to `main.py`
- [ ] Manual test: 2023 Bahrain, confirm SOFT slope > MEDIUM slope > HARD slope (see TESTING.md — Manual Smoke Tests)

---

## Phase 3 — Pit Window + Strategy

### constants.py
- [x] Create `backend/constants.py`
- [x] Add `PIT_LANE_LOSS` dict — pit lane time loss in seconds for top 10 circuits

### pit_window.py
- [x] Create `backend/pit_window.py`
- [x] Implement `calc_crossover(current_age, compound, pit_loss, curves) -> int`
- [x] Implement `calc_net_delta(current_age, compound, pit_loss, curves) -> float`
- [x] Implement `get_pit_window(driver_state, curves, pit_loss) -> dict` — returns `undercut_window`, `overcut_window`, `crossover_lap`, `net_delta`
- [x] Add `PitWindowResult` Pydantic model to `models.py`

### rival_model.py
- [x] Create `backend/rival_model.py`
- [x] Implement `build_driver_states(laps_df, current_lap) -> dict[str, dict]`
- [x] Implement `find_undercut_threats(driver, driver_states) -> list[str]`
- [x] Implement `find_overcut_opportunities(driver, driver_states) -> list[str]`

### strategy.py
- [x] Create `backend/strategy.py`
- [x] Implement `recommend(driver, driver_states, curves, pit_loss) -> dict` — returns `recommend_pit`, `reason`, `optimal_lap`
- [x] Add `StrategyResponse` Pydantic model to `models.py`
- [x] Add `GET /race/{year}/{round}/strategy/{driver}` route to `main.py`
- [x] Add `GET /live/strategy/{driver}` route to `main.py`
- [ ] Manual test: query strategy for VER in 2023 Bahrain, verify output shape (see TESTING.md — Manual Smoke Tests)

---

## Phase 4 — Frontend Shell

### Setup
- [ ] Run `npx create-next-app@latest frontend --typescript --tailwind --app`
- [ ] Install Recharts: `npm install recharts`
- [ ] Create `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8000`
- [ ] Set Tailwind base colours in `tailwind.config.ts`

### lib/api.ts
- [x] Create `frontend/lib/api.ts`
- [ ] Add `getSession(year, round)` fetch function
- [x] Add `getDegradation(year, round)` fetch function
- [x] Add `getStrategy(year, round, driver)` fetch function
- [x] Add `getLiveLaps()` fetch function
- [x] Add `getLiveStrategy(driver)` fetch function
- [x] Define all response TypeScript interfaces

### Pages
- [x] Build `app/page.tsx` — race selector with year, round, driver inputs
- [ ] Build `app/race/[id]/page.tsx` — fetch data on load, render component grid

### Components
- [x] Build `DegradationChart.tsx` — Recharts LineChart, one series per compound
- [x] Style with dark background, compound colours (red/yellow/white for S/M/H)
- [x] Build `PitWindowPanel.tsx` — card with crossover lap, net delta, recommendation
- [ ] Colour-code: green (pit now), amber (pit soon), gray (stay out) — colours present but wrong hex values and missing current_lap logic
- [x] Build `RivalTable.tsx` — all drivers, compound, tyre age, threat flag columns
- [ ] Add loading skeleton state to dashboard page
- [ ] Add error state for API failures

---

## Phase 5 — Live Mode

- [ ] Build `LiveTicker.tsx` — `setInterval` poll every 2s, displays current lap
- [ ] Flash animation on LiveTicker when data updates
- [ ] Add mode toggle (Historical / Live) to dashboard
- [ ] Wire toggle to switch between historical strategy endpoint and live strategy endpoint
- [ ] Test live mode against a recent race or OpenF1 replay

---

## Phase 6 — Polish + Deploy

### Polish
- [ ] Audit all components for consistent dark theme
- [ ] Add loading skeletons to all data-dependent panels
- [ ] Confirm error states render cleanly — no blank screens
- [ ] Add favicon (F1 flag or custom)
- [ ] Write `README.md` — description, setup, architecture, screenshot

### Deploy

See DEPLOY.md for full step-by-step instructions, environment variable values, CORS config, and the smoke test checklist.

- [ ] Create Railway project, connect GitHub repo, set start command to `uvicorn main:app --host 0.0.0.0 --port $PORT`
- [ ] Set `OPENF1_BASE_URL=https://api.openf1.org/v1` and `CACHE_DIR=/tmp/f1cache` in Railway env vars
- [ ] Confirm backend health check returns 200 from Railway URL
- [ ] Import project to Vercel, set root directory to `frontend`, deploy frontend
- [ ] Set `NEXT_PUBLIC_API_URL` to Railway backend URL in Vercel env vars
- [ ] Add Vercel origin to CORS `allow_origins` list in `main.py`
- [ ] Complete DEPLOY.md smoke test checklist on a clean browser
- [ ] Add Vercel URL to GitHub repo description and resume

**Done when**: Vercel link works end-to-end on a fresh browser with no local backend running.

---

## V2 Ideas (Post-MVP)

- Safety car / VSC handling — detect SC laps from FastF1 and re-run strategy from that lap
- Weather integration — adjust degradation slope for wet compounds dynamically
- Driver rating system — second F1 project, reuses FastF1 pipeline
- Multiple driver comparison view
- Playwright end-to-end tests for frontend
- Persistent FastF1 cache via Railway Volume (survives redeploys)
