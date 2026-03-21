# Deploy — F1 Pit Stop Strategy Optimizer

Step-by-step deployment runbook. Backend goes to Railway, frontend goes to Vercel. Both use free tiers. Total setup time: approximately 30 minutes on first deploy.

---

## Prerequisites

- GitHub repo is public (required for Railway free tier)
- Backend passes all manual smoke tests from `TESTING.md`
- `backend/requirements.txt` is up to date

---

## Backend — Railway

### Steps

1. Go to [railway.app](https://railway.app) — create account if needed
2. New project → Deploy from GitHub repo → select `pit-stop-optimizer`
3. Railway auto-detects Python. Override the start command in Railway settings:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
   Railway injects `$PORT` at runtime. Do not hardcode `8000`.
4. Set environment variables in Railway dashboard → Variables tab:
   - `OPENF1_BASE_URL` = `https://api.openf1.org/v1`
   - `CACHE_DIR` = `/tmp/f1cache`
5. Wait for deploy to complete (first deploy takes ~3 minutes)
6. Confirm health check: `GET https://your-app.railway.app/` should return `{"status": "ok"}`

### Procfile (if Railway fails to auto-detect Python)

Create `backend/Procfile`:
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

Commit and push — Railway will pick this up on the next deploy.

### Cache directory

Use `CACHE_DIR=/tmp/f1cache` (not `./cache`). Railway's working directory is not guaranteed writable on all plans. `/tmp` is always writable.

The FastF1 cache persists within a running dyno session but is wiped on redeploy. The first request after each redeploy will trigger a slow FastF1 load (10–60 seconds). This is acceptable for an MVP portfolio project.

To migrate to persistent cache in V2: add a Railway Volume mounted at `/data/f1cache` and update `CACHE_DIR=/data/f1cache`.

### Cold starts

Railway free tier spins down after 10 minutes of inactivity. First request after spin-down takes 25–35 seconds — the dyno boots, then FastF1 loads from disk cache.

To keep the dyno warm (optional): add a Railway cron job that hits `GET /` every 9 minutes. This costs one outbound HTTP request per 9 minutes but eliminates cold starts during active use.

---

## Frontend — Vercel

### Steps

1. Go to [vercel.com](https://vercel.com) — create account if needed
2. New project → Import Git repository → select `pit-stop-optimizer`
3. Set root directory to `frontend` (important — the repo root is not the frontend)
4. Framework preset: Next.js — Vercel auto-detects this
5. Set environment variables in Vercel project settings → Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://your-app.railway.app` (no trailing slash — get the exact URL from Railway dashboard)
6. Click Deploy — Vercel builds and deploys. Subsequent pushes to `main` trigger automatic redeploys.

### CORS

The Railway backend must allow the Vercel production origin. In `backend/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

origins = [
    "http://localhost:3000",       # local Next.js dev server
    "https://your-app.vercel.app", # production Vercel URL — use the exact URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)
```

Do not use `"*"` as the origin or `allow_origins=["https://*.vercel.app"]` — Vercel preview deployments use different subdomains, but you should only allow the production URL for MVP.

---

## Environment Variable Reference

| Variable | Location | Value |
|---|---|---|
| `OPENF1_BASE_URL` | Railway | `https://api.openf1.org/v1` |
| `CACHE_DIR` | Railway | `/tmp/f1cache` |
| `NEXT_PUBLIC_API_URL` | Vercel | `https://your-app.railway.app` |

Never commit `.env` or `.env.local` to the repo. Add them to `.gitignore` immediately.

---

## Smoke Test Checklist

Run these in order on a clean browser (incognito mode, no local backend running) after deploying:

- [ ] `GET https://your-app.railway.app/` returns 200 in browser or curl
- [ ] Vercel URL loads without JavaScript errors in the browser console
- [ ] Select race 2023 / Round 1 — data loads (may take 30–60s on cold start after redeploy)
- [ ] Degradation chart renders with at least two compound lines (SOFT and MEDIUM minimum)
- [ ] Pit window panel shows a recommendation for VER with a non-empty reason string
- [ ] No CORS errors in the browser console (Network tab → look for blocked requests)

---

## What Not to Do

- Do not set `CACHE_DIR=./cache` on Railway — the working directory is not reliably writable
- Do not hardcode the Railway URL anywhere in frontend code — always use `NEXT_PUBLIC_API_URL`
- Do not prefix backend secrets (like any future API keys) with `NEXT_PUBLIC_` — it exposes them in the browser bundle
- Do not use `allow_origins=["*"]` in production CORS config
- Do not force-push to `main` after Vercel is connected — every push triggers a deploy
