import logging
import os
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import requests

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from benchmarks import load_baseline_curves
from degradation import bayesian_update, find_cliff_lap, fuel_correct_laptimes
from constants import COMPOUNDS, ROUND_TO_CIRCUIT, get_circuit_for_round
from degradation import fit_all_compounds, resolve_driver_curves
from ingestion import CURRENT_YEAR, OPENF1_BASE_URL, OPENF1_TIMEOUT, generate_race_summary, get_driver_statuses, get_gap_evolution, get_lap_time_stats, get_laps, get_live_drivers, get_live_intervals, get_live_laps, get_live_positions, get_live_session_info, get_live_stints, get_pit_stops, get_position_history, get_race_control_events, get_race_state, get_sector_times, get_stints, get_total_laps, get_weather_data, load_session
from models import DegradationCurve, DriverCurveResult, DriverInfo, ErrorResponse, GapEvolutionPoint, HealthResponse, LapTimeStats, LiveDriverState, LiveSessionResponse, LiveStrategyResponse, ManualStrategyRequest, PitStopInfo, PositionHistoryPoint, RaceControlEvent, RaceSummary, SectorTime, StintInfo, StrategyResponse, TyrePrediction, WeatherDataPoint, WhatIfResponse
from rival_model import build_driver_states, build_live_driver_states
from strategy import recommend

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Pitwall — F1 Strategy Optimizer")

origins = [
    "http://localhost:3000",
    "https://pitwall-iota.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "ok"}


@app.get("/health", response_model=HealthResponse)
def health():
    """
    Health probe for deployment monitoring.
    Checks backend liveliness and OpenF1 reachability.
    """
    try:
        response = requests.get(
            f"{OPENF1_BASE_URL}/sessions",
            params={"session_key": "latest"},
            timeout=OPENF1_TIMEOUT,
        )
        response.raise_for_status()
        return HealthResponse(
            status="ok",
            backend="ok",
            openf1_reachable=True,
            openf1_base_url=OPENF1_BASE_URL,
            openf1_error=None,
        )
    except Exception as exc:
        logger.warning("Health check OpenF1 probe failed: %s", exc)
        return HealthResponse(
            status="degraded",
            backend="ok",
            openf1_reachable=False,
            openf1_base_url=OPENF1_BASE_URL,
            openf1_error=str(exc),
        )


@app.get("/schedule/{year}")
def get_schedule(year: int):
    """Return the race calendar for a given year."""
    try:
        import fastf1
        schedule = fastf1.get_event_schedule(year)
        # Filter out testing events (RoundNumber == 0)
        races = schedule[schedule["RoundNumber"] > 0]
        return [
            {"round": int(row["RoundNumber"]), "name": row["EventName"]}
            for _, row in races.iterrows()
        ]
    except Exception as exc:
        logger.error("Error in /schedule/%d: %s", year, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Could not load schedule")


@app.get("/race/{year}/{round_number}/drivers", response_model=list[DriverInfo])
def get_drivers(year: int, round_number: int):
    """Return driver info (code, name, team, team color) for a race."""
    try:
        session = load_session(year, round_number)
        results = session.results
        drivers = []
        for _, row in results.iterrows():
            code = row.get("Abbreviation", "")
            if not code:
                continue
            drivers.append(DriverInfo(
                code=str(code),
                name=str(row.get("FullName", code)),
                team=str(row.get("TeamName", "")),
                team_color=str(row.get("TeamColor", "555555")).lstrip("#"),
                number=int(row.get("DriverNumber", 0)),
            ))
        return drivers
    except Exception as exc:
        logger.error("Error in /race/%d/%d/drivers: %s", year, round_number, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Could not load driver info")


@app.get("/race/{year}/{round_number}/degradation", response_model=list[DegradationCurve])
def get_degradation(year: int, round_number: int, driver: str | None = None):
    try:
        session = load_session(year, round_number)
        circuit = session.event.get("Location") if hasattr(session, "event") else None
        laps = get_laps(session)
        laps = fuel_correct_laptimes(laps)
        try:
            weather = get_weather_data(session)
            weather_df = pd.DataFrame([w if isinstance(w, dict) else w.dict() for w in weather]) if weather else None
        except Exception:
            weather_df = None
        all_curves = fit_all_compounds(laps, weather_df=weather_df, circuit_name=circuit)

        if driver:
            driver = driver.upper()
        primary = resolve_driver_curves(all_curves, driver=driver)

        result = []
        for c, v in primary.items():
            per_driver_data: dict[str, DriverCurveResult] | None = None
            raw = all_curves.get(c, {})
            if isinstance(raw, dict) and "_population" in raw:
                per_driver_data = {}
                for dk, dv in raw.items():
                    if dk.startswith("_"):
                        continue
                    per_driver_data[dk] = DriverCurveResult(
                        slope=dv.get("slope", 0.0),
                        intercept=dv.get("intercept", 0.0),
                        r2=dv.get("r2", 0.0),
                        coeffs=dv.get("coeffs"),
                        degree=dv.get("degree", 2),
                        cliff_lap=dv.get("cliff_lap"),
                        cliff_confidence=dv.get("cliff_confidence"),
                        temp_coefficient=dv.get("temp_coefficient"),
                        type=dv.get("type", "quadratic"),
                    )

            result.append(DegradationCurve(
                compound=c,
                slope=v.get("slope", 0.0),
                intercept=v.get("intercept", 0.0),
                r2=v.get("r2", 0.0),
                coeffs=v.get("coeffs"),
                degree=v.get("degree", 2),
                cliff_lap=v.get("cliff_lap"),
                cliff_confidence=v.get("cliff_confidence"),
                temp_coefficient=v.get("temp_coefficient"),
                type=v.get("type", "quadratic"),
                per_driver=per_driver_data,
            ))
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error in /race/%d/%d/degradation: %s", year, round_number, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/race/{year}/{round_number}/strategy/{driver}", response_model=StrategyResponse)
def get_strategy(year: int, round_number: int, driver: str, lap: int | None = None):
    driver = driver.upper()
    try:
        session = load_session(year, round_number)
        circuit = session.event.get("Location") if hasattr(session, "event") else None
        laps = get_laps(session)
        laps = fuel_correct_laptimes(laps)
        all_curves = fit_all_compounds(laps, circuit_name=circuit)
        curves = resolve_driver_curves(all_curves, driver=driver)
        max_lap = int(laps["lap_number"].max())
        total_laps = get_total_laps(session)
        current_lap = min(lap, max_lap) if lap is not None else max_lap
        remaining_laps = max(1, total_laps - current_lap)
        laps_at_lap = laps[laps["lap_number"] <= current_lap]
        race_state = get_race_state(session, current_lap)
        statuses = get_driver_statuses(session, current_lap)
        driver_states = build_driver_states(laps_at_lap, current_lap, race_state, statuses)
        result = recommend(driver, driver_states, curves, circuit, remaining_laps)
        return StrategyResponse(**result, remaining_laps=remaining_laps, total_laps=total_laps, current_lap=current_lap)
    except ValueError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc))
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error in /race/%d/%d/strategy/%s: %s", year, round_number, driver, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/race/{year}/{round_number}/sectors", response_model=list[SectorTime])
def get_sectors(year: int, round_number: int, lap: int = 1):
    try:
        session = load_session(year, round_number)
        return get_sector_times(session, lap)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error in /race/%d/%d/sectors: %s", year, round_number, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/race/{year}/{round_number}/weather", response_model=list[WeatherDataPoint])
def get_weather(year: int, round_number: int):
    try:
        session = load_session(year, round_number)
        return get_weather_data(session)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error in /race/%d/%d/weather: %s", year, round_number, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/race/{year}/{round_number}/gaps/{driver}", response_model=list[GapEvolutionPoint])
def get_gaps(year: int, round_number: int, driver: str):
    driver = driver.upper()
    try:
        session = load_session(year, round_number)
        return get_gap_evolution(session, driver)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error in /race/%d/%d/gaps/%s: %s", year, round_number, driver, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/race/{year}/{round_number}/race-control", response_model=list[RaceControlEvent])
def get_race_control(year: int, round_number: int):
    try:
        session = load_session(year, round_number)
        return get_race_control_events(session)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error in /race/%d/%d/race-control: %s", year, round_number, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/race/{year}/{round_number}/stints", response_model=list[StintInfo])
def get_race_stints(year: int, round_number: int):
    try:
        session = load_session(year, round_number)
        return get_stints(session)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error in /race/%d/%d/stints: %s", year, round_number, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/race/{year}/{round_number}/positions", response_model=list[PositionHistoryPoint])
def get_positions(year: int, round_number: int):
    try:
        session = load_session(year, round_number)
        return get_position_history(session)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error in /race/%d/%d/positions: %s", year, round_number, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/race/{year}/{round_number}/laptimes", response_model=list[LapTimeStats])
def get_laptimes(year: int, round_number: int):
    try:
        session = load_session(year, round_number)
        return get_lap_time_stats(session)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error in /race/%d/%d/laptimes: %s", year, round_number, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/race/{year}/{round_number}/pitstops", response_model=list[PitStopInfo])
def get_pitstops(year: int, round_number: int):
    try:
        session = load_session(year, round_number)
        return get_pit_stops(session)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error in /race/%d/%d/pitstops: %s", year, round_number, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/race/{year}/{round_number}/summary", response_model=RaceSummary)
def get_summary(year: int, round_number: int):
    try:
        session = load_session(year, round_number)
        return generate_race_summary(session)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error in /race/%d/%d/summary: %s", year, round_number, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/race/{year}/{round_number}/what-if/{driver}", response_model=WhatIfResponse)
def what_if(year: int, round_number: int, driver: str, pit_lap: int = 1, new_compound: str = "MEDIUM"):
    """Simulate: what if driver pitted on a different lap for a different compound?"""
    driver = driver.upper()
    new_compound = new_compound.upper()
    try:
        session = load_session(year, round_number)
        circuit = session.event.get("Location") if hasattr(session, "event") else None
        laps = get_laps(session)
        laps = fuel_correct_laptimes(laps)
        all_curves = fit_all_compounds(laps, circuit_name=circuit)
        curves = resolve_driver_curves(all_curves, driver=driver)
        total_laps = get_total_laps(session)
        max_lap = int(laps["lap_number"].max())

        # Build driver states at the hypothetical pit lap
        race_state = get_race_state(session, min(pit_lap, max_lap))
        statuses = get_driver_statuses(session, min(pit_lap, max_lap))
        driver_states = build_driver_states(laps[laps["lap_number"] <= pit_lap], pit_lap, race_state, statuses)

        if driver not in driver_states:
            raise HTTPException(status_code=404, detail=f"Driver {driver} not found")

        actual_state = driver_states[driver]
        actual_compound = actual_state["compound"]
        actual_tyre_age = actual_state["tyre_age"]

        # Simulate: after pitting, driver has fresh tyres of new_compound
        simulated_state = dict(actual_state)
        simulated_state["compound"] = new_compound
        simulated_state["tyre_age"] = 0

        remaining = max(1, total_laps - pit_lap)
        circuit = session.event.get("Location") if hasattr(session, "event") else None

        from pit_window import get_pit_window
        window = get_pit_window(simulated_state, curves, circuit, remaining)

        # Determine recommendation text
        if window["net_delta"] > 0:
            rec = f"Pitting on lap {pit_lap} for {new_compound} saves {window['net_delta']:.1f}s"
        elif window["net_delta"] > -2:
            rec = f"Marginal — pitting on lap {pit_lap} costs only {abs(window['net_delta']):.1f}s"
        else:
            rec = f"Suboptimal — pitting on lap {pit_lap} costs {abs(window['net_delta']):.1f}s"

        return WhatIfResponse(
            driver=driver,
            hypothetical_pit_lap=pit_lap,
            new_compound=new_compound,
            projected_net_delta=round(window["net_delta"], 3),
            projected_crossover=window["crossover_lap"],
            projected_optimal_lap=window["optimal_lap"],
            recommendation=rec,
            actual_compound=actual_compound,
            actual_tyre_age=actual_tyre_age,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error("Error in /race/%d/%d/what-if/%s: %s", year, round_number, driver, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/live/manual-strategy", response_model=LiveStrategyResponse)
def live_manual_strategy(body: ManualStrategyRequest):
    driver = body.driver.strip().upper()

    # Validate inputs
    if body.year < 2018 or body.year > CURRENT_YEAR:
        raise HTTPException(status_code=400, detail=f"Year must be between 2018 and {CURRENT_YEAR}")
    if body.round < 1 or body.round > 24:
        raise HTTPException(status_code=400, detail="Round must be between 1 and 24")
    if body.compound not in COMPOUNDS:
        raise HTTPException(status_code=400, detail=f"Unknown compound: {body.compound}")
    if body.tyre_age < 0:
        raise HTTPException(status_code=400, detail="tyre_age must be >= 0")

    try:
        # 1. Load degradation baseline (prior race or benchmark fallback)
        curves, curve_source = load_baseline_curves(body.year, body.round)

        # 2. Fetch live rival data in parallel
        with ThreadPoolExecutor(max_workers=4) as executor:
            f_stints = executor.submit(get_live_stints, "latest")
            f_positions = executor.submit(get_live_positions, "latest")
            f_intervals = executor.submit(get_live_intervals, "latest")
            f_drivers = executor.submit(get_live_drivers, "latest")
            stints = f_stints.result()
            positions = f_positions.result()
            intervals = f_intervals.result()
            driver_mapping = f_drivers.result()

        # 3. Build rival states from OpenF1 live feeds (keyed by 3-letter code)
        driver_states = build_live_driver_states(stints, positions, intervals, driver_mapping)
        rival_count = len(driver_states)

        # 4. Inject user's driver state (override compound + tyre_age with what user entered)
        # Driver states are keyed by driver number strings ("1", "11", etc.)
        # but user enters 3-letter codes ("VER"). Use 3-letter code as key —
        # undercut comparison still works across mixed key types.
        # Default position to mid-pack (10) so threat detection isn't skewed.
        existing = driver_states.get(driver, {})
        driver_states[driver] = {
            "compound": body.compound,
            "tyre_age": body.tyre_age,
            "position": existing.get("position", 10),
            "gap_to_leader": existing.get("gap_to_leader", 0.0),
        }

        # 5. Look up circuit for pit loss calculation
        circuit = get_circuit_for_round(body.year, body.round)

        # 6. Run strategy recommendation
        remaining_laps = max(1, body.total_laps - body.current_lap) if body.current_lap > 0 else body.total_laps
        result = recommend(driver, driver_states, curves, circuit, remaining_laps)

        return LiveStrategyResponse(
            **result,
            remaining_laps=remaining_laps,
            curve_source=curve_source,
            rival_count=rival_count,
            degradation_confidence=0.0,
        )

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error in POST /live/manual-strategy: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/live/session", response_model=LiveSessionResponse)
def live_session():
    """Check if a live F1 session is active and return its metadata."""
    info = get_live_session_info("latest")
    if not info:
        return LiveSessionResponse(active=False)

    # Determine year and round from session info
    year = info.get("year")
    session_type = info.get("session_type")
    circuit = info.get("circuit_short_name")
    country = info.get("country_name")
    session_key = info.get("session_key")

    # Only consider Race sessions as "active" for strategy
    is_race = session_type == "Race" if session_type else False

    # Try to find round number from our mapping
    round_number = None
    if year:
        for (y, r), c in ROUND_TO_CIRCUIT.items():
            if y == year and c and circuit and c.lower() in circuit.lower():
                round_number = r
                break

    return LiveSessionResponse(
        active=is_race,
        session_key=session_key,
        session_type=session_type,
        circuit=circuit,
        country=country,
        year=year,
        round=round_number,
    )


@app.get("/live/grid", response_model=list[LiveDriverState])
def live_grid():
    """Return all drivers on the live grid with their current state."""
    try:
        with ThreadPoolExecutor(max_workers=4) as executor:
            f_stints = executor.submit(get_live_stints, "latest")
            f_positions = executor.submit(get_live_positions, "latest")
            f_intervals = executor.submit(get_live_intervals, "latest")
            f_drivers = executor.submit(get_live_drivers, "latest")
            stints = f_stints.result()
            positions = f_positions.result()
            intervals = f_intervals.result()
            driver_mapping = f_drivers.result()

        if not stints:
            return []

        driver_states = build_live_driver_states(stints, positions, intervals, driver_mapping)

        grid = []
        for drv, state in driver_states.items():
            grid.append(LiveDriverState(
                driver=drv,
                compound=state["compound"],
                tyre_age=state["tyre_age"],
                position=state["position"],
                gap_to_leader=state["gap_to_leader"],
            ))

        grid.sort(key=lambda d: d.position if d.position > 0 else 999)
        return grid

    except Exception as exc:
        logger.error("Error in /live/grid: %s", exc, exc_info=True)
        return []


@app.get("/live/strategy/{driver}", response_model=LiveStrategyResponse)
def live_strategy(driver: str, year: int | None = None, round: int | None = None):
    """
    Compute live strategy for a driver using real-time OpenF1 data.
    Year and round can be passed as query params, or auto-detected from the live session.
    """
    driver = driver.upper()
    try:
        # Auto-detect year/round from live session if not provided
        if year is None or round is None:
            info = get_live_session_info("latest")
            if not info:
                raise HTTPException(status_code=503, detail="No active live session")
            year = year or info.get("year", CURRENT_YEAR)
            if round is None:
                circuit = info.get("circuit_short_name", "")
                for (y, r), c in ROUND_TO_CIRCUIT.items():
                    if y == year and c and circuit and c.lower() in circuit.lower():
                        round = r
                        break
                if round is None:
                    round = 1  # fallback

        # 1. Load degradation baseline (prior race or benchmarks)
        curves, curve_source = load_baseline_curves(year, round)

        # 2. Fetch live rival data in parallel
        with ThreadPoolExecutor(max_workers=5) as executor:
            f_stints = executor.submit(get_live_stints, "latest")
            f_positions = executor.submit(get_live_positions, "latest")
            f_intervals = executor.submit(get_live_intervals, "latest")
            f_drivers = executor.submit(get_live_drivers, "latest")
            f_laps = executor.submit(get_live_laps)
            stints = f_stints.result()
            positions = f_positions.result()
            intervals = f_intervals.result()
            driver_mapping = f_drivers.result()
            live_laps_raw = f_laps.result()

        if not stints:
            raise HTTPException(status_code=503, detail="Live timing unavailable — no stint data")

        # 3. Bayesian update: refine prior curves with live lap data
        degradation_confidence = 0.0
        if live_laps_raw:
            try:
                live_df = pd.DataFrame(live_laps_raw)
                if not live_df.empty and "lap_time" in live_df.columns:
                    live_df = fuel_correct_laptimes(live_df)
                    curves, degradation_confidence = bayesian_update(curves, live_df)
            except Exception as exc:
                logger.warning("Bayesian update failed: %s", exc)

        # 4. Build driver states
        driver_states = build_live_driver_states(stints, positions, intervals, driver_mapping)
        rival_count = len(driver_states)

        if driver not in driver_states:
            raise HTTPException(status_code=404, detail=f"Driver {driver} not found in live data")

        # 5. Circuit + remaining laps
        circuit_name = get_circuit_for_round(year, round)

        # Estimate remaining laps from stint data
        max_lap = 0
        for stint in stints:
            lap_end = stint.get("lap_end")
            if lap_end and int(lap_end) > max_lap:
                max_lap = int(lap_end)
        total_laps = 57  # default
        remaining_laps = max(1, total_laps - max_lap) if max_lap > 0 else total_laps

        # 6. Strategy recommendation
        result = recommend(driver, driver_states, curves, circuit_name, remaining_laps)

        return LiveStrategyResponse(
            **result,
            remaining_laps=remaining_laps,
            curve_source=curve_source,
            rival_count=rival_count,
            degradation_confidence=round(degradation_confidence, 2),
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error in /live/strategy/%s: %s", driver, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/live/tyre-prediction", response_model=list[TyrePrediction])
def live_tyre_prediction(year: int | None = None, round: int | None = None):
    """Predict tyre cliff for each driver on the live grid."""
    try:
        # Auto-detect year/round from live session if not provided
        if year is None or round is None:
            info = get_live_session_info("latest")
            if not info:
                return []
            year = year or info.get("year", CURRENT_YEAR)
            if round is None:
                circuit = info.get("circuit_short_name", "")
                for (y, r), c in ROUND_TO_CIRCUIT.items():
                    if y == year and c and circuit and c.lower() in circuit.lower():
                        round = r
                        break
                if round is None:
                    round = 1

        # Load baseline curves
        curves_raw, _ = load_baseline_curves(year, round)

        # Fetch live grid
        with ThreadPoolExecutor(max_workers=4) as executor:
            f_stints = executor.submit(get_live_stints, "latest")
            f_positions = executor.submit(get_live_positions, "latest")
            f_intervals = executor.submit(get_live_intervals, "latest")
            f_drivers = executor.submit(get_live_drivers, "latest")
            stints = f_stints.result()
            positions = f_positions.result()
            intervals = f_intervals.result()
            driver_mapping = f_drivers.result()

        if not stints:
            return []

        driver_states = build_live_driver_states(stints, positions, intervals, driver_mapping)

        predictions = []
        for drv, state in driver_states.items():
            compound = state["compound"]
            tyre_age = state["tyre_age"]
            cliff_lap = find_cliff_lap(compound, curves_raw)
            remaining = max(0, cliff_lap - tyre_age)
            predictions.append(TyrePrediction(
                driver=drv,
                compound=compound,
                tyre_age=tyre_age,
                predicted_cliff_lap=cliff_lap,
                estimated_laps_remaining=remaining,
            ))

        predictions.sort(key=lambda p: p.estimated_laps_remaining)
        return predictions

    except Exception as exc:
        logger.error("Error in /live/tyre-prediction: %s", exc, exc_info=True)
        return []


@app.get("/live/laps", response_model=list[dict])
def live_laps():
    return get_live_laps()


@app.get("/live/stints", response_model=list[dict])
def live_stints():
    return get_live_stints()
