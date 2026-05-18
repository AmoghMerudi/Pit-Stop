# Precomputed race artifacts

Static JSON for finished historical races. The backend serves these directly
without touching FastF1 or pwlf, so deployed cold-start latency for old races
drops from 10–60 s to <50 ms.

## Layout

```
precomputed/
└── {year}/
    └── {round}/
        ├── bundle.json          # race-wide panels (RaceBundle)
        ├── strategy_{DRV}.json  # final-lap StrategyResponse per driver
        └── gaps_{DRV}.json      # gap-evolution per driver
```

## Generating

```bash
cd backend
python3 -m precompute --year 2024 --round 8     # one race
python3 -m precompute --year 2024                # every round in a year
python3 -m precompute --all                      # every (year, round) we know
```

Commit the resulting files. Railway picks them up on the next deploy.

## When to regenerate

- After every completed race weekend (re-run for the new round only).
- After a change to any extractor in `ingestion.py` that affects the wire
  format (e.g. a new field on `StintInfo`).
- After upgrading FastF1 if its data parsing changes.

A missing file means "compute live" — used for the in-progress race and any
race the CLI has not been run for yet. No behaviour change, just slower.
