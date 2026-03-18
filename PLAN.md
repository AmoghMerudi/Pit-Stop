# Plan — F1 Pit Stop Strategy Optimizer

## Build Order

Build sequentially. Each phase depends on the previous one being functional.

---

## Phase 1 — Data Foundation (Backend)

**Goal**: Reliably fetch and cache race data. Everything downstream depends on this being solid.

### Steps
1. Set up Python project — `requirements.txt`, `.env`, `main.py` stub, FastF1 cache enabled
2. Implement `ingestion.py`
   - Load a historical session with FastF1
   - Extract laps DataFrame with required columns: `driver`, `compound`, `tyre_age`, `lap_time`, `stint`, `lap_number`
   - Filter out in-laps, out-laps, and safety car laps (use `session.laps.pick_quicklaps()`)
   - Add OpenF1 fetch for live stints endpoint
3. Write a test script (`test_ingestion.py`) that loads 2023 Round 1 and prints the laps DataFrame head

**Done when**: You can run `test_ingestion.py` and see clean lap data in under 5 seconds (cache hit).

---

## Phase 2 — Degradation Model (Backend)

**Goal**: Produce a tyre delta curve per compound for any loaded session.

### Steps
1. Implement `degradation.py`
   - Filter laps by compound
   - Compute `lap_time_delta` = lap time minus driver's median lap time on that stint
   - Fit linear curve with `numpy.polyfit` (start simple, upgrade to polynomial if R² < 0.7)
   - Return slope, intercept, R² per compound
   - Expose `predict_delta(compound, age) -> float`
2. Add `/race/{year}/{round}/degradation` route in `main.py`
3. Test with 2023 Bahrain — expect SOFT to degrade faster than MEDIUM

**Done when**: API returns degradation curves with R² values and the slopes are ordered SOFT > MEDIUM > HARD.

---

## Phase 3 — Pit Window Calculator (Backend)

**Goal**: Given a driver's current state, return a pit recommendation.

### Steps
1. Add circuit pit lane time loss constants to a `constants.py` dict (hardcode top 10 circuits to start)
2. Implement `pit_window.py`
   - Crossover lap formula: `crossover = (pit_loss - current_delta) / slope`
   - Return undercut flag, overcut flag, crossover lap, net delta
3. Implement `rival_model.py`
   - Build driver state dict from ingestion lap data
   - Flag undercut threats: rival behind you, tyre_age > yours by 5+ laps, gap < 3s
4. Implement `strategy.py` combining both
5. Add `/race/{year}/{round}/strategy/{driver}` route

**Done when**: Querying strategy for a driver returns a JSON object with `recommend_pit`, `reason`, and `optimal_lap`.

---

## Phase 4 — Frontend Shell (Next.js)

**Goal**: A working dashboard that renders real data from the backend.

### Steps
1. Init Next.js project with TypeScript and Tailwind CSS
2. Set up `lib/api.ts` with typed fetch wrappers for all backend routes
3. Build race selector page (`app/page.tsx`) — year dropdown, round input, driver input, submit
4. Build dashboard page (`app/race/[id]/page.tsx`) — fetch strategy on load, pass data to components
5. Implement `DegradationChart.tsx` using Recharts `LineChart`
6. Implement `PitWindowPanel.tsx` — card with recommendation, crossover lap, net delta
7. Implement `RivalTable.tsx` — table of all drivers with tyre state

**Done when**: Selecting a race renders all three components with real backend data.

---

## Phase 5 — Live Mode (OpenF1 Integration)

**Goal**: Dashboard updates in real time during a live race session.

### Steps
1. Implement `LiveTicker.tsx` — polls `/live/laps` every 2s, displays current lap + flash on update
2. Add live strategy endpoint `/live/strategy/{driver}` to backend
3. Add mode toggle to dashboard: Historical vs Live
4. Test with a recent race replay or wait for a live race weekend

**Done when**: PitWindowPanel re-renders with fresh data every 2s during a live session.

---

## Phase 6 — Polish + Deploy

**Goal**: Public Vercel link, clean UI, README.

### Steps
1. Dark theme polish — ensure consistent use of colour palette across all components
2. Error states — handle API errors, empty data, unknown circuits gracefully
3. Loading skeletons on dashboard while data fetches
4. Write `README.md` with project description, setup instructions, and architecture diagram
5. Deploy backend to Railway — set env vars, confirm cold start behaviour
6. Deploy frontend to Vercel — set `NEXT_PUBLIC_API_URL`, confirm end-to-end works
7. Add Vercel URL to resume and GitHub repo description

**Done when**: Vercel link works end-to-end on a fresh browser with no local backend running.

---

## V2 Ideas (Post-MVP)

- Safety car / VSC handling — detect SC laps from FastF1 and re-run strategy from that lap
- Weather integration — adjust degradation slope for wet compounds dynamically
- Driver rating system — second F1 project, reuses FastF1 pipeline
- Multiple driver comparison view
