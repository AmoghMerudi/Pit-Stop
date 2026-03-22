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
