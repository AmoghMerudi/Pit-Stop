# Pitwall

Real-time and historical F1 pit strategy analysis. Pitwall models tyre degradation, calculates undercut/overcut windows, tracks rival states, and surfaces pit recommendations through a telemetry-styled dashboard.

Built on publicly available data: [FastF1](https://docs.fastf1.dev/) for historical sessions, [OpenF1](https://openf1.org/) for live timing.

## Features

**Strategy Engine**
- Tyre degradation modelling (quadratic fit per compound per circuit)
- Undercut/overcut crossover lap calculation with pit loss adjustment
- Rival tyre state tracking and undercut threat scoring
- What-If simulator (hypothetical pit scenarios with projected outcomes)
- Tyre cliff prediction (estimated laps remaining before performance drop-off)

**Race Analysis Dashboard**
- Degradation curves with current tyre age marker
- Pit window timeline (undercut/overcut zones visualized)
- Position change chart (spaghetti plot with SC/VSC/red flag shading)
- Gap evolution chart with race control event overlay
- Sector times table with purple/green/yellow classification
- Lap time distribution (box plots per driver)
- Tyre strategy timeline (horizontal stint bars per driver)
- Pit stop performance table
- Race summary card (overtakes, leader changes, fastest lap, biggest gainer)
- Timing tower with live gap tracking

**Head-to-Head Mode**
- Side-by-side two-driver comparison at `/race/{id}/h2h`
- Independent driver selectors, shared lap slider
- Per-driver strategy metrics, undercut threats, and state

**Live Mode**
- Real-time grid with driver positions, compounds, and tyre age
- Live strategy recommendations using OpenF1 data + baseline degradation curves
- Tyre life prediction with visual degradation bar
- Browser push notifications (pit window open, crossover imminent, new undercut threat)
- 15-second auto-refresh

**UI**
- Dark/light theme with flash-free initialization
- Driver selection from any chart (position, tyre timeline, lap times, pit stops)
- Share link + PNG export via html2canvas
- F1 starting lights loading animation

## Tech Stack

| Layer | Technology |
|-------|------------|
| Data | FastF1, OpenF1 API |
| Backend | Python 3.11+, FastAPI, pandas, numpy |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, Recharts |
| Deployment | Backend on Railway, Frontend on Vercel |

## Project Structure

```
Pit-Stop/
├── backend/
│   ├── main.py              # FastAPI app — all route handlers
│   ├── ingestion.py         # FastF1 + OpenF1 data extraction (sessions, stints, positions, sectors, weather, gaps, pit stops, race summary)
│   ├── degradation.py       # Tyre delta curve fitting + cliff prediction
│   ├── pit_window.py        # Undercut/overcut crossover calculator
│   ├── rival_model.py       # Competitor tyre state builder (historical + live)
│   ├── strategy.py          # Final pit recommendation engine
│   ├── benchmarks.py        # Baseline curve loader (prior race or benchmark fallback)
│   ├── constants.py         # Compound list, circuit mappings, pit loss values
│   └── models.py            # Pydantic response schemas
├── frontend/
│   ├── app/
│   │   ├── page.tsx                # Landing page
│   │   ├── analyze/page.tsx        # Race selector (year + round + driver)
│   │   ├── race/[id]/page.tsx      # Main race dashboard
│   │   ├── race/[id]/h2h/page.tsx  # Head-to-head comparison
│   │   └── live/page.tsx           # Live session mode
│   ├── components/
│   │   ├── DegradationChart.tsx     # Recharts tyre degradation curves
│   │   ├── PositionChart.tsx        # Position change spaghetti plot
│   │   ├── GapChart.tsx             # Gap evolution with SC/VSC shading
│   │   ├── WeatherChart.tsx         # Track/air temp + rainfall overlay
│   │   ├── TyreTimeline.tsx         # Horizontal stint bars per driver
│   │   ├── LapTimeDistribution.tsx  # Box plots per driver
│   │   ├── PitStopTable.tsx         # Pit stop duration table
│   │   ├── PitWindowTimeline.tsx    # Undercut/overcut zone visualization
│   │   ├── SectorTimesTable.tsx     # S1/S2/S3 with color classification
│   │   ├── RaceSummary.tsx          # Post-race highlights card
│   │   ├── WhatIfSimulator.tsx      # Hypothetical pit scenario simulator
│   │   ├── TimingTower.tsx          # Driver position sidebar
│   │   ├── MetricTile.tsx           # Numeric stat display
│   │   ├── PitCountdown.tsx         # Pit recommendation banner
│   │   ├── CircuitInfo.tsx          # Circuit metadata + pit loss
│   │   ├── ShareExport.tsx          # Copy link + PNG export
│   │   ├── ThemeToggle.tsx          # Dark/light theme switch
│   │   └── LiveSessionBadge.tsx     # Live session indicator
│   └── lib/
│       ├── api.ts                   # Typed API client (all endpoints)
│       ├── constants.ts             # Compound colors + mappings
│       └── notifications.ts         # Web Notifications API utility
└── README.md
```

## Running Locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

**Backend** (`.env` in `backend/`):
```
OPENF1_BASE_URL=https://api.openf1.org/v1
CACHE_DIR=./cache
```

**Frontend** (`.env.local` in `frontend/`):
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/schedule/{year}` | Race calendar for a season |
| GET | `/race/{year}/{round}/degradation` | Tyre degradation curves per compound |
| GET | `/race/{year}/{round}/strategy/{driver}?lap=N` | Pit recommendation at a given lap |
| GET | `/race/{year}/{round}/sectors?lap=N` | Sector times with color classification |
| GET | `/race/{year}/{round}/weather` | Track/air temp, humidity, rainfall per lap |
| GET | `/race/{year}/{round}/gaps/{driver}` | Gap evolution relative to a driver |
| GET | `/race/{year}/{round}/race-control` | SC/VSC/red flag events |
| GET | `/race/{year}/{round}/stints` | Stint data per driver (compound, lap range) |
| GET | `/race/{year}/{round}/positions` | Position history per lap |
| GET | `/race/{year}/{round}/laptimes` | Lap time statistics per driver (median, Q1, Q3, whiskers) |
| GET | `/race/{year}/{round}/pitstops` | Pit stop durations and compound changes |
| GET | `/race/{year}/{round}/summary` | Race summary (overtakes, leader changes, fastest lap) |
| GET | `/race/{year}/{round}/what-if/{driver}?pit_lap=N&new_compound=X` | What-if pit scenario simulation |
| GET | `/live/session` | Active live session metadata |
| GET | `/live/grid` | Current driver states from OpenF1 |
| GET | `/live/strategy/{driver}` | Live pit recommendation |
| GET | `/live/tyre-prediction` | Tyre cliff prediction per driver |
| POST | `/live/manual-strategy` | Strategy with manually entered driver state |

## Architecture

```
FastF1 (historical) ──┐
                       ├──> Python Backend (FastAPI) ──> REST API ──> Next.js Dashboard
OpenF1 (live)    ─────┘         |                                        |
                          degradation.py                          Recharts + Tailwind
                          pit_window.py                           Dark/light theme
                          strategy.py                             Browser notifications
```

The backend owns all computation. The frontend is a pure consumer — all data flows through `lib/api.ts`, components fetch and render.

## Known Constraints

- FastF1 session load takes 10-60s on first fetch (cached after that)
- OpenF1 live data has ~5s latency from real-world events
- Free-tier hosting may spin down after inactivity (~30s cold start)
- Degradation curves require a minimum of 5 laps per compound for a valid fit

## License

MIT
