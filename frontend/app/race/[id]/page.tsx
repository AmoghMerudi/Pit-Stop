"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getDegradation, getStrategy } from "@/lib/api"
import type { DegradationCurve, StrategyResponse } from "@/lib/api"
import DegradationChart from "@/components/DegradationChart"
import TimingTower from "@/components/TimingTower"
import MetricTile from "@/components/MetricTile"
import PitCountdown from "@/components/PitCountdown"
import CircuitInfo from "@/components/CircuitInfo"
import LiveSessionBadge from "@/components/LiveSessionBadge"

interface PageProps {
  params: Promise<{ id: string }>
}

function parseId(id: string): { year: number; round: number; driver: string } | null {
  const parts = id.split("-")
  if (parts.length < 3) return null
  const year = parseInt(parts[0], 10)
  const round = parseInt(parts[1], 10)
  const driver = parts.slice(2).join("-").toUpperCase()
  if (isNaN(year) || isNaN(round) || !driver) return null
  return { year, round, driver }
}

function netDeltaDisplay(delta: number): { value: string; status: "green" | "red" | "neutral" } {
  const sign = delta >= 0 ? "+" : ""
  return {
    value: `${sign}${delta.toFixed(3)}`,
    status: delta >= 0 ? "green" : "red",
  }
}

export default function RacePage({ params }: PageProps) {
  const [id, setId] = useState<string>("")
  const [curves, setCurves] = useState<DegradationCurve[] | null>(null)
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    params.then((p) => setId(p.id)).catch(() => setError("Failed to read route parameters"))
  }, [params])

  useEffect(() => {
    if (!id) return

    const parsed = parseId(id)
    if (!parsed) {
      setError(`Invalid race ID: "${id}". Expected format: {year}-{round}-{driver}`)
      setLoading(false)
      return
    }

    const { year, round, driver } = parsed

    setLoading(true)
    setError(null)

    Promise.all([getDegradation(year, round), getStrategy(year, round, driver)])
      .then(([degradationData, strategyData]) => {
        setCurves(degradationData)
        setStrategy(strategyData)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "An unexpected error occurred"
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [id])

  const parsed = id ? parseId(id) : null

  // Get selected driver's tyre age for chart marker
  const selectedDriverState = strategy?.all_drivers.find((d) => d.driver === strategy.driver)
  const currentTyreAge = selectedDriverState?.tyre_age
  const threatCodes = strategy?.undercut_threats.map((t) => t.driver) ?? []
  const nd = strategy ? netDeltaDisplay(strategy.net_delta) : null

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Header bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-[#222] shrink-0">
        <Link
          href="/analyze"
          className="flex items-center gap-2 text-[#555] hover:text-white text-xs transition-colors"
        >
          <span aria-hidden="true">&#8592;</span>
          Back
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[#e8002d] font-bold text-sm" aria-hidden="true">&#9646;</span>
          <span className="text-white font-semibold text-sm tracking-tight">PIT STOP</span>
        </div>

        <div className="flex items-center gap-4">
          {parsed && (
            <span className="text-xs font-mono text-[#888]">
              {parsed.year} · R{parsed.round}
              {strategy?.circuit ? ` · ${strategy.circuit}` : ""}
              {" · "}
              <span className="text-white font-bold">{parsed.driver}</span>
            </span>
          )}
          <LiveSessionBadge />
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 bg-[#1a0a0a] border-b border-[#e8002d] text-[#e8002d] text-xs">
          <span className="font-bold">ERROR: </span>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr]">
          <div className="border-r border-[#222] bg-[#0a0a0a] animate-pulse" />
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-4 gap-px">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-[#111] animate-pulse" />
              ))}
            </div>
            <div className="h-16 bg-[#111] animate-pulse" />
            <div className="h-72 bg-[#111] animate-pulse" />
            <div className="flex items-center justify-center py-8 text-[#555] text-xs">
              Loading race data — this may take a moment if the session is not cached...
            </div>
          </div>
        </div>
      )}

      {/* Dashboard */}
      {!loading && !error && curves && strategy && (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr] overflow-hidden">
          {/* Left: Timing Tower */}
          <TimingTower
            drivers={strategy.all_drivers}
            selectedDriver={strategy.driver}
            threats={threatCodes}
          />

          {/* Right: Panels */}
          <div className="overflow-y-auto">
            {/* Metric tiles row */}
            <div className="grid grid-cols-4 border-b border-[#222]">
              <MetricTile
                label="Crossover"
                value={strategy.crossover_lap >= 999 ? "—" : strategy.crossover_lap}
                unit={strategy.crossover_lap < 999 ? "laps" : undefined}
              />
              <MetricTile
                label="Net Delta"
                value={nd!.value}
                unit="s"
                status={nd!.status}
              />
              <MetricTile
                label="Optimal Lap"
                value={strategy.optimal_lap <= 0 || strategy.optimal_lap >= 999 ? "—" : strategy.optimal_lap}
              />
              <MetricTile
                label="Pit Loss"
                value={strategy.pit_loss.toFixed(1)}
                unit="s"
              />
            </div>

            {/* Pit recommendation */}
            <PitCountdown
              crossoverLap={strategy.crossover_lap}
              recommendPit={strategy.recommend_pit}
              reason={strategy.reason}
            />

            {/* Degradation chart */}
            <DegradationChart
              curves={curves}
              currentTyreAge={currentTyreAge}
            />

            {/* Circuit info */}
            <CircuitInfo
              circuit={strategy.circuit}
              pitLoss={strategy.pit_loss}
              curves={curves}
            />
          </div>
        </div>
      )}

      {/* No-data state */}
      {!loading && !error && curves && strategy === null && (
        <div className="flex-1 flex items-center justify-center text-[#555] text-xs">
          No strategy data available for this selection.
        </div>
      )}
    </div>
  )
}
