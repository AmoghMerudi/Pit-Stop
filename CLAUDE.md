# CLAUDE.md — Pitwall (F1 Pit Stop Strategy Optimizer)

This file gives Claude Code full context for this project. Read it before making any changes.

## Project Summary

Full-stack F1 pit stop strategy optimizer. Python/FastAPI backend computes tyre degradation curves and pit window recommendations from FastF1 and OpenF1 data. Next.js/TypeScript/Tailwind v4 frontend renders a dark, telemetry-styled dashboard with dark/light theme support.

## Repo Structure

```
Pit-Stop/
├── backend/
│   ├── main.py              # FastAPI app — all endpoints
│   ├── ingestion.py         # FastF1 + OpenF1 data fetching, session loading, all data extraction functions
│   ├── degradation.py       # Tyre delta curve fitting (piecewise linear via pwlf, fuel correction, Bayesian updating, cliff detection)
│   ├── benchmarks.py        # Multi-race historical degradation pooling with disk caching
│   ├── constants.py         # FUEL_LOAD_KG, FUEL_EFFECT, TRACK_EVOLUTION_OFFSET, compound lists, get_lap_offset()
│   ├── pit_window.py        # Undercut/overcut crossover calculator
│   ├── rival_model.py       # Competitor tyre state tracker (build_driver_states, build_live_driver_states)
│   ├── strategy.py          # Final pit recommendation logic (recommend())
│   └── models.py            # Pydantic schemas for all endpoints
├── frontend/
│   ├── app/
│   │   ├── page.tsx                   # Landing page
│   │   ├── layout.tsx                 # Root layout (theme script, suppressHydrationWarning)
│   │   ├── globals.css                # CSS variables for dark/light themes (--surface, --text-*, --border-*)
│   │   ├── analyze/                   # Race selector page
│   │   ├── live/                      # Live session mode
│   │   └── race/[id]/
│   │       ├── page.tsx               # Main race dashboard (fetches all data, renders all panels)
│   │       └── h2h/page.tsx           # Head-to-head driver comparison
│   ├── components/
│   │   ├── ChartFullScreen.tsx        # Reusable fullscreen wrapper (render prop pattern, Esc to close)
│   │   ├── DegradationChart.tsx       # Recharts — tyre delta curves with cliff markers
│   │   ├── GapChart.tsx               # Recharts — gap evolution vs ALL drivers, SC/VSC/RED shading
│   │   ├── PositionChart.tsx          # Recharts — position changes, inverted Y-axis, team colors
│   │   ├── WeatherChart.tsx           # Recharts — temperature + rainfall
│   │   ├── LapTimeDistribution.tsx    # Custom box plots (div-based, not Recharts)
│   │   ├── TyreTimeline.tsx           # Horizontal stint bars per driver
│   │   ├── PitStopTable.tsx           # Pit stop table with fastest highlight
│   │   ├── PitWindowTimeline.tsx      # Horizontal bar showing pit window
│   │   ├── TimingTower.tsx            # F1-style timing tower (left sidebar)
│   │   ├── WhatIfSimulator.tsx        # What-if pit stop simulator
│   │   ├── RaceSummary.tsx            # Race stats overview cards
│   │   ├── SectorTimesTable.tsx       # Sector times with performance coloring
│   │   ├── MetricTile.tsx             # Single metric display tile
│   │   ├── PitCountdown.tsx           # Pit recommendation banner
│   │   ├── CircuitInfo.tsx            # Circuit metadata display
│   │   ├── ShareExport.tsx            # PDF export (jspdf + html2canvas-pro) + copy link
│   │   ├── ThemeToggle.tsx            # Dark/light toggle (localStorage persisted)
│   │   ├── LiveSessionBadge.tsx       # Live session indicator
│   │   └── LiveTicker.tsx             # Live data ticker
│   └── lib/
│       ├── api.ts                     # All fetch functions + TypeScript interfaces for API responses
│       ├── constants.ts               # COMPOUND_HEX, TEAM_COLORS, getDriverColor(), getDriverTeam()
│       ├── notifications.ts           # Web Notifications API utility
│       └── types.ts                   # Shared TypeScript types
├── CLAUDE.md
├── ARCHITECTURE.md
├── PRD.md
├── CONVENTIONS.md
└── TASKS.md
```

## Key Architecture Patterns

### Team Colors
- Backend endpoint `GET /race/{year}/{round}/drivers` returns `DriverInfo[]` with `code`, `name`, `team`, `team_color` (hex without #), `number`
- `lib/constants.ts` exports `getDriverColor(code, driverInfo?)` — looks up team color from API data, falls back to hardcoded `TEAM_COLORS` map, then `#666`
- All components that display drivers accept `driverInfo?: DriverInfo[]` prop and use `getDriverColor()` for consistent team coloring
- Race page fetches `getDrivers()` in initial `Promise.all` and passes `driverInfo` to all components

### Chart Fullscreen
- `ChartFullScreen` wraps every chart/table component
- Uses render prop: `children: (isFullScreen: boolean) => React.ReactNode`
- Charts use `isFullScreen` to switch `ResponsiveContainer` height between fixed px and `"100%"`
- Close via Esc key or close button

### Theme System
- CSS variables defined in `globals.css` under `:root` (dark) and `[data-theme="light"]`
- Key vars: `--surface`, `--surface-raised`, `--text-primary`, `--text-secondary`, `--text-muted`, `--text-section`, `--border`, `--border-hover`, `--foreground`, `--error-bg`
- Inline `<script>` in `layout.tsx` reads `localStorage("pitwall-theme")` before hydration
- `<html>` has `suppressHydrationWarning` to avoid mismatch on `data-theme`
- **Never use raw hex colors for text/bg** — always use CSS variables (except brand red `#e8002d` and compound colors)

### PDF Export
- Uses `html2canvas-pro` (NOT `html2canvas`) — Tailwind v4 generates `lab()` color functions that standard html2canvas can't parse
- `jspdf` for PDF generation from canvas

### Degradation Model
- Piecewise linear regression via `pwlf` library
- Fuel correction subtracts fuel-weight effect from lap times before fitting
- Temperature covariate support
- Cliff detection with confidence scoring
- Bayesian conjugate Gaussian updating for live sessions
- Multi-race pooling via `benchmarks.py` with disk caching
- Per-driver curve fitting available

## Backend Endpoints

| Endpoint | Returns | Source function |
|----------|---------|----------------|
| `GET /race/{year}/{round}/degradation` | `DegradationCurve[]` | `fit_all_compounds()` |
| `GET /race/{year}/{round}/strategy/{driver}` | `StrategyResponse` | `recommend()` |
| `GET /race/{year}/{round}/drivers` | `DriverInfo[]` | `session.results` |
| `GET /race/{year}/{round}/sectors/{lap}` | `SectorTime[]` | `get_sector_times()` |
| `GET /race/{year}/{round}/weather` | `WeatherDataPoint[]` | `get_weather_data()` |
| `GET /race/{year}/{round}/gaps/{driver}` | `GapEvolutionPoint[]` | `get_gap_evolution()` — all drivers |
| `GET /race/{year}/{round}/race-control` | `RaceControlEvent[]` | `get_race_control_events()` |
| `GET /race/{year}/{round}/stints` | `StintInfo[]` | `get_stints()` |
| `GET /race/{year}/{round}/positions` | `PositionHistoryPoint[]` | `get_position_history()` |
| `GET /race/{year}/{round}/laptimes` | `LapTimeStats[]` | `get_lap_time_stats()` |
| `GET /race/{year}/{round}/pitstops` | `PitStopInfo[]` | `get_pit_stops()` |
| `GET /race/{year}/{round}/summary` | `RaceSummary` | `generate_race_summary()` |
| `GET /race/{year}/{round}/what-if/{driver}` | `WhatIfResponse` | what-if simulator |
| `GET /live/*` | various | Live session endpoints |

## Critical Rules

- **Always enable FastF1 cache** — `fastf1.Cache.enable_cache('./cache')` must be called before any session load
- **Never call FastF1 in a hot path** — session loads belong in `ingestion.py` only
- **TypeScript strict mode is on** — no `any` types without an explicit comment
- **No business logic in frontend** — components fetch and render only
- **Environment variables via `.env`** — use `NEXT_PUBLIC_API_URL` on frontend, `OPENF1_BASE_URL` on backend
- **Use CSS variables for colors** — not raw hex (except `#e8002d` F1 red and `COMPOUND_HEX` values)
- **Use `html2canvas-pro`** — not `html2canvas` (Tailwind v4 `lab()` colors break it)
- **Use `python3`** — not `python` for all Python commands

## Frontend Conventions

- All API calls go through `lib/api.ts` — never call `fetch` directly in a component
- Tailwind utility classes only — custom CSS only in `globals.css` for theme variables
- Recharts for line/area charts; custom div-based rendering for box plots and timelines
- Component file names are PascalCase, utility/lib files are camelCase
- All chart components are wrapped in `ChartFullScreen`
- Driver displays use team colors via `getDriverColor()` from `lib/constants.ts`

## Backend Conventions

- FastAPI route handlers are thin — delegate to ingestion/degradation/strategy modules
- All route responses use Pydantic models defined in `models.py`
- Use `pandas` DataFrames internally; convert to dicts/lists only at the API boundary
- Compound names are always uppercase: `"SOFT"`, `"MEDIUM"`, `"HARD"`, `"INTERMEDIATE"`, `"WET"`

## Running Locally

```bash
# backend
cd backend
pip install -r requirements.txt
python3 -m uvicorn main:app --reload --port 8000

# frontend
cd frontend
npm install
npm run dev
```

## Known Constraints

- FastF1 session load takes 10–60s on first fetch — always check cache before loading
- OpenF1 live data has ~5s latency from real-world events
- FastF1 does not provide live data — OpenF1 is the only source for current race state
- `pwlf` (piecewise linear fitting) is a required backend dependency
