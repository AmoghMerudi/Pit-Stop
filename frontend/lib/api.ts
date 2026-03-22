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

export interface DegradationCurve {
  compound: string
  slope: number
  intercept: number
  r2: number
  coeffs?: number[]
  degree?: number
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

export function getDegradation(year: number, round: number): Promise<DegradationCurve[]> {
  return apiFetch(`/race/${year}/${round}/degradation`)
}

export function getStrategy(year: number, round: number, driver: string): Promise<StrategyResponse> {
  return apiFetch(`/race/${year}/${round}/strategy/${driver}`)
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
