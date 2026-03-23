const BASE_URL = process.env.NEXT_PUBLIC_API_URL

if (!BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set")
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message = body?.error ?? body?.detail ?? `HTTP ${res.status} ${res.statusText}`
    throw new Error(`API error ${res.status}: ${message}`)
  }
  return res.json()
}

// --- Types ---

export interface DriverCurveResult {
  slope: number
  intercept: number
  r2: number
  coeffs?: number[]
  degree?: number
  cliff_lap?: number | null
  cliff_confidence?: "high" | "low" | null
  temp_coefficient?: number | null
  type?: string
}

export interface DegradationCurve {
  compound: string
  slope: number
  intercept: number
  r2: number
  coeffs?: number[]
  degree?: number
  cliff_lap?: number | null
  cliff_confidence?: "high" | "low" | null
  temp_coefficient?: number | null
  type?: string
  per_driver?: Record<string, DriverCurveResult> | null
}

export interface ThreatDetail {
  driver: string
  compound: string
  tyre_age: number
  position: number
  threat_score: number
}

export interface DriverStateResponse {
  driver: string
  compound: string
  tyre_age: number
  position: number
  gap_to_leader: number
  status: string // "", "PIT", "DNF", "DSQ", "RETIRED"
}

export interface StrategyResponse {
  driver: string
  recommend_pit: boolean
  reason: string
  optimal_lap: number
  crossover_lap: number
  net_delta: number
  undercut_threats: ThreatDetail[]
  all_drivers: DriverStateResponse[]
  pit_loss: number
  circuit: string | null
  best_alt: string | null
  remaining_laps: number
  total_laps: number | null
  current_lap: number | null
}

export interface LiveLap {
  driver_number: number
  lap_number: number
  lap_duration: number | null
  i1_speed: number
  i2_speed: number
  st_speed: number
  date_start: string
}

export interface LiveStint {
  driver_number: number
  stint_number: number
  lap_start: number
  lap_end: number | null
  compound: string
  tyre_age_at_start: number
}

// --- API functions ---

export interface RaceEvent {
  round: number
  name: string
}

export function getSchedule(year: number): Promise<RaceEvent[]> {
  return apiFetch(`/schedule/${year}`)
}

export function getDegradation(year: number, round: number, driver?: string): Promise<DegradationCurve[]> {
  const query = driver ? `?driver=${driver}` : ""
  return apiFetch(`/race/${year}/${round}/degradation${query}`)
}

export function getStrategy(year: number, round: number, driver: string, lap?: number): Promise<StrategyResponse> {
  const query = lap !== undefined ? `?lap=${lap}` : ""
  return apiFetch(`/race/${year}/${round}/strategy/${driver}${query}`)
}

export interface SectorTime {
  driver: string
  s1: number | null
  s2: number | null
  s3: number | null
  s1_color: "purple" | "green" | "yellow"
  s2_color: "purple" | "green" | "yellow"
  s3_color: "purple" | "green" | "yellow"
}

export interface WeatherDataPoint {
  lap: number
  air_temp: number
  track_temp: number
  humidity: number
  rainfall: boolean
}

export interface GapEvolutionPoint {
  lap: number
  gaps: Record<string, number>
}

export function getSectors(year: number, round: number, lap: number): Promise<SectorTime[]> {
  return apiFetch(`/race/${year}/${round}/sectors?lap=${lap}`)
}

export function getWeather(year: number, round: number): Promise<WeatherDataPoint[]> {
  return apiFetch(`/race/${year}/${round}/weather`)
}

export function getGapEvolution(year: number, round: number, driver: string): Promise<GapEvolutionPoint[]> {
  return apiFetch(`/race/${year}/${round}/gaps/${driver}`)
}

export interface RaceControlEvent {
  type: "SC" | "VSC" | "RED"
  start_lap: number
  end_lap: number
}

export function getRaceControl(year: number, round: number): Promise<RaceControlEvent[]> {
  return apiFetch(`/race/${year}/${round}/race-control`)
}

export interface StintInfo {
  driver: string
  stint_number: number
  compound: string
  lap_start: number
  lap_end: number
}

export interface PositionHistoryPoint {
  lap: number
  positions: Record<string, number>
}

export interface LapTimeStats {
  driver: string
  median: number
  q1: number
  q3: number
  min: number
  max: number
  whisker_low: number
  whisker_high: number
  lap_count: number
}

export interface PitStopInfo {
  driver: string
  lap: number
  pit_duration: number
  compound_before: string
  compound_after: string
}

export function getStints(year: number, round: number): Promise<StintInfo[]> {
  return apiFetch(`/race/${year}/${round}/stints`)
}

export function getPositions(year: number, round: number): Promise<PositionHistoryPoint[]> {
  return apiFetch(`/race/${year}/${round}/positions`)
}

export function getLapTimes(year: number, round: number): Promise<LapTimeStats[]> {
  return apiFetch(`/race/${year}/${round}/laptimes`)
}

export function getPitStops(year: number, round: number): Promise<PitStopInfo[]> {
  return apiFetch(`/race/${year}/${round}/pitstops`)
}

export interface RaceSummary {
  fastest_lap: { driver: string; lap: number; time: number } | null
  biggest_gainer: { driver: string; positions_gained: number; grid: number; finish: number } | null
  best_pit_stop: PitStopInfo | null
  worst_pit_stop: PitStopInfo | null
  most_overtakes: { driver: string; overtakes: number } | null
  total_overtakes: number
  leader_changes: number
  safety_car_periods: number
  red_flags: number
  unique_strategies: number
  total_pit_stops: number
}

export function getRaceSummary(year: number, round: number): Promise<RaceSummary> {
  return apiFetch(`/race/${year}/${round}/summary`)
}

export interface TyrePrediction {
  driver: string
  compound: string
  tyre_age: number
  predicted_cliff_lap: number
  estimated_laps_remaining: number
}

export function getLiveTyrePrediction(): Promise<TyrePrediction[]> {
  return apiFetch("/live/tyre-prediction")
}

export interface WhatIfResponse {
  driver: string
  hypothetical_pit_lap: number
  new_compound: string
  projected_net_delta: number
  projected_crossover: number
  projected_optimal_lap: number
  recommendation: string
  actual_compound: string
  actual_tyre_age: number
}

export function getWhatIf(year: number, round: number, driver: string, pitLap: number, compound: string): Promise<WhatIfResponse> {
  return apiFetch(`/race/${year}/${round}/what-if/${driver}?pit_lap=${pitLap}&new_compound=${compound}`)
}

export function getLiveLaps(): Promise<LiveLap[]> {
  return apiFetch("/live/laps")
}

export function getLiveStints(): Promise<LiveStint[]> {
  return apiFetch("/live/stints")
}

export interface LiveSessionInfo {
  active: boolean
  session_key: number | null
  session_type: string | null
  circuit: string | null
  country: string | null
  year: number | null
  round: number | null
}

export interface LiveDriverState {
  driver: string
  compound: string
  tyre_age: number
  position: number
  gap_to_leader: number
}

export interface LiveStrategyResponse extends StrategyResponse {
  curve_source: string
  rival_count: number
  degradation_confidence: number
}

export function getLiveSession(): Promise<LiveSessionInfo> {
  return apiFetch("/live/session")
}

export function getLiveGrid(): Promise<LiveDriverState[]> {
  return apiFetch("/live/grid")
}

export function getLiveStrategy(driver: string): Promise<LiveStrategyResponse> {
  return apiFetch(`/live/strategy/${driver}`)
}
