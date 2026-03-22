"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import LiveSessionBadge from "@/components/LiveSessionBadge"
import MetricTile from "@/components/MetricTile"
import PitCountdown from "@/components/PitCountdown"
import CircuitInfo from "@/components/CircuitInfo"
import { postLiveManualStrategy } from "@/lib/api"
import type { LiveStrategyResponse, DegradationCurve } from "@/lib/api"
import { COMPOUNDS, COMPOUND_ACTIVE, type Compound } from "@/lib/constants"

const INPUT_CLASS =
  "w-full bg-[#0a0a0a] border border-[#222] px-3 py-2 text-white text-sm font-mono " +
  "focus:outline-none focus:border-[#e8002d] transition-colors " +
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

function netDeltaDisplay(delta: number): { value: string; status: "green" | "red" | "neutral" } {
  const sign = delta >= 0 ? "+" : ""
  return {
    value: `${sign}${delta.toFixed(3)}`,
    status: delta >= 0 ? "green" : "red",
  }
}

export default function LivePage() {
  const currentYear = new Date().getFullYear()

  const [year, setYear] = useState<number>(currentYear)
  const [round, setRound] = useState<number>(1)
  const [driver, setDriver] = useState<string>("")
  const [compound, setCompound] = useState<Compound>("MEDIUM")
  const [tyreAge, setTyreAge] = useState<number>(0)

  const [result, setResult] = useState<LiveStrategyResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await postLiveManualStrategy({
        year,
        round,
        driver: driver.trim().toUpperCase(),
        compound,
        tyre_age: tyreAge,
      })
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  const nd = result ? netDeltaDisplay(result.net_delta) : null

  // Build a minimal DegradationCurve array from the curve_source for CircuitInfo
  // (we don't have actual curves in live mode, but we show what we know)
  const fakeCurves: DegradationCurve[] = []

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Header bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-[#222] shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 text-[#555] hover:text-white text-xs transition-colors"
        >
          <span aria-hidden="true">&#8592;</span>
          Back
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[#e8002d] font-bold text-sm" aria-hidden="true">&#9646;</span>
          <span className="text-white font-semibold text-sm tracking-tight">PIT STOP</span>
          <span className="text-[#555] text-xs font-mono ml-2">LIVE</span>
        </div>

        <LiveSessionBadge />
      </header>

      {/* Compact input form bar */}
      <form onSubmit={handleSubmit} className="border-b border-[#222] px-4 py-3 shrink-0">
        <div className="flex flex-wrap items-end gap-3">
          {/* Year */}
          <div className="w-20">
            <label htmlFor="year" className="block text-[10px] font-medium text-[#555] uppercase tracking-widest mb-1">
              Year
            </label>
            <input
              id="year"
              type="number"
              min={2018}
              max={currentYear}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              required
              className={INPUT_CLASS}
            />
          </div>

          {/* Round */}
          <div className="w-16">
            <label htmlFor="round" className="block text-[10px] font-medium text-[#555] uppercase tracking-widest mb-1">
              Round
            </label>
            <input
              id="round"
              type="number"
              min={1}
              max={24}
              value={round}
              onChange={(e) => setRound(parseInt(e.target.value, 10))}
              required
              className={INPUT_CLASS}
            />
          </div>

          {/* Driver */}
          <div className="w-20">
            <label htmlFor="driver" className="block text-[10px] font-medium text-[#555] uppercase tracking-widest mb-1">
              Driver
            </label>
            <input
              id="driver"
              type="text"
              maxLength={3}
              value={driver}
              onChange={(e) => setDriver(e.target.value.toUpperCase())}
              placeholder="VER"
              required
              className={`${INPUT_CLASS} uppercase placeholder:normal-case placeholder:text-[#333]`}
            />
          </div>

          {/* Compound pills */}
          <div>
            <span className="block text-[10px] font-medium text-[#555] uppercase tracking-widest mb-1">
              Compound
            </span>
            <div className="flex gap-1">
              {COMPOUNDS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCompound(c)}
                  className={`px-2 py-1.5 text-[10px] font-bold border transition-colors ${
                    compound === c
                      ? COMPOUND_ACTIVE[c]
                      : "border-[#333] text-[#555] hover:border-[#555] hover:text-[#888]"
                  }`}
                >
                  {c === "INTERMEDIATE" ? "INT" : c}
                </button>
              ))}
            </div>
          </div>

          {/* Tyre age */}
          <div className="w-16">
            <label htmlFor="tyre-age" className="block text-[10px] font-medium text-[#555] uppercase tracking-widest mb-1">
              Age
            </label>
            <input
              id="tyre-age"
              type="number"
              min={0}
              max={60}
              value={tyreAge}
              onChange={(e) => setTyreAge(parseInt(e.target.value, 10))}
              required
              className={INPUT_CLASS}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="bg-[#e8002d] hover:bg-[#c0001f] disabled:opacity-50 disabled:cursor-not-allowed
                       text-white font-bold px-5 py-2 transition-colors text-xs uppercase tracking-widest"
          >
            {loading ? "..." : "GO"}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-[#1a0a0a] border-b border-[#e8002d] text-[#e8002d] text-xs">
          <span className="font-bold">ERROR: </span>
          {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="flex-1 overflow-y-auto">
          {/* Metric tiles */}
          <div className="grid grid-cols-4 border-b border-[#222]">
            <MetricTile
              label="Crossover"
              value={result.crossover_lap >= 999 ? "—" : result.crossover_lap}
              unit={result.crossover_lap < 999 ? "laps" : undefined}
            />
            <MetricTile
              label="Net Delta"
              value={nd!.value}
              unit="s"
              status={nd!.status}
            />
            <MetricTile
              label="Optimal Lap"
              value={result.optimal_lap <= 0 || result.optimal_lap >= 999 ? "—" : result.optimal_lap}
            />
            <MetricTile
              label="Rivals"
              value={result.rival_count}
              status={result.rival_count > 0 ? "neutral" : "amber"}
            />
          </div>

          {/* Pit recommendation */}
          <PitCountdown
            crossoverLap={result.crossover_lap}
            recommendPit={result.recommend_pit}
            reason={result.reason}
          />

          {/* Undercut threats */}
          {result.undercut_threats.length > 0 && (
            <div className="p-4 border-b border-[#222]">
              <p className="text-[10px] font-medium text-[#555] uppercase tracking-widest mb-2">
                Undercut Threats
              </p>
              <div className="space-y-1">
                {result.undercut_threats.map((t) => (
                  <div key={t.driver} className="flex items-center gap-3 text-xs border-l-2 border-l-[#e8002d] pl-2 py-1">
                    <span className="text-white font-mono font-bold w-10">{t.driver}</span>
                    <span className="text-[#888] font-mono">P{t.position}</span>
                    <span className="text-[#888]">{t.compound}</span>
                    <span className="text-[#888] font-mono">{t.tyre_age} laps</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Circuit info */}
          <CircuitInfo
            circuit={result.circuit}
            pitLoss={result.pit_loss}
            curves={fakeCurves}
            curveSource={result.curve_source}
          />
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="flex-1 flex items-center justify-center text-[#333] text-xs">
          Enter race details above and press GO
        </div>
      )}
    </div>
  )
}
