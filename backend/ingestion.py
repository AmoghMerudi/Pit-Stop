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


def get_total_laps(session: fastf1.core.Session) -> int:
    """Extract total race laps from session. Falls back to max observed lap number."""
    # FastF1 stores total laps in session.total_laps for race sessions
    if hasattr(session, "total_laps") and session.total_laps:
        return int(session.total_laps)
    # Fallback: max lap number observed in data
    return int(session.laps["LapNumber"].max())


# TrackStatus codes that indicate abnormal racing conditions
# "4" = Safety Car, "6" = VSC, "7" = VSC Ending
SC_STATUS_CODES = {"4", "6", "7"}


def get_laps(session: fastf1.core.Session) -> pd.DataFrame:
    """
    Extract clean lap data from a session.

    Returns a DataFrame matching the ingestion output contract:
    driver, compound, tyre_age, lap_time (float seconds), stint, lap_number.

    Filters applied:
    - Removes quicklap outliers (FastF1 pick_quicklaps)
    - Removes laps with null/zero lap times
    - Removes unknown compounds
    - Removes safety car / VSC laps (TrackStatus 4, 6, 7)
    - Removes pit in-laps and out-laps
    """
    laps = session.laps.pick_quicklaps().copy()

    laps["lap_time"] = laps["LapTime"].dt.total_seconds()

    # Extract track status and pit flags for filtering
    rename_map = {
        "Driver":     "driver",
        "Compound":   "compound",
        "TyreLife":   "tyre_age",
        "Stint":      "stint",
        "LapNumber":  "lap_number",
    }
    columns = ["driver", "compound", "tyre_age", "lap_time", "stint", "lap_number"]

    # Include TrackStatus if available
    if "TrackStatus" in laps.columns:
        rename_map["TrackStatus"] = "track_status"
        columns.append("track_status")

    # Include pit flags if available
    if "PitInTime" in laps.columns:
        rename_map["PitInTime"] = "pit_in_time"
        columns.append("pit_in_time")
    if "PitOutTime" in laps.columns:
        rename_map["PitOutTime"] = "pit_out_time"
        columns.append("pit_out_time")

    df = laps.rename(columns=rename_map)[columns]

    # Core filters
    df = df.dropna(subset=["lap_time"])
    df = df[df["compound"].isin(COMPOUNDS)]
    df = df[df["lap_time"] > 0]

    # Filter safety car / VSC laps (these pollute degradation curves)
    if "track_status" in df.columns:
        df = df[~df["track_status"].astype(str).isin(SC_STATUS_CODES)]
        df = df.drop(columns=["track_status"])

    # Filter pit in-laps and out-laps (anomalous lap times)
    if "pit_in_time" in df.columns:
        df = df[df["pit_in_time"].isna()]
        df = df.drop(columns=["pit_in_time"])
    if "pit_out_time" in df.columns:
        df = df[df["pit_out_time"].isna()]
        df = df.drop(columns=["pit_out_time"])

    df = df.reset_index(drop=True)

    return df


def get_race_state(session: fastf1.core.Session, target_lap: int | None = None) -> pd.DataFrame:
    """
    Extract position and gap_to_leader for every driver at a specific lap.
    Uses ALL laps (not just quicklaps) for accurate cumulative timing.
    Returns DataFrame with columns: driver, position, gap_to_leader
    """
    all_laps = session.laps.copy()
    all_laps["lap_time_sec"] = all_laps["LapTime"].dt.total_seconds()
    all_laps = all_laps.dropna(subset=["lap_time_sec"])
    all_laps = all_laps.rename(columns={
        "Driver": "driver",
        "LapNumber": "lap_number",
        "Position": "position",
    })

    if target_lap is None:
        target_lap = int(all_laps["lap_number"].max())

    # Cumulative lap times up to target_lap
    up_to = all_laps[all_laps["lap_number"] <= target_lap]
    cum = up_to.groupby("driver")["lap_time_sec"].sum()
    leader_time = cum.min() if not cum.empty else 0.0

    # Position at target_lap
    at_lap = all_laps[all_laps["lap_number"] == target_lap]
    pos = at_lap.drop_duplicates(subset=["driver"]).set_index("driver")["position"]

    result = pd.DataFrame({
        "driver": cum.index,
        "position": [int(pos.get(d, 0)) for d in cum.index],
        "gap_to_leader": [round(float(cum[d] - leader_time), 3) for d in cum.index],
    })
    return result


def get_live_session_info(session_key: int | str = "latest") -> dict | None:
    """
    Fetch current session metadata from OpenF1.
    Returns dict with year, circuit_short_name, session_type, session_key, etc.
    Returns None if no session is active or on error.
    """
    try:
        resp = requests.get(
            f"{OPENF1_BASE_URL}/sessions",
            params={"session_key": session_key},
            timeout=OPENF1_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None
        # OpenF1 returns a list; take the last entry
        session = data[-1]
        return session
    except Exception as exc:
        logger.warning("OpenF1 session request failed: %s", exc)
        return None


def get_live_drivers(session_key: int | str | None = None) -> dict[int, str]:
    """
    Fetch driver number → 3-letter code mapping from OpenF1.
    Returns e.g. {1: "VER", 11: "PER", 44: "HAM", ...}
    """
    params: dict = {}
    if session_key is not None:
        params["session_key"] = session_key

    try:
        resp = requests.get(
            f"{OPENF1_BASE_URL}/drivers",
            params=params,
            timeout=OPENF1_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        mapping: dict[int, str] = {}
        for row in data:
            num = row.get("driver_number")
            code = row.get("name_acronym")
            if num is not None and code:
                mapping[int(num)] = code
        return mapping

    except Exception as exc:
        logger.warning("OpenF1 drivers request failed: %s", exc)
        return {}


def get_live_stints(session_key: int | str | None = None) -> list[dict]:
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


def get_live_laps(session_key: int | str | None = None) -> list[dict]:
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


def get_live_positions(session_key: int | str | None = None) -> list[dict]:
    """
    Fetch current driver positions from OpenF1 /position.
    Returns empty list on any error — never raises.

    Deduplicates on driver_number keeping the most recent entry by date.
    """
    params: dict = {}
    if session_key is not None:
        params["session_key"] = session_key

    try:
        response = requests.get(
            f"{OPENF1_BASE_URL}/position",
            params=params,
            timeout=OPENF1_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

        # Keep most recent entry per driver (ISO 8601 sort is lexicographic)
        data.sort(key=lambda r: r.get("date", ""), reverse=True)
        seen: set = set()
        unique = []
        for row in data:
            drv = row.get("driver_number")
            if drv not in seen:
                seen.add(drv)
                unique.append(row)
        return unique

    except Exception as exc:
        logger.warning("OpenF1 position request failed: %s", exc)
        return []


def get_live_intervals(session_key: int | str | None = None) -> list[dict]:
    """
    Fetch current timing intervals from OpenF1 /intervals.
    Returns empty list on any error — never raises.

    gap_to_leader may be None (race leader) or a string like "+3.412".
    Normalises all gap_to_leader values to float seconds (0.0 for the leader).
    Deduplicates on driver_number keeping the most recent entry by date.
    """
    params: dict = {}
    if session_key is not None:
        params["session_key"] = session_key

    try:
        response = requests.get(
            f"{OPENF1_BASE_URL}/intervals",
            params=params,
            timeout=OPENF1_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

        # Keep most recent entry per driver
        data.sort(key=lambda r: r.get("date", ""), reverse=True)
        seen: set = set()
        unique = []
        for row in data:
            drv = row.get("driver_number")
            if drv not in seen:
                seen.add(drv)
                # Normalise gap_to_leader to float
                raw_gap = row.get("gap_to_leader")
                try:
                    row["gap_to_leader"] = float(str(raw_gap).lstrip("+")) if raw_gap is not None else 0.0
                except (ValueError, TypeError):
                    row["gap_to_leader"] = 0.0
                unique.append(row)
        return unique

    except Exception as exc:
        logger.warning("OpenF1 intervals request failed: %s", exc)
        return []
