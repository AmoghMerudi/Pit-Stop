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
}

export interface ThreatDetail {
  driver: string
  compound: string
  tyre_age: number
  position: number
}

export interface StrategyResponse {
  driver: string
  recommend_pit: boolean
  reason: string
  optimal_lap: number
  crossover_lap: number
  net_delta: number
  undercut_threats: ThreatDetail[]
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

export function getLiveStrategy(driver: string): Promise<StrategyResponse> {
  return apiFetch(`/live/strategy/${driver}`)
}

export interface LiveStrategyResponse extends StrategyResponse {
  curve_source: string
  rival_count: number
}

export interface ManualStrategyRequest {
  year: number
  round: number
  driver: string
  compound: string
  tyre_age: number
}

export async function postLiveManualStrategy(
  body: ManualStrategyRequest
): Promise<LiveStrategyResponse> {
  const res = await fetch(`${BASE_URL}/live/manual-strategy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(`API error ${res.status}: ${errBody.error}`)
  }
  return res.json()
}
