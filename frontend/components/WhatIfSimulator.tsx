"use client"

import { useState } from "react"
import { getWhatIf } from "@/lib/api"
import type { WhatIfResponse } from "@/lib/api"
import { COMPOUNDS, COMPOUND_HEX } from "@/lib/constants"

interface WhatIfSimulatorProps {
  year: number
  round: number
  driver: string
  totalLaps: number
  currentLap: number
  currentCompound: string
}

export default function WhatIfSimulator({
  year,
  round,
  driver,
  totalLaps,
  currentLap,
  currentCompound,
}: WhatIfSimulatorProps) {
  const [expanded, setExpanded] = useState(false)
  const [pitLap, setPitLap] = useState(currentLap)
  const [compound, setCompound] = useState(
    currentCompound === "SOFT" ? "MEDIUM" : currentCompound === "HARD" ? "MEDIUM" : "HARD"
  )
  const [result, setResult] = useState<WhatIfResponse | null>(null)
  const [loading, setLoading] = useState(false)

  async function simulate() {
    setLoading(true)
    try {
      const data = await getWhatIf(year, round, driver, pitLap, compound)
      setResult(data)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-b border-[var(--border)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--surface-raised)] transition-colors"
      >
        <span className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest">
          What-If Simulator
        </span>
        <span className="text-[var(--text-dim)] text-xs">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Controls */}
          <div className="flex items-end gap-3">
            {/* Pit lap input */}
            <div className="flex-1">
              <label className="block text-[9px] text-[var(--text-section)] uppercase tracking-wider mb-1">
                Pit on Lap
              </label>
              <input
                type="range"
                min={1}
                max={totalLaps}
                value={pitLap}
                onChange={(e) => {
                  setPitLap(parseInt(e.target.value, 10))
                  setResult(null)
                }}
                className="w-full h-1 appearance-none bg-[var(--border)] rounded-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:bg-[#e8002d] [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-[#e8002d]
                  [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
              <span className="text-[var(--text-primary)] font-mono text-xs font-bold">L{pitLap}</span>
            </div>

            {/* Compound selector */}
            <div>
              <label className="block text-[9px] text-[var(--text-section)] uppercase tracking-wider mb-1">
                Switch to
              </label>
              <div className="flex gap-1">
                {COMPOUNDS.filter((c) => c !== "INTERMEDIATE" && c !== "WET").map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCompound(c)
                      setResult(null)
                    }}
                    className={`px-2 py-1 text-[10px] font-mono font-bold border transition-colors ${
                      compound === c
                        ? "border-[#e8002d] text-[#e8002d] bg-[#e8002d]/10"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]"
                    }`}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1"
                      style={{ backgroundColor: COMPOUND_HEX[c] }}
                    />
                    {c[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulate button */}
            <button
              onClick={simulate}
              disabled={loading}
              className="px-4 py-1.5 bg-[#e8002d] hover:bg-[#c0001f] disabled:bg-[var(--border)] text-white text-xs font-bold uppercase tracking-wider transition-colors"
            >
              {loading ? "..." : "Simulate"}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] p-3 space-y-2">
              <p className="text-xs text-[var(--text-primary)] font-mono">{result.recommendation}</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[9px] text-[var(--text-muted)] uppercase">Net Delta</p>
                  <p className={`font-mono font-bold text-sm ${
                    result.projected_net_delta > 0 ? "text-[#22c55e]" : "text-[#e8002d]"
                  }`}>
                    {result.projected_net_delta > 0 ? "+" : ""}{result.projected_net_delta.toFixed(3)}s
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-[var(--text-muted)] uppercase">Crossover</p>
                  <p className="text-[var(--text-primary)] font-mono font-bold text-sm">
                    {result.projected_crossover >= 999 ? "—" : `${result.projected_crossover} laps`}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-[var(--text-muted)] uppercase">Optimal</p>
                  <p className="text-[var(--text-primary)] font-mono font-bold text-sm">
                    {result.projected_optimal_lap <= 0 || result.projected_optimal_lap >= 999
                      ? "Stay out"
                      : `L${result.projected_optimal_lap}`}
                  </p>
                </div>
              </div>
              <p className="text-[9px] text-[var(--text-dim)]">
                vs actual: {result.actual_compound} with {result.actual_tyre_age} lap old tyres
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
