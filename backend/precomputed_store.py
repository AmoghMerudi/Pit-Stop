"""
Read-side accessor for precomputed historical race artifacts.

Historical race data is immutable, so we ship pre-baked JSON for every
finished race under `backend/precomputed/{year}/{round}/`. Endpoints check
here first; on a hit the response avoids FastF1, pwlf, and pandas entirely
and answers in <50ms regardless of cold start.

Layout::

    backend/precomputed/
        2024/
            8/
                bundle.json            # everything in RaceBundle
                strategy_VER.json      # final-lap strategy per driver
                strategy_HAM.json
                ...
                gaps_VER.json          # per-driver gap evolution
                gaps_HAM.json
                ...

A missing file means "compute live" — used for the in-progress race weekend
and any (year, round) the precompute CLI has not yet been run for.
"""

from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

# Allow override for tests/deployments. Defaults to backend/precomputed.
PRECOMPUTED_DIR = Path(
    os.getenv("PRECOMPUTED_DIR", str(Path(__file__).parent / "precomputed"))
)


def _path(year: int, round_number: int, name: str) -> Path:
    return PRECOMPUTED_DIR / str(year) / str(round_number) / f"{name}.json"


def _read(year: int, round_number: int, name: str) -> dict | list | None:
    path = _path(year, round_number, name)
    if not path.exists():
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as exc:
        logger.warning("Failed to read precomputed %s: %s", path, exc)
        return None


@lru_cache(maxsize=64)
def try_load_bundle(year: int, round_number: int) -> dict | None:
    """Return the precomputed RaceBundle dict for a race, or None if missing."""
    data = _read(year, round_number, "bundle")
    return data if isinstance(data, dict) else None


@lru_cache(maxsize=512)
def try_load_strategy(year: int, round_number: int, driver: str) -> dict | None:
    """Return the precomputed final-lap StrategyResponse dict for a driver."""
    data = _read(year, round_number, f"strategy_{driver.upper()}")
    return data if isinstance(data, dict) else None


@lru_cache(maxsize=512)
def try_load_gaps(year: int, round_number: int, driver: str) -> list | None:
    """Return the precomputed gap-evolution list for a driver."""
    data = _read(year, round_number, f"gaps_{driver.upper()}")
    return data if isinstance(data, list) else None


def clear_cache() -> None:
    """Drop the in-process LRU caches (used by tests after writing fixtures)."""
    try_load_bundle.cache_clear()
    try_load_strategy.cache_clear()
    try_load_gaps.cache_clear()
