import logging
import os
from concurrent.futures import ThreadPoolExecutor

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from benchmarks import load_baseline_curves
from constants import COMPOUNDS, get_circuit_for_round
from degradation import fit_all_compounds
from ingestion import CURRENT_YEAR, get_laps, get_live_drivers, get_live_intervals, get_live_laps, get_live_positions, get_live_stints, get_race_state, load_session
from models import DegradationCurve, ErrorResponse, LiveStrategyResponse, ManualStrategyRequest, StrategyResponse
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
def get_strategy(year: int, round_number: int, driver: str):
    driver = driver.upper()
    try:
        session = load_session(year, round_number)
        laps = get_laps(session)
        curves = fit_all_compounds(laps)
        current_lap = int(laps["lap_number"].max())
        race_state = get_race_state(session, current_lap)
        driver_states = build_driver_states(laps, current_lap, race_state)
        circuit = session.event.get("Location") if hasattr(session, "event") else None
        result = recommend(driver, driver_states, curves, circuit)
        return StrategyResponse(**result)
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
        result = recommend(driver, driver_states, curves, circuit)

        return LiveStrategyResponse(
            **result,
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


@app.get("/live/laps", response_model=list[dict])
def live_laps():
    return get_live_laps()


@app.get("/live/stints", response_model=list[dict])
def live_stints():
    return get_live_stints()


@app.get("/live/strategy/{driver}", response_model=StrategyResponse)
def live_strategy(driver: str):
    driver = driver.upper()
    try:
        stints = get_live_stints()
        laps = get_live_laps()

        if not stints or not laps:
            raise HTTPException(status_code=503, detail="Live timing unavailable")

        # Build minimal driver states from live OpenF1 data
        driver_states: dict[str, dict] = {}
        for stint in stints:
            drv_num = str(stint.get("driver_number"))
            driver_states[drv_num] = {
                "compound": stint.get("compound", "UNKNOWN"),
                "tyre_age": stint.get("tyre_age_at_start", 0) + (stint.get("lap_end") or 0) - (stint.get("lap_start") or 0),
                "position": 0,
                "gap_to_leader": 0.0,
            }

        if driver not in driver_states:
            raise HTTPException(status_code=404, detail=f"Driver {driver} not found in live data")

        # Curves unavailable in live mode without a historical session baseline
        raise HTTPException(status_code=503, detail="Live strategy requires a baseline session — not yet implemented")

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error in /live/strategy/%s: %s", driver, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
