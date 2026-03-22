from pydantic import BaseModel


class ErrorResponse(BaseModel):
    error: str


class DegradationCurve(BaseModel):
    compound: str
    slope: float
    intercept: float
    r2: float


class PitWindowResult(BaseModel):
    crossover_lap: int
    net_delta: float
    undercut_window: bool
    overcut_window: bool


class DriverState(BaseModel):
    driver: str
    compound: str
    tyre_age: int
    position: int
    gap_to_leader: float


class ThreatDetail(BaseModel):
    driver: str
    compound: str
    tyre_age: int
    position: int
    threat_score: float


class StrategyResponse(BaseModel):
    driver: str
    recommend_pit: bool
    reason: str
    optimal_lap: int
    crossover_lap: int
    net_delta: float
    undercut_threats: list[ThreatDetail]
    all_drivers: list[DriverState]
    pit_loss: float
    circuit: str | None
    best_alt: str | None = None


class ManualStrategyRequest(BaseModel):
    year: int
    round: int
    driver: str      # route handler uppercases and strips
    compound: str    # validated against COMPOUNDS in handler
    tyre_age: int    # >= 0, validated in handler


class LiveStrategyResponse(BaseModel):
    driver: str
    recommend_pit: bool
    reason: str
    optimal_lap: int
    crossover_lap: int
    net_delta: float
    undercut_threats: list[ThreatDetail]
    all_drivers: list[DriverState]
    pit_loss: float
    circuit: str | None
    best_alt: str | None = None
    curve_source: str   # "prior_race:2026/3" or "benchmark"
    rival_count: int    # number of rivals found in live OpenF1 data
