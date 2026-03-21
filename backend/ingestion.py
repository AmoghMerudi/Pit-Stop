import logging
import os
from datetime import date

import fastf1
import pandas as pd
import requests
from dotenv import load_dotenv

from constants import COMPOUNDS

load_dotenv()

logger = logging.getLogger(__name__)

CACHE_DIR = os.getenv("CACHE_DIR", "./cache")
OPENF1_BASE_URL = os.getenv("OPENF1_BASE_URL", "https://api.openf1.org/v1")
OPENF1_TIMEOUT = 5  # seconds

os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

CURRENT_YEAR = date.today().year


def load_session(year: int, round_number: int) -> fastf1.core.Session:
    """Load and return a FastF1 race session. Results are cached to disk."""
    if year < 2018 or year > CURRENT_YEAR:
        raise ValueError(f"Year must be between 2018 and {CURRENT_YEAR}")
    if round_number < 1 or round_number > 24:
        raise ValueError("Round number must be between 1 and 24")

    session = fastf1.get_session(year, round_number, "R")
    session.load()
    return session


def get_laps(session: fastf1.core.Session) -> pd.DataFrame:
    """
    Extract clean lap data from a session.

    Returns a DataFrame matching the ingestion output contract:
    driver, compound, tyre_age, lap_time (float seconds), stint, lap_number.
    All nulls removed. Compound always in COMPOUNDS set.
    """
    laps = session.laps.pick_quicklaps().copy()

    laps["lap_time"] = laps["LapTime"].dt.total_seconds()

    df = laps.rename(columns={
        "Driver":     "driver",
        "Compound":   "compound",
        "TyreLife":   "tyre_age",
        "Stint":      "stint",
        "LapNumber":  "lap_number",
    })[["driver", "compound", "tyre_age", "lap_time", "stint", "lap_number"]]

    df = df.dropna(subset=["lap_time"])
    df = df[df["compound"].isin(COMPOUNDS)]
    df = df[df["lap_time"] > 0]
    df = df.reset_index(drop=True)

    return df


def get_live_stints(session_key: int | None = None) -> list[dict]:
    """
    Fetch current stint data from OpenF1.
    Returns empty list on any error — never raises.
    """
    params: dict = {}
    if session_key is not None:
        params["session_key"] = session_key

    try:
        response = requests.get(
            f"{OPENF1_BASE_URL}/stints",
            params=params,
            timeout=OPENF1_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

        # Deduplicate on (driver_number, stint_number)
        seen: set = set()
        unique = []
        for row in data:
            key = (row.get("driver_number"), row.get("stint_number"))
            if key not in seen:
                seen.add(key)
                unique.append(row)
        return unique

    except Exception as exc:
        logger.warning("OpenF1 stints request failed: %s", exc)
        return []


def get_live_laps(session_key: int | None = None) -> list[dict]:
    """
    Fetch current lap data from OpenF1.
    Returns empty list on any error — never raises.
    """
    params: dict = {}
    if session_key is not None:
        params["session_key"] = session_key

    try:
        response = requests.get(
            f"{OPENF1_BASE_URL}/laps",
            params=params,
            timeout=OPENF1_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

        # Skip first lap (rolling start anomaly) and incomplete laps
        data = [row for row in data if row.get("lap_number", 0) > 1]
        data = [row for row in data if row.get("lap_duration") is not None]

        # Deduplicate on (driver_number, lap_number), keep last
        seen: dict = {}
        for row in data:
            key = (row.get("driver_number"), row.get("lap_number"))
            seen[key] = row
        return list(seen.values())

    except Exception as exc:
        logger.warning("OpenF1 laps request failed: %s", exc)
        return []
