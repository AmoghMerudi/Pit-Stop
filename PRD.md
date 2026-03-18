# PRD — F1 Pit Stop Strategy Optimizer

## Overview

A full-stack web application that models optimal pit stop windows for Formula 1 races using historical telemetry and live timing data. The system computes tyre degradation curves, calculates undercut/overcut crossover laps, tracks competitor tyre states, and surfaces a pit recommendation per driver per lap via a dark, telemetry-styled dashboard.

## Problem Statement

F1 pit stop strategy is opaque to fans and analysts without access to team tools. Existing fan-facing apps show timing but do not model tyre degradation or produce actionable pit window recommendations. This project fills that gap with a data-driven strategy layer on top of publicly available APIs.

## Goals

- Model tyre degradation per compound per circuit from historical FastF1 data
- Calculate the lap at which pitting becomes net-positive vs. staying out (undercut/overcut)
- Track all drivers' tyre ages simultaneously and flag strategic opportunities
- Expose all computations via a REST API consumed by a Next.js dashboard
- Deploy publicly with a shareable Vercel URL

## Non-Goals

- Real-time radio or video integration
- Weather-adaptive modelling (V2 consideration)
- Safety car / VSC stochastic handling (V2 consideration)
- Mobile-native app

## Users

Primary user is a technically literate F1 fan or recruiter reviewing the project. Secondary user is the developer (resume/portfolio context).

## Success Metrics

- Dashboard loads race strategy data in under 3 seconds
- Degradation model fits historical lap data with R² > 0.80
- Pit window recommendation matches known historical strategy in >60% of sampled races
- Project is publicly accessible via Vercel

## Tech Stack

| Layer | Technology |
|---|---|
| Data ingestion | FastF1, OpenF1 API |
| Backend | Python, FastAPI, pandas, scipy, numpy |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, Recharts |
| Deployment | Backend on Railway or Render, Frontend on Vercel |
| Caching | FastF1 local disk cache |

## Constraints

- FastF1 telemetry downloads are slow — caching is mandatory from day one
- OpenF1 live timing updates on ~1s polling intervals
- Free-tier hosting limits (Railway/Render spin-down on cold start)
