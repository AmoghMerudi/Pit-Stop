# F1 Pit Stop Strategy Optimizer

A full-stack web application that models optimal pit stop windows for Formula 1 races using historical telemetry and live timing data. The system computes tyre degradation curves, calculates undercut/overcut crossover laps, tracks competitor tyre states, and surfaces pit recommendations via a dark, telemetry-styled dashboard.

## Overview

F1 pit stop strategy is opaque to fans and analysts without access to team tools. This project fills that gap with a data-driven strategy layer on top of publicly available APIs (FastF1 for historical data, OpenF1 for live timing).

**Features:**
- Tyre degradation modelling per compound per circuit
- Undercut/overcut crossover lap calculation
- Rival tyre state tracking and undercut threat detection
- Historical race analysis and live session support
- REST API + Next.js dashboard

## Tech Stack

| Layer | Technology |
|-------|------------|
| Data | FastF1, OpenF1 API |
| Backend | Python, FastAPI, pandas, scipy, numpy |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, Recharts |
| Deployment | Backend on Railway/Render, Frontend on Vercel |

## Project Structure

```
pit-stop-optimizer/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── ingestion.py         # FastF1 + OpenF1 data fetching + caching
│   ├── degradation.py       # Tyre delta curve fitting
│   ├── pit_window.py        # Undercut/overcut crossover calculator
│   ├── rival_model.py       # Competitor tyre state tracker
│   ├── strategy.py          # Final pit recommendation logic
│   └── models.py            # Pydantic schemas
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Race selector
│   │   └── race/[id]/page.tsx
│   ├── components/
│   │   ├── DegradationChart.tsx
│   │   ├── PitWindowPanel.tsx
│   │   ├── RivalTable.tsx
│   │   └── LiveTicker.tsx
│   └── lib/api.ts
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

### Environment Variables

**Backend** (`.env`):
```
OPENF1_BASE_URL=https://api.openf1.org/v1
CACHE_DIR=./cache
```

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/race/{year}/{round}` | Load historical race session |
| GET | `/race/{year}/{round}/degradation` | Tyre curves for all compounds |
| GET | `/race/{year}/{round}/strategy/{driver}` | Pit recommendation for a driver |
| GET | `/live/laps` | Current lap state from OpenF1 |
| GET | `/live/strategy/{driver}` | Live pit recommendation |

## Architecture

```
FastF1 (historical) ──┐
                       ├──► Python Backend (FastAPI) ──► REST API ──► Next.js Dashboard
OpenF1 (live)    ─────┘                                              (Vercel)
```

- **Backend**: Owns all computation. Thin route handlers delegate to ingestion, degradation, pit_window, rival_model, and strategy modules.
- **Frontend**: Pure consumer. All API calls go through `lib/api.ts`; components fetch and render only.

## Known Constraints

- FastF1 session load takes 10–60 seconds on first fetch — caching is mandatory
- OpenF1 live data has ~5s latency from real-world events
- Free-tier hosting may spin down after inactivity — cold starts take ~30s

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design and data flow
- [PLAN.md](PLAN.md) — Build phases and order
- [PRD.md](PRD.md) — Product requirements

## License

MIT
