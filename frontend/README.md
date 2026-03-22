# Pitwall Frontend

Next.js 16 (App Router) dashboard for the Pitwall F1 strategy engine. Connects to the FastAPI backend for all data.

## Setup

```bash
npm install
cp .env.example .env.local  # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

## Pages

- `/` — Landing page
- `/analyze` — Race selector (year, round, driver)
- `/race/[id]` — Full race analysis dashboard
- `/race/[id]/h2h` — Head-to-head driver comparison
- `/live` — Live session mode with auto-refresh

## Build

```bash
npm run build
```
