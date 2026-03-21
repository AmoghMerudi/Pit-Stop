import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from degradation import fit_all_compounds
from ingestion import get_laps, get_live_laps, get_live_stints, load_session
from models import DegradationCurve, ErrorResponse, StrategyResponse
from rival_model import build_driver_states
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
    allow_methods=["GET"],
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
        driver_states = build_driver_states(laps, current_lap)
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


@app.get("/live/laps")
def live_laps():
    return get_live_laps()


@app.get("/live/stints")
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
