import logging
import os
from datetime import date

import fastf1
import numpy as np
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


def get_driver_statuses(session: fastf1.core.Session, target_lap: int) -> dict[str, str]:
    """
    Determine each driver's status at a given lap: "", "PIT", "DNF", "DSQ".
    - PIT: driver pitted in on this lap (PitInTime is set)
    - DNF/DSQ/RETIRED: from session.results Status column, only if their last lap <= target_lap
    - "": normal racing
    """
    all_laps = session.laps.copy()
    statuses: dict[str, str] = {}

    # Get final race results for DNF/DSQ detection
    results_status: dict[str, str] = {}
    results_last_lap: dict[str, int] = {}
    try:
        results = session.results
        for _, row in results.iterrows():
            abbr = row.get("Abbreviation", "")
            status = str(row.get("Status", ""))
            laps_completed = int(row.get("Laps", 0)) if pd.notna(row.get("Laps")) else 0
            if abbr:
                results_status[abbr] = status
                results_last_lap[abbr] = laps_completed
    except Exception:
        pass

    # Collect all drivers: from laps + from results
    all_driver_codes = set(all_laps["Driver"].unique())
    all_driver_codes.update(results_status.keys())

    for driver in all_driver_codes:
        drv_laps = all_laps[all_laps["Driver"] == driver]
        lap_row = drv_laps[drv_laps["LapNumber"] == target_lap]

        # Check if driver DNF/DSQ'd before or at this lap
        final_status = results_status.get(driver, "Finished")
        last_lap = results_last_lap.get(driver, 999)

        if final_status == "Disqualified":
            statuses[driver] = "DSQ"
            continue

        if final_status in ("Retired", "+1 Lap", "+2 Laps", "+3 Laps", "+4 Laps", "+5 Laps"):
            # For "Retired", mark DNF if they retired before or at this lap
            if final_status == "Retired" and last_lap < target_lap:
                statuses[driver] = "DNF"
                continue
            # For lapped drivers, they're still racing
        elif final_status not in ("Finished", "Lapped", ""):
            # Other non-standard statuses (e.g. accident, mechanical) → treat as DNF
            if last_lap < target_lap:
                statuses[driver] = "DNF"
                continue

        # Driver has no lap data at all → DNF from the start
        if drv_laps.empty:
            statuses[driver] = "DNF"
            continue

        # Check if driver is in pits on this lap
        if not lap_row.empty:
            pit_in = lap_row.iloc[0].get("PitInTime")
            if pd.notna(pit_in):
                statuses[driver] = "PIT"
                continue

        # If driver has no data at this lap but hasn't DNF'd, they might still be in pits
        if lap_row.empty and last_lap >= target_lap:
            prev_lap = drv_laps[drv_laps["LapNumber"] == target_lap - 1]
            if not prev_lap.empty and pd.notna(prev_lap.iloc[0].get("PitInTime")):
                statuses[driver] = "PIT"
                continue

        statuses[driver] = ""

    return statuses


def get_race_state(session: fastf1.core.Session, target_lap: int | None = None) -> pd.DataFrame:
    """
    Extract position and gap_to_leader for every driver at a specific lap.
    Uses the 'Time' column (finish-line crossing timestamp) for accurate gaps.
    Returns DataFrame with columns: driver, position, gap_to_leader
    """
    all_laps = session.laps.copy()
    all_laps = all_laps.rename(columns={
        "Driver": "driver",
        "LapNumber": "lap_number",
        "Position": "position",
    })

    if target_lap is None:
        target_lap = int(all_laps["lap_number"].max())

    # Use finish-line crossing time for gap calculation
    at_lap = all_laps[all_laps["lap_number"] == target_lap].copy()
    at_lap = at_lap.drop_duplicates(subset=["driver"])

    if "Time" in at_lap.columns and not at_lap["Time"].dropna().empty:
        # Time = timedelta from session start when driver crossed the line
        at_lap["cross_sec"] = at_lap["Time"].dt.total_seconds()
        at_lap = at_lap.dropna(subset=["cross_sec"])
        leader_time = at_lap["cross_sec"].min() if not at_lap.empty else 0.0

        result = pd.DataFrame({
            "driver": at_lap["driver"].values,
            "position": [int(p) if pd.notna(p) else 0 for p in at_lap["position"].values],
            "gap_to_leader": [round(float(t - leader_time), 3) for t in at_lap["cross_sec"].values],
        })
    else:
        # Fallback: cumulative lap times (less accurate)
        all_laps["lap_time_sec"] = all_laps["LapTime"].dt.total_seconds()
        all_laps = all_laps.dropna(subset=["lap_time_sec"])
        up_to = all_laps[all_laps["lap_number"] <= target_lap]
        cum = up_to.groupby("driver")["lap_time_sec"].sum()
        leader_time = cum.min() if not cum.empty else 0.0
        pos = at_lap.set_index("driver")["position"]
        result = pd.DataFrame({
            "driver": cum.index,
            "position": [int(pos.get(d, 0)) for d in cum.index],
            "gap_to_leader": [round(float(cum[d] - leader_time), 3) for d in cum.index],
        })

    return result


def get_sector_times(session: fastf1.core.Session, target_lap: int) -> list[dict]:
    """
    Extract sector times for all drivers at a specific lap, with color coding.

    Colors: "purple" = overall session best, "green" = driver personal best, "yellow" = slower.
    Returns list of dicts: {driver, s1, s2, s3, s1_color, s2_color, s3_color}
    """
    all_laps = session.laps.copy()

    sector_cols = ["Sector1Time", "Sector2Time", "Sector3Time"]
    for col in sector_cols:
        if col not in all_laps.columns:
            return []

    # Overall best per sector (across entire session)
    overall_best = {}
    for col in sector_cols:
        vals = all_laps[col].dropna()
        overall_best[col] = vals.min().total_seconds() if not vals.empty else None

    # Personal best per driver up to target_lap
    up_to = all_laps[all_laps["LapNumber"] <= target_lap]
    pb = {}
    for drv, grp in up_to.groupby("Driver"):
        pb[drv] = {}
        for col in sector_cols:
            vals = grp[col].dropna()
            pb[drv][col] = vals.min().total_seconds() if not vals.empty else None

    # Sectors at target_lap
    at_lap = all_laps[all_laps["LapNumber"] == target_lap]
    results = []
    for _, row in at_lap.iterrows():
        drv = row["Driver"]
        entry: dict = {"driver": drv}

        for col, key in zip(sector_cols, ["s1", "s2", "s3"]):
            val = row[col]
            if pd.isna(val):
                entry[key] = None
                entry[f"{key}_color"] = "yellow"
                continue

            sec = round(val.total_seconds(), 3)
            entry[key] = sec

            # Determine color
            if overall_best[col] is not None and abs(sec - overall_best[col]) < 0.001:
                entry[f"{key}_color"] = "purple"
            elif drv in pb and pb[drv][col] is not None and abs(sec - pb[drv][col]) < 0.001:
                entry[f"{key}_color"] = "green"
            else:
                entry[f"{key}_color"] = "yellow"

        results.append(entry)

    return results


def get_weather_data(session: fastf1.core.Session) -> list[dict]:
    """
    Extract per-lap weather data from a session.

    Returns list of {lap, air_temp, track_temp, humidity, rainfall}.
    Returns empty list if weather columns are not available.
    """
    all_laps = session.laps.copy()

    weather_cols = {"AirTemp": "air_temp", "TrackTemp": "track_temp", "Humidity": "humidity", "Rainfall": "rainfall"}
    available = {k: v for k, v in weather_cols.items() if k in all_laps.columns}
    if not available:
        return []

    grouped = all_laps.groupby("LapNumber")[list(available.keys())].mean()
    grouped = grouped.ffill().fillna(0)

    results = []
    for lap_num, row in grouped.iterrows():
        entry: dict = {"lap": int(lap_num)}
        for src, dst in available.items():
            if dst == "rainfall":
                entry[dst] = bool(row.get(src, 0) > 0)
            else:
                entry[dst] = round(float(row.get(src, 0)), 1)
        # Fill missing keys with defaults
        for dst in weather_cols.values():
            if dst not in entry:
                entry[dst] = False if dst == "rainfall" else 0.0
        results.append(entry)

    return results


def get_gap_evolution(session: fastf1.core.Session, driver: str) -> list[dict]:
    """
    Compute lap-by-lap gap between a driver and all other drivers.

    Uses the 'Time' column (finish-line crossing timestamp) for accurate gaps.
    gap = rival_cross_time - target_cross_time (positive = target ahead of rival).
    Returns list of {lap, gaps: {rival_code: gap_seconds}}.
    """
    driver = driver.upper()
    all_laps = session.laps.copy()
    all_laps = all_laps.rename(columns={"Driver": "driver", "LapNumber": "lap_number"})
    all_laps = all_laps.sort_values(["driver", "lap_number"])

    # Use finish-line crossing time (Time column) for accurate gap calculation
    has_time = "Time" in all_laps.columns and not all_laps["Time"].dropna().empty
    if has_time:
        all_laps["cross_sec"] = all_laps["Time"].dt.total_seconds()
        all_laps = all_laps.dropna(subset=["cross_sec"])
        time_col = "cross_sec"
    else:
        # Fallback to cumulative lap times
        all_laps["lap_time_sec"] = all_laps["LapTime"].dt.total_seconds()
        all_laps = all_laps.dropna(subset=["lap_time_sec"])
        all_laps["cum_time"] = all_laps.groupby("driver")["lap_time_sec"].cumsum()
        time_col = "cum_time"

    # Include all other drivers as rivals
    rivals = all_laps[all_laps["driver"] != driver]["driver"].unique().tolist()

    if not rivals:
        return []

    # Pivot: rows=lap, columns=driver, values=crossing time
    relevant = all_laps[all_laps["driver"].isin([driver] + rivals)]
    pivot = relevant.pivot_table(index="lap_number", columns="driver", values=time_col)

    results = []
    for lap in sorted(pivot.index):
        if driver not in pivot.columns or pd.isna(pivot.loc[lap, driver]):
            continue
        target_time = pivot.loc[lap, driver]
        gaps: dict[str, float] = {}
        for rival in rivals:
            if rival in pivot.columns and pd.notna(pivot.loc[lap, rival]):
                gaps[rival] = round(float(pivot.loc[lap, rival] - target_time), 3)
        if gaps:
            results.append({"lap": int(lap), "gaps": gaps})

    return results


def get_race_control_events(session: fastf1.core.Session) -> list[dict]:
    """
    Extract safety car, virtual safety car, and red flag periods from race control messages.
    Returns list of {type: "SC"|"VSC"|"RED", start_lap, end_lap}.
    """
    try:
        rcm = session.race_control_messages
    except Exception:
        return []

    if rcm is None or rcm.empty:
        return []

    events: list[dict] = []
    current_event: dict | None = None

    for _, row in rcm.iterrows():
        msg = str(row.get("Message", "")).upper()
        category = str(row.get("Category", "")).lower()
        lap = row.get("Lap")
        lap_num = int(lap) if pd.notna(lap) else None

        if lap_num is None:
            continue

        if "RED FLAG" in msg:
            if current_event:
                current_event["end_lap"] = lap_num
                events.append(current_event)
            current_event = {"type": "RED", "start_lap": lap_num, "end_lap": lap_num}
        elif category == "safetycar" and "VIRTUAL SAFETY CAR DEPLOYED" in msg:
            if current_event:
                current_event["end_lap"] = lap_num
                events.append(current_event)
            current_event = {"type": "VSC", "start_lap": lap_num, "end_lap": lap_num}
        elif category == "safetycar" and "SAFETY CAR DEPLOYED" in msg and "VIRTUAL" not in msg:
            if current_event:
                current_event["end_lap"] = lap_num
                events.append(current_event)
            current_event = {"type": "SC", "start_lap": lap_num, "end_lap": lap_num}
        elif current_event and ("ENDING" in msg or "GREEN" in msg or "RESTART" in msg or "IN THIS LAP" in msg):
            current_event["end_lap"] = lap_num
            events.append(current_event)
            current_event = None

    # Close any unclosed event at the end
    if current_event:
        events.append(current_event)

    return events


def get_stints(session: fastf1.core.Session) -> list[dict]:
    """
    Extract all stint data from a session — each driver's compound, stint number,
    and lap range for the tyre strategy timeline.
    Returns list of {driver, stint_number, compound, lap_start, lap_end}.
    """
    all_laps = session.laps.copy()
    all_laps = all_laps.rename(columns={
        "Driver": "driver",
        "Stint": "stint",
        "Compound": "compound",
        "LapNumber": "lap_number",
    })
    all_laps = all_laps.dropna(subset=["stint", "compound", "lap_number"])

    results = []
    for (drv, stint), grp in all_laps.groupby(["driver", "stint"]):
        compound = grp["compound"].mode().iloc[0] if not grp["compound"].mode().empty else "UNKNOWN"
        results.append({
            "driver": drv,
            "stint_number": int(stint),
            "compound": compound,
            "lap_start": int(grp["lap_number"].min()),
            "lap_end": int(grp["lap_number"].max()),
        })

    results.sort(key=lambda x: (x["driver"], x["stint_number"]))
    return results


def get_position_history(session: fastf1.core.Session) -> list[dict]:
    """
    Extract position per driver per lap for the position change chart.
    Uses ALL laps (not quicklaps) for complete position tracking.
    Returns list of {lap, positions: {driver_code: position}}.
    """
    all_laps = session.laps.copy()
    all_laps = all_laps.rename(columns={
        "Driver": "driver",
        "LapNumber": "lap_number",
        "Position": "position",
    })
    all_laps = all_laps.dropna(subset=["lap_number", "position"])

    results = []
    for lap_num, grp in all_laps.groupby("lap_number"):
        positions: dict[str, int] = {}
        for _, row in grp.iterrows():
            positions[row["driver"]] = int(row["position"])
        results.append({"lap": int(lap_num), "positions": positions})

    results.sort(key=lambda x: x["lap"])
    return results


def get_lap_time_stats(session: fastf1.core.Session) -> list[dict]:
    """
    Compute lap time distribution stats per driver (median, Q1, Q3, whiskers).
    Excludes pit in/out laps and SC/VSC laps for clean data.
    Returns list of {driver, median, q1, q3, min, max, whisker_low, whisker_high, lap_count}.
    """
    all_laps = session.laps.copy()

    # Convert lap times
    all_laps["lap_time_sec"] = all_laps["LapTime"].dt.total_seconds()
    all_laps = all_laps.dropna(subset=["lap_time_sec"])
    all_laps = all_laps[all_laps["lap_time_sec"] > 0]

    # Filter SC/VSC laps
    if "TrackStatus" in all_laps.columns:
        all_laps = all_laps[~all_laps["TrackStatus"].astype(str).isin(SC_STATUS_CODES)]

    # Filter pit in/out laps
    if "PitInTime" in all_laps.columns:
        all_laps = all_laps[all_laps["PitInTime"].isna()]
    if "PitOutTime" in all_laps.columns:
        all_laps = all_laps[all_laps["PitOutTime"].isna()]

    results = []
    for driver, grp in all_laps.groupby("Driver"):
        times = grp["lap_time_sec"].values
        if len(times) < 3:
            continue

        q1, median, q3 = np.percentile(times, [25, 50, 75])
        iqr = q3 - q1
        whisker_low = max(float(times.min()), float(q1 - 1.5 * iqr))
        whisker_high = min(float(times.max()), float(q3 + 1.5 * iqr))

        results.append({
            "driver": driver,
            "median": round(float(median), 3),
            "q1": round(float(q1), 3),
            "q3": round(float(q3), 3),
            "min": round(float(times.min()), 3),
            "max": round(float(times.max()), 3),
            "whisker_low": round(whisker_low, 3),
            "whisker_high": round(whisker_high, 3),
            "lap_count": len(times),
        })

    results.sort(key=lambda x: x["median"])
    return results


def get_pit_stops(session: fastf1.core.Session) -> list[dict]:
    """
    Extract pit stop data from session laps using PitInTime/PitOutTime.
    Returns list of {driver, lap, pit_duration, compound_before, compound_after}.
    """
    all_laps = session.laps.copy()

    if "PitInTime" not in all_laps.columns or "PitOutTime" not in all_laps.columns:
        return []

    results = []

    for driver, drv_laps in all_laps.groupby("Driver"):
        drv_laps = drv_laps.sort_values("LapNumber")

        for idx, row in drv_laps.iterrows():
            pit_in = row.get("PitInTime")
            if pd.isna(pit_in):
                continue

            lap_num = int(row["LapNumber"])
            compound_before = str(row.get("Compound", "UNKNOWN"))

            # Find next lap's compound (the new tyres after pit)
            next_laps = drv_laps[drv_laps["LapNumber"] > lap_num]
            compound_after = str(next_laps.iloc[0].get("Compound", "UNKNOWN")) if not next_laps.empty else "UNKNOWN"

            # Calculate pit duration
            pit_out = row.get("PitOutTime")
            # PitOutTime might be on the next lap row
            if pd.isna(pit_out) and not next_laps.empty:
                pit_out = next_laps.iloc[0].get("PitOutTime")

            if pd.notna(pit_in) and pd.notna(pit_out):
                duration = (pit_out - pit_in).total_seconds()
                if duration > 0:
                    results.append({
                        "driver": driver,
                        "lap": lap_num,
                        "pit_duration": round(float(duration), 1),
                        "compound_before": compound_before,
                        "compound_after": compound_after,
                    })

    results.sort(key=lambda x: x["lap"])
    return results


def generate_race_summary(session: fastf1.core.Session) -> dict:
    """
    Generate a post-race summary with key highlights.
    Returns dict with stats like biggest gainer, fastest lap, overtakes, etc.
    """
    all_laps = session.laps.copy()

    # --- Fastest lap ---
    quick_laps = all_laps.pick_quicklaps(threshold=1.1)
    fastest_lap_info = None
    if not quick_laps.empty:
        fastest_idx = quick_laps["LapTime"].idxmin()
        fl = quick_laps.loc[fastest_idx]
        fastest_lap_info = {
            "driver": str(fl["Driver"]),
            "lap": int(fl["LapNumber"]),
            "time": round(fl["LapTime"].total_seconds(), 3),
        }

    # --- Biggest position gainer ---
    results = session.results
    biggest_gainer = None
    biggest_gain = 0
    if results is not None and not results.empty and "GridPosition" in results.columns and "Position" in results.columns:
        for _, row in results.iterrows():
            grid = row.get("GridPosition")
            finish = row.get("Position")
            if pd.notna(grid) and pd.notna(finish) and float(grid) > 0 and float(finish) > 0:
                gain = int(float(grid)) - int(float(finish))
                if gain > biggest_gain:
                    biggest_gain = gain
                    biggest_gainer = {
                        "driver": str(row.get("Abbreviation", row.get("Driver", "???"))),
                        "positions_gained": gain,
                        "grid": int(float(grid)),
                        "finish": int(float(finish)),
                    }

    # --- Pit stops stats ---
    pit_stops = get_pit_stops(session)
    best_pit = None
    worst_pit = None
    if pit_stops:
        sorted_pits = sorted(pit_stops, key=lambda p: p["pit_duration"])
        best_pit = sorted_pits[0]
        worst_pit = sorted_pits[-1]

    # --- Position changes / overtakes ---
    positions = get_position_history(session)
    total_overtakes = 0
    driver_overtakes: dict[str, int] = {}
    for i in range(1, len(positions)):
        prev_pos = positions[i - 1]["positions"]
        curr_pos = positions[i]["positions"]
        for drv, pos in curr_pos.items():
            prev = prev_pos.get(drv)
            if prev is not None and pos < prev:
                gained = prev - pos
                total_overtakes += gained
                driver_overtakes[drv] = driver_overtakes.get(drv, 0) + gained

    most_overtakes = None
    if driver_overtakes:
        top_drv = max(driver_overtakes, key=driver_overtakes.get)  # type: ignore
        most_overtakes = {"driver": top_drv, "overtakes": driver_overtakes[top_drv]}

    # --- Leader changes ---
    leader_changes = 0
    prev_leader = None
    for p in positions:
        leader = min(p["positions"], key=p["positions"].get) if p["positions"] else None  # type: ignore
        if leader and leader != prev_leader:
            leader_changes += 1
            prev_leader = leader
    leader_changes = max(0, leader_changes - 1)  # first lap doesn't count

    # --- Safety car periods ---
    race_control = get_race_control_events(session)
    sc_periods = len([e for e in race_control if e["type"] in ("SC", "VSC")])
    red_flags = len([e for e in race_control if e["type"] == "RED"])

    # --- Strategy diversity ---
    stints = get_stints(session)
    driver_strategies: dict[str, list[str]] = {}
    for s in stints:
        drv = s["driver"]
        if drv not in driver_strategies:
            driver_strategies[drv] = []
        driver_strategies[drv].append(s["compound"])
    unique_strategies = len(set(tuple(v) for v in driver_strategies.values()))

    return {
        "fastest_lap": fastest_lap_info,
        "biggest_gainer": biggest_gainer,
        "best_pit_stop": best_pit,
        "worst_pit_stop": worst_pit,
        "most_overtakes": most_overtakes,
        "total_overtakes": total_overtakes,
        "leader_changes": leader_changes,
        "safety_car_periods": sc_periods,
        "red_flags": red_flags,
        "unique_strategies": unique_strategies,
        "total_pit_stops": len(pit_stops),
    }


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
