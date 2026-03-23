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
    cliff_lap: int | None = None
    temp_coefficient: float | None = None
    type: str = "quadratic"  # "quadratic" or "piecewise"


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
    status: str = ""  # "", "PIT", "DNF", "DSQ", "RETIRED"


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


class SectorTime(BaseModel):
    driver: str
    s1: float | None
    s2: float | None
    s3: float | None
    s1_color: str
    s2_color: str
    s3_color: str


class WeatherDataPoint(BaseModel):
    lap: int
    air_temp: float
    track_temp: float
    humidity: float
    rainfall: bool


class GapEvolutionPoint(BaseModel):
    lap: int
    gaps: dict[str, float]


class RaceControlEvent(BaseModel):
    type: str  # "SC", "VSC", "RED"
    start_lap: int
    end_lap: int


class StintInfo(BaseModel):
    driver: str
    stint_number: int
    compound: str
    lap_start: int
    lap_end: int


class PositionHistoryPoint(BaseModel):
    lap: int
    positions: dict[str, int]


class LapTimeStats(BaseModel):
    driver: str
    median: float
    q1: float
    q3: float
    min: float
    max: float
    whisker_low: float
    whisker_high: float
    lap_count: int


class PitStopInfo(BaseModel):
    driver: str
    lap: int
    pit_duration: float
    compound_before: str
    compound_after: str


class WhatIfResponse(BaseModel):
    driver: str
    hypothetical_pit_lap: int
    new_compound: str
    projected_net_delta: float
    projected_crossover: int
    projected_optimal_lap: int
    recommendation: str
    actual_compound: str
    actual_tyre_age: int


class RaceSummary(BaseModel):
    fastest_lap: dict | None = None
    biggest_gainer: dict | None = None
    best_pit_stop: dict | None = None
    worst_pit_stop: dict | None = None
    most_overtakes: dict | None = None
    total_overtakes: int = 0
    leader_changes: int = 0
    safety_car_periods: int = 0
    red_flags: int = 0
    unique_strategies: int = 0
    total_pit_stops: int = 0


class TyrePrediction(BaseModel):
    driver: str
    compound: str
    tyre_age: int
    predicted_cliff_lap: int
    estimated_laps_remaining: int


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
    degradation_confidence: float = 0.0  # 0.0-1.0, from Bayesian updating
