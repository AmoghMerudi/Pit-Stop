"""
Generate static JSON artifacts for finished historical races.

Usage::

    python3 -m precompute --year 2024 --round 8        # one race
    python3 -m precompute --year 2024                  # every round in a year
    python3 -m precompute --all                        # every (year, round) we know about

Run from the `backend/` directory. Output lands under `backend/precomputed/`
and is intended to be committed so Railway deploys pick it up automatically.

Each race generates:
    bundle.json                  — all race-wide panels (RaceBundle)
    strategy_{DRV}.json          — final-lap StrategyResponse per driver
    gaps_{DRV}.json              — gap evolution per driver

Per-lap views (the strategy slider, sector times) are intentionally NOT
precomputed — Layer 1's in-memory caches make the live path fast enough
once the first request has warmed the session.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from constants import ROUND_TO_CIRCUIT
from degradation import resolve_driver_curves
from ingestion import (
    generate_race_summary,
    get_driver_statuses,
    get_gap_evolution,
    get_lap_time_stats,
    get_pit_stops,
    get_position_history,
    get_race_control_events,
    get_race_state,
    get_session_curves,
    get_session_laps,
    get_stints,
    get_total_laps,
    get_weather_data,
    load_session,
)
from precomputed_store import PRECOMPUTED_DIR
from rival_model import build_driver_states
from strategy import recommend

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("precompute")


def _serialize_curves(all_curves: dict, primary: dict) -> list[dict]:
    """Plain-dict version of main._serialize_curves (no Pydantic dependency)."""
    out: list[dict] = []
    for c, v in primary.items():
        per_driver: dict | None = None
        raw = all_curves.get(c, {})
        if isinstance(raw, dict) and "_population" in raw:
            per_driver = {}
            for dk, dv in raw.items():
                if dk.startswith("_"):
                    continue
                per_driver[dk] = {
                    "slope": dv.get("slope", 0.0),
                    "intercept": dv.get("intercept", 0.0),
                    "r2": dv.get("r2", 0.0),
                    "coeffs": dv.get("coeffs"),
                    "degree": dv.get("degree", 2),
                    "cliff_lap": dv.get("cliff_lap"),
                    "cliff_confidence": dv.get("cliff_confidence"),
                    "temp_coefficient": dv.get("temp_coefficient"),
                    "type": dv.get("type", "quadratic"),
                }
        out.append({
            "compound": c,
            "slope": v.get("slope", 0.0),
            "intercept": v.get("intercept", 0.0),
            "r2": v.get("r2", 0.0),
            "coeffs": v.get("coeffs"),
            "degree": v.get("degree", 2),
            "cliff_lap": v.get("cliff_lap"),
            "cliff_confidence": v.get("cliff_confidence"),
            "temp_coefficient": v.get("temp_coefficient"),
            "type": v.get("type", "quadratic"),
            "per_driver": per_driver,
        })
    return out


def _drivers_payload(session) -> list[dict]:
    drivers: list[dict] = []
    for _, row in session.results.iterrows():
        code = row.get("Abbreviation", "")
        if not code:
            continue
        drivers.append({
            "code": str(code),
            "name": str(row.get("FullName", code)),
            "team": str(row.get("TeamName", "")),
            "team_color": str(row.get("TeamColor", "555555")).lstrip("#"),
            "number": int(row.get("DriverNumber", 0)),
        })
    return drivers


def _write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(payload, f, separators=(",", ":"))


def precompute_race(year: int, round_number: int, out_root: Path = PRECOMPUTED_DIR) -> None:
    """Generate every artifact for one (year, round). Idempotent — overwrites existing files."""
    logger.info("Precomputing %d/%d", year, round_number)

    session = load_session(year, round_number)
    circuit = session.event.get("Location") if hasattr(session, "event") else None
    laps = get_session_laps(year, round_number)
    all_curves = get_session_curves(year, round_number)
    primary = resolve_driver_curves(all_curves, driver=None)

    drivers = _drivers_payload(session)
    total_laps = get_total_laps(session)

    bundle = {
        "drivers": drivers,
        "degradation": _serialize_curves(all_curves, primary),
        "stints": get_stints(session),
        "positions": get_position_history(session),
        "laptimes": get_lap_time_stats(session),
        "pitstops": get_pit_stops(session),
        "weather": get_weather_data(session),
        "race_control": get_race_control_events(session),
        "summary": generate_race_summary(session),
        "total_laps": total_laps,
    }

    out_dir = out_root / str(year) / str(round_number)
    _write_json(out_dir / "bundle.json", bundle)

    # Final-lap strategy + gaps per driver
    final_lap = int(laps["lap_number"].max())
    remaining = max(1, total_laps - final_lap)
    race_state = get_race_state(session, final_lap)
    statuses = get_driver_statuses(session, final_lap)
    laps_at_lap = laps[laps["lap_number"] <= final_lap]
    driver_states = build_driver_states(laps_at_lap, final_lap, race_state, statuses)

    for d in drivers:
        code = d["code"]
        if code not in driver_states:
            continue
        curves = resolve_driver_curves(all_curves, driver=code)
        try:
            result = recommend(code, driver_states, curves, circuit, remaining)
        except Exception as exc:
            logger.warning("Strategy for %s failed: %s", code, exc)
            continue
        strategy_payload = {
            **result,
            "remaining_laps": remaining,
            "total_laps": total_laps,
            "current_lap": final_lap,
        }
        _write_json(out_dir / f"strategy_{code}.json", strategy_payload)

        try:
            gaps = get_gap_evolution(session, code)
            _write_json(out_dir / f"gaps_{code}.json", gaps)
        except Exception as exc:
            logger.warning("Gaps for %s failed: %s", code, exc)

    logger.info("Wrote %s", out_dir)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Pre-bake static JSON for historical F1 races")
    p.add_argument("--year", type=int, help="Year (e.g. 2024)")
    p.add_argument("--round", type=int, help="Round number (1-24). Requires --year.")
    p.add_argument("--all", action="store_true",
                   help="Process every (year, round) in ROUND_TO_CIRCUIT")
    return p.parse_args()


def main() -> int:
    args = _parse_args()

    if args.all:
        targets = sorted(ROUND_TO_CIRCUIT.keys())
    elif args.year and args.round:
        targets = [(args.year, args.round)]
    elif args.year:
        targets = sorted([k for k in ROUND_TO_CIRCUIT.keys() if k[0] == args.year])
    else:
        logger.error("Pass --all, --year, or --year + --round")
        return 2

    if not targets:
        logger.warning("No (year, round) targets matched")
        return 1

    failures: list[tuple[int, int, str]] = []
    for year, rnd in targets:
        try:
            precompute_race(year, rnd)
        except Exception as exc:
            logger.exception("Failed %d/%d", year, rnd)
            failures.append((year, rnd, str(exc)))

    if failures:
        logger.warning("Done with %d failure(s):", len(failures))
        for y, r, e in failures:
            logger.warning("  %d/%d → %s", y, r, e)
        return 1

    logger.info("Done — %d race(s) precomputed", len(targets))
    return 0


if __name__ == "__main__":
    sys.exit(main())
