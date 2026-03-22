"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { getDegradation, getStrategy } from "@/lib/api"
import type { DegradationCurve, StrategyResponse } from "@/lib/api"
import DegradationChart from "@/components/DegradationChart"
import TimingTower from "@/components/TimingTower"
import MetricTile from "@/components/MetricTile"
import PitCountdown from "@/components/PitCountdown"
import CircuitInfo from "@/components/CircuitInfo"
import LiveSessionBadge from "@/components/LiveSessionBadge"
import { COMPOUND_HEX } from "@/lib/constants"

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
  const [strategyLoading, setStrategyLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Lap slider + driver selection state
  const [selectedLap, setSelectedLap] = useState<number | null>(null)
  const [totalLaps, setTotalLaps] = useState<number>(0)
  const [activeDriver, setActiveDriver] = useState<string>("")

  useEffect(() => {
    params.then((p) => setId(p.id)).catch(() => setError("Failed to read route parameters"))
  }, [params])

  // Initial load — fetch degradation + strategy at final lap
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

    setActiveDriver(driver)

    Promise.all([getDegradation(year, round), getStrategy(year, round, driver)])
      .then(([degradationData, strategyData]) => {
        setCurves(degradationData)
        setStrategy(strategyData)
        const tl = strategyData.total_laps ?? strategyData.current_lap ?? 57
        const cl = strategyData.current_lap ?? tl
        setTotalLaps(tl)
        setSelectedLap(cl)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "An unexpected error occurred"
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [id])

  // Re-fetch strategy for a given driver + lap
  const fetchStrategy = useCallback(
    async (driver: string, lap?: number) => {
      const parsed = id ? parseId(id) : null
      if (!parsed) return

      setStrategyLoading(true)
      try {
        const strategyData = await getStrategy(parsed.year, parsed.round, driver, lap)
        setStrategy(strategyData)
      } catch {
        // Keep existing strategy on error
      } finally {
        setStrategyLoading(false)
      }
    },
    [id]
  )

  function handleLapChange(e: React.ChangeEvent<HTMLInputElement>) {
    const lap = parseInt(e.target.value, 10)
    setSelectedLap(lap)
    fetchStrategy(activeDriver, lap)
  }

  function handleDriverSelect(driver: string) {
    setActiveDriver(driver)
    fetchStrategy(driver, selectedLap ?? undefined)
  }

  const parsed = id ? parseId(id) : null

  // Get selected driver's tyre age for chart marker
  const selectedDriverState = strategy?.all_drivers.find((d) => d.driver === activeDriver)
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
              <span className="text-white font-bold">{activeDriver || parsed.driver}</span>
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
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[220px_1fr]">
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
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[220px_1fr] overflow-hidden">
          {/* Left: Timing Tower */}
          <TimingTower
            drivers={strategy.all_drivers}
            selectedDriver={activeDriver}
            threats={threatCodes}
            onSelectDriver={handleDriverSelect}
          />

          {/* Right: Panels */}
          <div className="overflow-y-auto">
            {/* Lap Slider */}
            {totalLaps > 0 && selectedLap !== null && (
              <div className="px-4 py-3 border-b border-[#222] flex items-center gap-4">
                <span className="text-[10px] font-medium text-[#555] uppercase tracking-widest shrink-0">
                  Lap
                </span>
                <input
                  type="range"
                  min={1}
                  max={totalLaps}
                  value={selectedLap}
                  onChange={handleLapChange}
                  className="flex-1 h-1 appearance-none bg-[#222] rounded-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:bg-[#e8002d] [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-[#e8002d]
                    [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                />
                <span className="text-white font-mono font-bold text-sm w-16 text-right">
                  {selectedLap}
                  <span className="text-[#555] font-normal text-[10px]"> / {totalLaps}</span>
                </span>
                {strategyLoading && (
                  <span className="w-2 h-2 rounded-full bg-[#e8002d] animate-pulse shrink-0" />
                )}
              </div>
            )}

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

            {/* Undercut threats */}
            {strategy.undercut_threats.length > 0 && (
              <div className="p-4 border-b border-[#222]">
                <p className="text-[10px] font-medium text-[#555] uppercase tracking-widest mb-2">
                  Undercut Threats
                </p>
                <div className="space-y-1">
                  {strategy.undercut_threats.map((t) => (
                    <div key={t.driver} className="flex items-center gap-3 text-xs border-l-2 border-l-[#e8002d] pl-2 py-1">
                      <span className="text-white font-mono font-bold w-10">{t.driver}</span>
                      <span className="text-[#888] font-mono">P{t.position}</span>
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: COMPOUND_HEX[t.compound] ?? "#555" }}
                      />
                      <span className="text-[#888]">{t.compound}</span>
                      <span className="text-[#888] font-mono">{t.tyre_age} laps</span>
                      <span className="ml-auto text-[#e8002d] font-mono font-bold">
                        {(t.threat_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Degradation chart */}
            <DegradationChart
              curves={curves}
              currentTyreAge={currentTyreAge}
            />

            {/* Driver state summary */}
            {selectedDriverState && (
              <div className="p-4 border-b border-[#222]">
                <p className="text-[10px] font-medium text-[#555] uppercase tracking-widest mb-2">
                  Driver State at Lap {selectedLap}
                </p>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-[#555] text-[10px] uppercase mb-0.5">Position</p>
                    <p className="text-white font-mono font-bold text-lg">P{selectedDriverState.position}</p>
                  </div>
                  <div>
                    <p className="text-[#555] text-[10px] uppercase mb-0.5">Compound</p>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COMPOUND_HEX[selectedDriverState.compound] ?? "#555" }}
                      />
                      <p className="text-white font-mono font-bold text-lg">{selectedDriverState.compound}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[#555] text-[10px] uppercase mb-0.5">Tyre Age</p>
                    <p className="text-white font-mono font-bold text-lg">{selectedDriverState.tyre_age} laps</p>
                  </div>
                  <div>
                    <p className="text-[#555] text-[10px] uppercase mb-0.5">Gap to Leader</p>
                    <p className="text-white font-mono font-bold text-lg">
                      {selectedDriverState.gap_to_leader === 0 ? "LEADER" : `+${selectedDriverState.gap_to_leader.toFixed(1)}s`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Remaining laps + best alt */}
            <div className="p-4 border-b border-[#222]">
              <p className="text-[10px] font-medium text-[#555] uppercase tracking-widest mb-2">
                Strategy Summary
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[#555] text-[10px] uppercase mb-0.5">Remaining</p>
                  <p className="text-white font-mono font-bold text-lg">{strategy.remaining_laps} laps</p>
                </div>
                <div>
                  <p className="text-[#555] text-[10px] uppercase mb-0.5">Best Alternative</p>
                  <div className="flex items-center gap-2">
                    {strategy.best_alt && (
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COMPOUND_HEX[strategy.best_alt] ?? "#555" }}
                      />
                    )}
                    <p className="text-white font-mono font-bold text-lg">{strategy.best_alt ?? "—"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[#555] text-[10px] uppercase mb-0.5">Rivals on Track</p>
                  <p className="text-white font-mono font-bold text-lg">{strategy.all_drivers.length}</p>
                </div>
              </div>
            </div>

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
