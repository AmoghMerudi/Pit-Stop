# Architecture — F1 Pit Stop Strategy Optimizer

## System Overview

Three-layer architecture: data sources → Python backend → Next.js frontend. The backend owns all computation and exposes a REST API. The frontend is a pure consumer with no business logic.

```
FastF1 (historical) ──┐
                       ├──► Python Backend (FastAPI) ──► REST API ──► Next.js Dashboard
OpenF1 (live)    ──┬──┘                                              (Vercel)
                   └────────────────────────────────────────────────► Live Ticker (direct poll)
```

## Backend

### Entry point
`main.py` — FastAPI app, registers all routers, configures CORS, sets up FastF1 cache on startup.

### Modules

**`ingestion.py`**
- Loads session data via `fastf1.get_session(year, round, session)`
- Extracts per-lap telemetry: driver, compound, tyre age, lap time, stint
- Fetches live timing from OpenF1 `/v1/laps` and `/v1/stints` endpoints
- Caches FastF1 responses to `./cache/` — never re-fetches a session already on disk

**`degradation.py`**
- Accepts a DataFrame of laps filtered by compound and circuit
- Fits a linear or polynomial curve to `lap_time_delta vs tyre_age` using `scipy.curve_fit`
- Returns slope, intercept, and R² per compound
- Exposes `predict_delta(compound, age) -> float` for downstream use

**`pit_window.py`**
- Takes current tyre age, compound, pit lane time loss (circuit-specific constant), and fresh-tyre pace
- Computes the crossover lap: the lap at which staying out costs more than pitting
- Returns `{ undercut_window: bool, overcut_window: bool, crossover_lap: int, net_delta: float }`

**`rival_model.py`**
- Maintains a dict of `driver -> { compound, tyre_age, predicted_pit_lap }`
- Identifies undercut threats: rivals with tyre_age > current driver and within 2s gap
- Updates on each lap tick from ingestion layer

**`strategy.py`**
- Combines pit window calc and rival model into a single recommendation
- Uses greedy decision: pit if crossover is within 3 laps OR undercut threat exists
- Returns `{ recommend_pit: bool, reason: str, optimal_lap: int }`

**`models.py`**
- Pydantic schemas for all API request/response shapes
- Keeps FastAPI route signatures clean

### API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/race/{year}/{round}` | Load historical race session |
| GET | `/race/{year}/{round}/degradation` | Tyre curves for all compounds |
| GET | `/race/{year}/{round}/strategy/{driver}` | Pit recommendation for a driver |
| GET | `/live/laps` | Current lap state from OpenF1 |
| GET | `/live/strategy/{driver}` | Live pit recommendation |

## Frontend

Next.js App Router, TypeScript throughout, Tailwind CSS for styling, Recharts for data visualisation.

### Routes

| Route | Component | Description |
|---|---|---|
| `/` | `page.tsx` | Race selector — year, round, driver |
| `/race/[id]` | `page.tsx` | Main dashboard |

### Components

**`DegradationChart.tsx`** — Recharts `LineChart` showing lap delta vs tyre age per compound. Soft/medium/hard as separate series with compound-appropriate colours.

**`PitWindowPanel.tsx`** — Card displaying current lap, crossover lap, undercut/overcut flag, net delta. Colour-coded: green (pit now), amber (pit soon), gray (stay out).

**`RivalTable.tsx`** — Table of all drivers with columns: position, driver, compound, tyre age, predicted pit lap, threat flag.

**`LiveTicker.tsx`** — Polls `/live/laps` every 2s during a live session. Displays current lap, gap to leader, and flashes on strategy updates.

**`lib/api.ts`** — Typed `fetch` wrappers for all backend routes. Single source of truth for API base URL (env var `NEXT_PUBLIC_API_URL`).

## Data Flow (Historical Race)

```
User selects race
  → GET /race/{year}/{round}
  → ingestion.py fetches FastF1 session (or loads from cache)
  → degradation.py fits curves
  → GET /race/{year}/{round}/strategy/{driver}
  → pit_window.py + rival_model.py → strategy.py
  → Dashboard renders DegradationChart + PitWindowPanel + RivalTable
```

## Data Flow (Live Race)

```
LiveTicker polls OpenF1 every 2s
  → rival_model.py updates all driver states
  → PitWindowPanel re-renders with fresh recommendation
```

## Environment Variables

```
# backend (.env)
OPENF1_BASE_URL=https://api.openf1.org/v1
CACHE_DIR=./cache

# frontend (.env.local)
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

## Deployment

- **Backend**: Railway or Render (free tier). Single `uvicorn main:app` process. Cache dir persists within the dyno but resets on redeploy — acceptable for MVP.
- **Frontend**: Vercel. Auto-deploys on push to `main`. `NEXT_PUBLIC_API_URL` set in Vercel project settings.
