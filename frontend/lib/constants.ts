export const COMPOUNDS = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"] as const
export type Compound = (typeof COMPOUNDS)[number]

export const COMPOUND_COLOURS: Record<string, string> = {
  SOFT: "text-[#e8002d]",
  MEDIUM: "text-[#ffd700]",
  HARD: "text-white",
  INTERMEDIATE: "text-[#39b54a]",
  WET: "text-[#0067ff]",
}

export const COMPOUND_HEX: Record<string, string> = {
  SOFT: "#e8002d",
  MEDIUM: "#ffd700",
  HARD: "#ffffff",
  INTERMEDIATE: "#39b54a",
  WET: "#0067ff",
}

export const COMPOUND_BG: Record<string, string> = {
  SOFT: "bg-[#e8002d]",
  MEDIUM: "bg-[#ffd700]",
  HARD: "bg-white",
  INTERMEDIATE: "bg-[#39b54a]",
  WET: "bg-[#0067ff]",
}

export const COMPOUND_ACTIVE: Record<Compound, string> = {
  SOFT:         "border-[#e8002d] text-[#e8002d] bg-[#e8002d]/10",
  MEDIUM:       "border-[#ffd700] text-[#ffd700] bg-[#ffd700]/10",
  HARD:         "border-white text-white bg-white/10",
  INTERMEDIATE: "border-[#39b54a] text-[#39b54a] bg-[#39b54a]/10",
  WET:          "border-[#0067ff] text-[#0067ff] bg-[#0067ff]/10",
}

// Hardcoded fallback team colors (used when API driverInfo is unavailable)
const TEAM_COLORS: Record<string, string> = {
  VER: "#3671C6", PER: "#3671C6",
  HAM: "#27F4D2", RUS: "#27F4D2",
  LEC: "#E8002D", SAI: "#E8002D",
  NOR: "#FF8000", PIA: "#FF8000",
  ALO: "#229971", STR: "#229971",
  GAS: "#2293D1", OCO: "#2293D1", DOO: "#2293D1",
  TSU: "#6692FF", RIC: "#6692FF", LAW: "#6692FF",
  BOT: "#52E252", ZHO: "#52E252",
  MAG: "#B6BABD", HUL: "#B6BABD", BEA: "#B6BABD",
  ALB: "#64C4FF", SAR: "#64C4FF", COL: "#64C4FF",
  BOR: "#1E6176", HAD: "#1E6176",
  ANT: "#E8002D", KIM: "#E8002D",
}

export interface DriverInfoLike {
  code: string
  team_color: string
  team: string
}

/**
 * Get a driver's team color. Prefers live API data, falls back to hardcoded map.
 */
export function getDriverColor(code: string, driverInfo?: DriverInfoLike[]): string {
  if (driverInfo) {
    const info = driverInfo.find((d) => d.code === code)
    if (info?.team_color) return `#${info.team_color}`
  }
  return TEAM_COLORS[code] ?? "#666"
}

/**
 * Get a driver's team name from API data.
 */
export function getDriverTeam(code: string, driverInfo?: DriverInfoLike[]): string | null {
  if (!driverInfo) return null
  return driverInfo.find((d) => d.code === code)?.team ?? null
}
