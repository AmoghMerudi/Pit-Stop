from pydantic import BaseModel


class ErrorResponse(BaseModel):
    error: str


class DegradationCurve(BaseModel):
    compound: str
    slope: float
    intercept: float
    r2: float
    coeffs: list[float] | None = None
    degree: int = 1


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
    remaining_laps: int = 20
    total_laps: int | None = None
    current_lap: int | None = None


class ManualStrategyRequest(BaseModel):
    year: int
    round: int
    driver: str      # route handler uppercases and strips
    compound: str    # validated against COMPOUNDS in handler
    tyre_age: int    # >= 0, validated in handler
    current_lap: int = 0      # current lap in race (0 = unknown)
    total_laps: int = 57      # total race laps (default typical F1 race)


class LiveSessionResponse(BaseModel):
    active: bool
    session_key: int | None = None
    session_type: str | None = None  # "Race", "Qualifying", etc.
    circuit: str | None = None
    country: str | None = None
    year: int | None = None
    round: int | None = None


class LiveDriverState(BaseModel):
    driver: str
    compound: str
    tyre_age: int
    position: int
    gap_to_leader: float


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
    remaining_laps: int = 20
    curve_source: str   # "prior_race:2026/3" or "benchmark"
    rival_count: int    # number of rivals found in live OpenF1 data
