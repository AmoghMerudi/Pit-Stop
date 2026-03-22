import logging
import os
from concurrent.futures import ThreadPoolExecutor

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from benchmarks import load_baseline_curves
from constants import COMPOUNDS, ROUND_TO_CIRCUIT, get_circuit_for_round
from degradation import fit_all_compounds
from ingestion import CURRENT_YEAR, get_laps, get_live_drivers, get_live_intervals, get_live_laps, get_live_positions, get_live_session_info, get_live_stints, get_race_state, get_total_laps, load_session
from models import DegradationCurve, ErrorResponse, LiveDriverState, LiveSessionResponse, LiveStrategyResponse, ManualStrategyRequest, StrategyResponse
from rival_model import build_driver_states, build_live_driver_states
from strategy import recommend

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="F1 Pit Stop Strategy Optimizer")

origins = [
    "http://localhost:3000",
    # Add your Vercel production URL here before deploying:
    # "https://your-app.vercel.app",
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


@app.get("/race/{year}/{round_number}/degradation", response_model=list[DegradationCurve])
def get_degradation(year: int, round_number: int):
    try:
        session = load_session(year, round_number)
        laps = get_laps(session)
        curves = fit_all_compounds(laps)
        return [
            DegradationCurve(compound=c, **v)
            for c, v in curves.items()
        ]
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
        laps = get_laps(session)
        curves = fit_all_compounds(laps)
        max_lap = int(laps["lap_number"].max())
        total_laps = get_total_laps(session)
        current_lap = min(lap, max_lap) if lap is not None else max_lap
        remaining_laps = max(1, total_laps - current_lap)
        # Only use laps up to the requested lap for driver states
        laps_at_lap = laps[laps["lap_number"] <= current_lap]
        race_state = get_race_state(session, current_lap)
        driver_states = build_driver_states(laps_at_lap, current_lap, race_state)
        circuit = session.event.get("Location") if hasattr(session, "event") else None
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

        # 1. Load degradation baseline
        curves, curve_source = load_baseline_curves(year, round)

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

        if not stints:
            raise HTTPException(status_code=503, detail="Live timing unavailable — no stint data")

        # 3. Build driver states
        driver_states = build_live_driver_states(stints, positions, intervals, driver_mapping)
        rival_count = len(driver_states)

        if driver not in driver_states:
            raise HTTPException(status_code=404, detail=f"Driver {driver} not found in live data")

        # 4. Circuit + remaining laps
        circuit_name = get_circuit_for_round(year, round)

        # Estimate remaining laps from stint data
        max_lap = 0
        for stint in stints:
            lap_end = stint.get("lap_end")
            if lap_end and int(lap_end) > max_lap:
                max_lap = int(lap_end)
        total_laps = 57  # default
        remaining_laps = max(1, total_laps - max_lap) if max_lap > 0 else total_laps

        # 5. Strategy recommendation
        result = recommend(driver, driver_states, curves, circuit_name, remaining_laps)

        return LiveStrategyResponse(
            **result,
            remaining_laps=remaining_laps,
            curve_source=curve_source,
            rival_count=rival_count,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error in /live/strategy/%s: %s", driver, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/live/laps", response_model=list[dict])
def live_laps():
    return get_live_laps()


@app.get("/live/stints", response_model=list[dict])
def live_stints():
    return get_live_stints()
