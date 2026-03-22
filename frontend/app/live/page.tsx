"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import LiveSessionBadge from "@/components/LiveSessionBadge"
import MetricTile from "@/components/MetricTile"
import PitCountdown from "@/components/PitCountdown"
import CircuitInfo from "@/components/CircuitInfo"
import { getLiveSession, getLiveGrid, getLiveStrategy } from "@/lib/api"
import type { LiveSessionInfo, LiveDriverState, LiveStrategyResponse, DegradationCurve } from "@/lib/api"
import { COMPOUND_COLOURS } from "@/lib/constants"

const POLL_INTERVAL = 15_000 // 15 seconds

function netDeltaDisplay(delta: number): { value: string; status: "green" | "red" | "neutral" } {
  const sign = delta >= 0 ? "+" : ""
  return {
    value: `${sign}${delta.toFixed(3)}`,
    status: delta >= 0 ? "green" : "red",
  }
}

export default function LivePage() {
  const [session, setSession] = useState<LiveSessionInfo | null>(null)
  const [grid, setGrid] = useState<LiveDriverState[]>([])
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const [result, setResult] = useState<LiveStrategyResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)

  // Poll session + grid
  const refresh = useCallback(async () => {
    try {
      const [sess, drivers] = await Promise.all([getLiveSession(), getLiveGrid()])
      setSession(sess)
      setGrid(drivers)
    } catch {
      setSession(null)
      setGrid([])
    } finally {
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [refresh])

  // Auto-refresh strategy for selected driver
  useEffect(() => {
    if (!selectedDriver || !session?.active) return

    let mounted = true

    async function fetchStrategy() {
      setLoading(true)
      setError(null)
      try {
        const data = await getLiveStrategy(selectedDriver!)
        if (mounted) setResult(data)
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : "Unexpected error")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchStrategy()
    const interval = setInterval(fetchStrategy, POLL_INTERVAL)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [selectedDriver, session?.active])

  const nd = result ? netDeltaDisplay(result.net_delta) : null
  const fakeCurves: DegradationCurve[] = []

  // Loading state
  if (initialLoading) {
    return (
      <div className="h-screen flex flex-col bg-[#0a0a0a]">
        <header className="h-12 flex items-center justify-between px-4 border-b border-[#222] shrink-0">
          <Link href="/" className="flex items-center gap-2 text-[#555] hover:text-white text-xs transition-colors">
            <span aria-hidden="true">&#8592;</span> Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[#e8002d] font-bold text-sm" aria-hidden="true">&#9646;</span>
            <span className="text-white font-semibold text-sm tracking-tight">PIT STOP</span>
            <span className="text-[#555] text-xs font-mono ml-2">LIVE</span>
          </div>
          <div />
        </header>
        <div className="flex-1 flex items-center justify-center text-[#555] text-xs">
          Checking for active session...
        </div>
      </div>
    )
  }

  // No active race session
  if (!session?.active) {
    return (
      <div className="h-screen flex flex-col bg-[#0a0a0a]">
        <header className="h-12 flex items-center justify-between px-4 border-b border-[#222] shrink-0">
          <Link href="/" className="flex items-center gap-2 text-[#555] hover:text-white text-xs transition-colors">
            <span aria-hidden="true">&#8592;</span> Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[#e8002d] font-bold text-sm" aria-hidden="true">&#9646;</span>
            <span className="text-white font-semibold text-sm tracking-tight">PIT STOP</span>
            <span className="text-[#555] text-xs font-mono ml-2">LIVE</span>
          </div>
          <LiveSessionBadge />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-3 h-3 rounded-full bg-[#333]" />
          <p className="text-[#555] text-sm">No active race session</p>
          <p className="text-[#333] text-xs max-w-xs text-center">
            Live analysis is available during F1 race sessions. Check back when a race is underway.
          </p>
          <Link
            href="/"
            className="mt-4 text-[#e8002d] hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Analyze a past race instead
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-[#222] shrink-0">
        <Link href="/" className="flex items-center gap-2 text-[#555] hover:text-white text-xs transition-colors">
          <span aria-hidden="true">&#8592;</span> Back
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[#e8002d] font-bold text-sm" aria-hidden="true">&#9646;</span>
          <span className="text-white font-semibold text-sm tracking-tight">PIT STOP</span>
          <span className="text-[#555] text-xs font-mono ml-2">LIVE</span>
        </div>
        <LiveSessionBadge />
      </header>

      {/* Session info bar */}
      <div className="px-4 py-2 border-b border-[#222] flex items-center gap-4 shrink-0">
        <span className="text-white text-sm font-semibold">{session.circuit}</span>
        {session.country && <span className="text-[#555] text-xs">{session.country}</span>}
        {session.year && session.round && (
          <span className="text-[#555] text-xs font-mono">
            {session.year} R{session.round}
          </span>
        )}
        <span className="ml-auto text-[#333] text-[10px] font-mono">
          Auto-refresh {POLL_INTERVAL / 1000}s
        </span>
      </div>

      {/* Driver grid */}
      <div className="border-b border-[#222] px-4 py-3 shrink-0">
        <p className="text-[10px] font-medium text-[#555] uppercase tracking-widest mb-2">
          Select Driver
        </p>
        <div className="flex flex-wrap gap-1.5">
          {grid.map((d) => (
            <button
              key={d.driver}
              onClick={() => {
                setSelectedDriver(d.driver)
                setResult(null)
                setError(null)
              }}
              className={`px-2.5 py-1.5 text-xs font-mono font-bold border transition-colors ${
                selectedDriver === d.driver
                  ? "border-[#e8002d] text-[#e8002d] bg-[#e8002d]/10"
                  : "border-[#333] text-[#888] hover:border-[#555] hover:text-white"
              }`}
            >
              <span className="mr-1.5 text-[#555] font-normal">P{d.position || "?"}</span>
              {d.driver}
              <span className={`ml-1.5 text-[10px] ${COMPOUND_COLOURS[d.compound] ?? "text-[#555]"}`}>
                {d.compound?.charAt(0)}
              </span>
            </button>
          ))}
          {grid.length === 0 && (
            <span className="text-[#555] text-xs">Waiting for driver data...</span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-[#1a0a0a] border-b border-[#e8002d] text-[#e8002d] text-xs">
          <span className="font-bold">ERROR: </span>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !result && (
        <div className="flex-1 flex items-center justify-center text-[#555] text-xs">
          Loading strategy for {selectedDriver}...
        </div>
      )}

      {/* Results */}
      {result && (
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

      {/* Empty state — no driver selected */}
      {!selectedDriver && !loading && !error && (
        <div className="flex-1 flex items-center justify-center text-[#333] text-xs">
          Select a driver from the grid above
        </div>
      )}
    </div>
  )
}
