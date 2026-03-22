"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import PitWindowPanel from "@/components/PitWindowPanel"
import RivalTable from "@/components/RivalTable"
import LiveSessionBadge from "@/components/LiveSessionBadge"
import { postLiveManualStrategy } from "@/lib/api"
import type { LiveStrategyResponse } from "@/lib/api"
import type { DriverRow } from "@/lib/types"
import { COMPOUNDS, COMPOUND_ACTIVE, type Compound } from "@/lib/constants"

const INPUT_CLASS =
  "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white text-sm " +
  "focus:outline-none focus:border-[#e8002d] transition-colors " +
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

function formatCurveSource(source: string): string {
  if (source === "benchmark") return "Using benchmark degradation curves"
  // "prior_race:2023/1" → "Degradation curves from 2023 Round 1"
  const match = source.match(/prior_race:(\d+)\/(\d+)/)
  if (match) return `${match[1]} Round ${match[2]} (prior race baseline)`
  return source
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

  function buildRivalRows(): DriverRow[] {
    if (!result) return []
    return result.undercut_threats.map((t) => ({
      driver: t.driver,
      compound: t.compound,
      tyre_age: t.tyre_age,
      position: t.position,
      is_threat: true,
    }))
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-6 md:px-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-[#888] hover:text-white text-sm transition-colors"
        >
          <span aria-hidden="true">&#8592;</span>
          Back
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[#e8002d] font-bold text-lg" aria-hidden="true">&#9646;</span>
          <span className="text-white font-semibold tracking-tight">Pit Stop</span>
        </div>
        <LiveSessionBadge />
      </header>

      {/* Form */}
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">Live Strategy</h1>
          <p className="text-[#888] text-sm mt-1">
            Enter your driver&apos;s current situation from TV graphics to get a pit recommendation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#111] border border-[#222] rounded-xl p-6 space-y-5">
          {/* Year + Round */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="year" className="block text-xs font-medium text-[#888] uppercase tracking-wider">
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
            <div className="space-y-1">
              <label htmlFor="round" className="block text-xs font-medium text-[#888] uppercase tracking-wider">
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
              <p className="text-[#555] text-xs">1 – 24</p>
            </div>
          </div>

          {/* Driver */}
          <div className="space-y-1">
            <label htmlFor="driver" className="block text-xs font-medium text-[#888] uppercase tracking-wider">
              Driver Code
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

          {/* Compound */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-[#888] uppercase tracking-wider">
              Tyre Compound
            </span>
            <div className="flex flex-wrap gap-2">
              {COMPOUNDS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCompound(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
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

          {/* Laps on tyre */}
          <div className="space-y-1">
            <label htmlFor="tyre-age" className="block text-xs font-medium text-[#888] uppercase tracking-wider">
              Laps on Tyre
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
            <p className="text-[#555] text-xs">0 – 60</p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#e8002d] hover:bg-[#c0001f] disabled:opacity-50 disabled:cursor-not-allowed
                       text-white font-semibold rounded-lg px-4 py-3 transition-colors text-sm uppercase tracking-wider"
          >
            {loading ? "Analysing…" : "Analyse"}
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-lg mx-auto mt-6 bg-[#2a0a0a] border border-[#e8002d] rounded-lg px-5 py-4 text-[#e8002d] text-sm">
          <span className="font-semibold">Error: </span>
          {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="max-w-2xl mx-auto mt-6 space-y-4">
          <div className="text-[#555] text-xs text-right space-y-0.5">
            <p>Tyre model: {formatCurveSource(result.curve_source)}</p>
            <p>
              Rivals:{" "}
              {result.rival_count > 0
                ? `${result.rival_count} from live session`
                : "no active session"}
            </p>
          </div>
          <PitWindowPanel strategy={result} />
          {result.undercut_threats.length > 0 && (
            <RivalTable rows={buildRivalRows()} />
          )}
        </div>
      )}
    </div>
  )
}
