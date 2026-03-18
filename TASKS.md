# Tasks — F1 Pit Stop Strategy Optimizer

Granular checklist. Check off as you go. Ordered by dependency — do not skip ahead.

---

## Phase 1 — Data Foundation

### Setup
- [ ] Create repo `pit-stop-optimizer` on GitHub
- [ ] Create `backend/` and `frontend/` directories
- [ ] Add `.gitignore` — include `cache/`, `.env`, `__pycache__/`, `.venv/`, `node_modules/`
- [ ] Create `backend/requirements.txt` with: `fastapi uvicorn fastf1 pandas scipy numpy requests pydantic python-dotenv`
- [ ] Create `backend/.env` with `OPENF1_BASE_URL` and `CACHE_DIR=./cache`
- [ ] Set up Python virtual environment

### ingestion.py
- [ ] Create `backend/ingestion.py`
- [ ] Call `fastf1.Cache.enable_cache('./cache')` at module level
- [ ] Implement `load_session(year, round_number) -> fastf1.Session`
- [ ] Implement `get_laps(session) -> pd.DataFrame` — filter to quicklaps, required columns only
- [ ] Implement `get_live_stints() -> list[dict]` — hits OpenF1 `/v1/stints`
- [ ] Implement `get_live_laps() -> list[dict]` — hits OpenF1 `/v1/laps`
- [ ] Write `test_ingestion.py` — load 2023 R1, print laps head, confirm cache works

### FastAPI stub
- [ ] Create `backend/main.py` with FastAPI app, CORS middleware, and health check `GET /`
- [ ] Create `backend/models.py` with placeholder Pydantic models

---

## Phase 2 — Degradation Model

### degradation.py
- [ ] Create `backend/degradation.py`
- [ ] Implement `compute_delta(laps_df) -> pd.DataFrame` — adds `lap_time_delta` column
- [ ] Implement `fit_curve(laps_df, compound) -> dict` — returns `{ slope, intercept, r2 }`
- [ ] Implement `fit_all_compounds(laps_df) -> dict[str, dict]` — runs fit for all compounds present
- [ ] Implement `predict_delta(compound, age, curves) -> float`
- [ ] Add `DegradationCurve` Pydantic model to `models.py`
- [ ] Add `GET /race/{year}/{round}/degradation` route to `main.py`
- [ ] Manual test: 2023 Bahrain, confirm SOFT slope > MEDIUM slope > HARD slope

---

## Phase 3 — Pit Window + Strategy

### constants.py
- [ ] Create `backend/constants.py`
- [ ] Add `PIT_LANE_LOSS` dict — pit lane time loss in seconds for top 10 circuits

### pit_window.py
- [ ] Create `backend/pit_window.py`
- [ ] Implement `calc_crossover(current_age, compound, pit_loss, curves) -> int`
- [ ] Implement `calc_net_delta(current_age, compound, pit_loss, curves) -> float`
- [ ] Implement `get_pit_window(driver_state, curves, pit_loss) -> dict` — returns `undercut_window`, `overcut_window`, `crossover_lap`, `net_delta`
- [ ] Add `PitWindowResult` Pydantic model to `models.py`

### rival_model.py
- [ ] Create `backend/rival_model.py`
- [ ] Implement `build_driver_states(laps_df, current_lap) -> dict[str, dict]`
- [ ] Implement `find_undercut_threats(driver, driver_states) -> list[str]`
- [ ] Implement `find_overcut_opportunities(driver, driver_states) -> list[str]`

### strategy.py
- [ ] Create `backend/strategy.py`
- [ ] Implement `recommend(driver, driver_states, curves, pit_loss) -> dict` — returns `recommend_pit`, `reason`, `optimal_lap`
- [ ] Add `StrategyResponse` Pydantic model to `models.py`
- [ ] Add `GET /race/{year}/{round}/strategy/{driver}` route to `main.py`
- [ ] Add `GET /live/strategy/{driver}` route to `main.py`
- [ ] Manual test: query strategy for VER in 2023 Bahrain, verify output shape

---

## Phase 4 — Frontend Shell

### Setup
- [ ] Run `npx create-next-app@latest frontend --typescript --tailwind --app`
- [ ] Install Recharts: `npm install recharts`
- [ ] Create `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8000`
- [ ] Set Tailwind base colours in `tailwind.config.ts`

### lib/api.ts
- [ ] Create `frontend/lib/api.ts`
- [ ] Add `getSession(year, round)` fetch function
- [ ] Add `getDegradation(year, round)` fetch function
- [ ] Add `getStrategy(year, round, driver)` fetch function
- [ ] Add `getLiveLaps()` fetch function
- [ ] Add `getLiveStrategy(driver)` fetch function
- [ ] Define all response TypeScript interfaces

### Pages
- [ ] Build `app/page.tsx` — race selector with year, round, driver inputs
- [ ] Build `app/race/[id]/page.tsx` — fetch data on load, render component grid

### Components
- [ ] Build `DegradationChart.tsx` — Recharts LineChart, one series per compound
- [ ] Style with dark background, compound colours (red/yellow/white for S/M/H)
- [ ] Build `PitWindowPanel.tsx` — card with crossover lap, net delta, recommendation
- [ ] Colour-code: green (pit now), amber (pit soon), gray (stay out)
- [ ] Build `RivalTable.tsx` — all drivers, compound, tyre age, threat flag columns
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
- [ ] Create Railway project, connect GitHub repo, deploy backend
- [ ] Set `OPENF1_BASE_URL` and `CACHE_DIR` in Railway env vars
- [ ] Confirm backend health check returns 200 from Railway URL
- [ ] Import project to Vercel, connect GitHub repo, deploy frontend
- [ ] Set `NEXT_PUBLIC_API_URL` to Railway backend URL in Vercel env vars
- [ ] Smoke test Vercel URL end-to-end on a clean browser
- [ ] Add Vercel URL to GitHub repo description and resume
