# CLAUDE.md — F1 Pit Stop Strategy Optimizer

This file gives Claude Code full context for this project. Read it before making any changes.

## Project Summary

Full-stack F1 pit stop strategy optimizer. Python/FastAPI backend computes tyre degradation curves and pit window recommendations from FastF1 and OpenF1 data. Next.js/TypeScript/Tailwind frontend renders a dark, telemetry-styled dashboard. See ARCHITECTURE.md for the full system design.

## Repo Structure

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
│   │   ├── page.tsx
│   │   └── race/[id]/page.tsx
│   ├── components/
│   │   ├── DegradationChart.tsx
│   │   ├── PitWindowPanel.tsx
│   │   ├── RivalTable.tsx
│   │   └── LiveTicker.tsx
│   └── lib/api.ts
├── CLAUDE.md
├── ARCHITECTURE.md
├── PRD.md
├── CONVENTIONS.md
├── TASKS.md
├── AGENTS.md
├── DATA_CONTRACT.md   # FastF1/OpenF1 field names, types, edge cases, DataFrame contracts
├── ERROR_CATALOG.md   # HTTP status mapping, error response shape, per-module error table
├── TESTING.md         # pytest setup, mocking strategy, fixtures, smoke test commands
└── DEPLOY.md          # Railway + Vercel step-by-step, env vars, CORS, cold start
```

## Critical Rules

- **Always enable FastF1 cache** — `fastf1.Cache.enable_cache('./cache')` must be called before any session load. Never remove this line.
- **Never call FastF1 in a hot path** — session loads belong in ingestion.py only, results must be cached in memory or on disk before serving a request.
- **TypeScript strict mode is on** — no `any` types in frontend code without an explicit comment explaining why.
- **No business logic in frontend** — components fetch and render only. All computation stays in the backend.
- **Environment variables via `.env`** — never hardcode API URLs or keys. Use `NEXT_PUBLIC_API_URL` on the frontend, `OPENF1_BASE_URL` on the backend.

## Backend Conventions

- FastAPI route handlers are thin — delegate immediately to the relevant module (ingestion, degradation, etc.)
- All route responses use Pydantic models defined in `models.py`
- Errors return `{ "error": "message" }` with appropriate HTTP status codes
- Use `pandas` DataFrames internally; convert to dicts/lists only at the API boundary
- Compound names are always uppercase strings: `"SOFT"`, `"MEDIUM"`, `"HARD"`, `"INTERMEDIATE"`, `"WET"`

## Frontend Conventions

- All API calls go through `lib/api.ts` — never call `fetch` directly in a component
- Use Tailwind utility classes only — no custom CSS files
- Colour palette: dark background (`#0a0a0a`), panel surfaces (`#111`), accent red (`#e8002d` — F1 red), muted text (`#888`)
- Recharts `LineChart` for degradation curves, custom tooltips styled to match dark theme
- Component file names are PascalCase, utility/lib files are camelCase

## Running Locally

```bash
# backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# frontend
cd frontend
npm install
npm run dev
```

## Known Constraints

- FastF1 session load takes 10–60 seconds on first fetch — always check cache before loading
- OpenF1 live data has ~5s latency from real-world events
- FastF1 does not provide live data — OpenF1 is the only source for current race state
- Free-tier Railway dynos spin down after inactivity — see DEPLOY.md for cold start behaviour and mitigation
