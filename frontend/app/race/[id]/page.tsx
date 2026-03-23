"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { getDegradation, getStrategy, getSectors, getWeather, getGapEvolution, getRaceControl, getStints, getPositions, getLapTimes, getPitStops, getRaceSummary, getDrivers } from "@/lib/api"
import type { DegradationCurve, StrategyResponse, SectorTime, WeatherDataPoint, GapEvolutionPoint, RaceControlEvent, StintInfo, PositionHistoryPoint, LapTimeStats, PitStopInfo, RaceSummary as RaceSummaryType, DriverInfo } from "@/lib/api"
import DegradationChart from "@/components/DegradationChart"
import TimingTower from "@/components/TimingTower"
import MetricTile from "@/components/MetricTile"
import PitCountdown from "@/components/PitCountdown"
import CircuitInfo from "@/components/CircuitInfo"
import LiveSessionBadge from "@/components/LiveSessionBadge"
import SectorTimesTable from "@/components/SectorTimesTable"
import WeatherChart from "@/components/WeatherChart"
import GapChart from "@/components/GapChart"
import TyreTimeline from "@/components/TyreTimeline"
import PositionChart from "@/components/PositionChart"
import LapTimeDistribution from "@/components/LapTimeDistribution"
import PitStopTable from "@/components/PitStopTable"
import RaceSummary from "@/components/RaceSummary"
import PitWindowTimeline from "@/components/PitWindowTimeline"
import WhatIfSimulator from "@/components/WhatIfSimulator"
import ShareExport from "@/components/ShareExport"
import ThemeToggle from "@/components/ThemeToggle"
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
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  // Lap slider + driver selection state
  const [selectedLap, setSelectedLap] = useState<number | null>(null)
  const [totalLaps, setTotalLaps] = useState<number>(0)
  const [activeDriver, setActiveDriver] = useState<string>("")

  // New data panels
  const [sectors, setSectors] = useState<SectorTime[] | null>(null)
  const [weather, setWeather] = useState<WeatherDataPoint[] | null>(null)
  const [gaps, setGaps] = useState<GapEvolutionPoint[] | null>(null)
  const [raceControl, setRaceControl] = useState<RaceControlEvent[]>([])
  const [stints, setStints] = useState<StintInfo[]>([])
  const [positions, setPositions] = useState<PositionHistoryPoint[]>([])
  const [lapTimes, setLapTimes] = useState<LapTimeStats[]>([])
  const [pitStops, setPitStops] = useState<PitStopInfo[]>([])
  const [summary, setSummary] = useState<RaceSummaryType | null>(null)
  const [driverInfo, setDriverInfo] = useState<DriverInfo[]>([])
  const dashboardRef = useRef<HTMLDivElement>(null)

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

    // Phase 1: critical data — render page as soon as these resolve
    Promise.all([
      getDegradation(year, round),
      getStrategy(year, round, driver),
      getDrivers(year, round).catch(() => [] as DriverInfo[]),
    ])
      .then(([degradationData, strategyData, driversData]) => {
        setCurves(degradationData)
        setStrategy(strategyData)
        setDriverInfo(driversData)
        const tl = strategyData.total_laps ?? strategyData.current_lap ?? 57
        const cl = strategyData.current_lap ?? tl
        setTotalLaps(tl)
        setSelectedLap(cl)
        setLoading(false)

        // Phase 2: secondary data — load in background after page is visible
        getSectors(year, round, cl).then(setSectors).catch(() => {})
        getWeather(year, round).then(setWeather).catch(() => {})
        getGapEvolution(year, round, driver).then(setGaps).catch(() => {})
        getRaceControl(year, round).then(setRaceControl).catch(() => {})
        getStints(year, round).then(setStints).catch(() => {})
        getPositions(year, round).then(setPositions).catch(() => {})
        getLapTimes(year, round).then(setLapTimes).catch(() => {})
        getPitStops(year, round).then(setPitStops).catch(() => {})
        getRaceSummary(year, round).then(setSummary).catch(() => {})
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "An unexpected error occurred"
        setError(message)
        setLoading(false)
      })
  }, [id])

  function handleLapChange(e: React.ChangeEvent<HTMLInputElement>) {
    const lap = parseInt(e.target.value, 10)
    setSelectedLap(lap)
    if (!parsed) return
    setSyncMessage("Optimizing race strategy")
    Promise.all([
      getStrategy(parsed.year, parsed.round, activeDriver, lap).then(setStrategy).catch(() => {}),
      getSectors(parsed.year, parsed.round, lap).then(setSectors).catch(() => {}),
    ]).finally(() => setSyncMessage(null))
  }

  function handleDriverSelect(driver: string) {
    setActiveDriver(driver)
    if (!parsed) return
    setSyncMessage("Race control is syncing data")
    const lap = selectedLap ?? undefined
    Promise.all([
      getStrategy(parsed.year, parsed.round, driver, lap).then(setStrategy).catch(() => {}),
      getGapEvolution(parsed.year, parsed.round, driver).then(setGaps).catch(() => {}),
      lap !== undefined
        ? getSectors(parsed.year, parsed.round, lap).then(setSectors).catch(() => {})
        : Promise.resolve(),
    ]).finally(() => setSyncMessage(null))
  }

  const parsed = id ? parseId(id) : null

  // Get selected driver's tyre age for chart marker
  const selectedDriverState = strategy?.all_drivers.find((d) => d.driver === activeDriver)
  const currentTyreAge = selectedDriverState?.tyre_age
  const threatCodes = strategy?.undercut_threats.map((t) => t.driver) ?? []
  const nd = strategy ? netDeltaDisplay(strategy.net_delta) : null
  const driverCompoundCurve = curves?.find((c) => c.compound === selectedDriverState?.compound)
  const cliffConfidence = driverCompoundCurve?.cliff_confidence ?? null

  return (
    <div className="h-screen flex flex-col bg-[var(--surface)]">
      {/* Header bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-[var(--border)] shrink-0">
        <Link
          href="/analyze"
          className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition-colors"
        >
          <span aria-hidden="true">&#8592;</span>
          Back
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[#e8002d] font-bold text-sm" aria-hidden="true">&#9646;</span>
          <span className="text-[var(--text-primary)] font-semibold text-sm tracking-tight">PITWALL</span>
        </div>

        <div className="flex items-center gap-4">
          {parsed && (
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              {parsed.year} · R{parsed.round}
              {strategy?.circuit ? ` · ${strategy.circuit}` : ""}
              {" · "}
              <span className="text-[var(--text-primary)] font-bold">{activeDriver || parsed.driver}</span>
            </span>
          )}
          <LiveSessionBadge />
          <Link
            href={`/race/${id}/h2h?d1=${activeDriver}`}
            className="px-2 py-1 text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors"
          >
            H2H
          </Link>
          <ShareExport dashboardRef={dashboardRef} />
          <ThemeToggle />
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 bg-[var(--error-bg)] border-b border-[#e8002d] text-[#e8002d] text-xs">
          <span className="font-bold">ERROR: </span>
          {error}
        </div>
      )}

      {/* Loading state — full page */}
      {loading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <style>{`
            @keyframes f1-light-load {
              0%, 100% { background-color: #1a0a0a; box-shadow: none; border-color: #333; }
              20%, 90% { background-color: #e8002d; box-shadow: 0 0 14px #e8002d, 0 0 28px rgba(232,0,45,0.25); border-color: #e8002d; }
            }
          `}</style>
          <div className="flex items-center gap-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2 border-[#333]"
                style={{
                  animation: "f1-light-load 3s infinite",
                  animationDelay: `${i * 0.5}s`,
                }}
              />
            ))}
          </div>
          <p className="text-[var(--text-secondary)] text-xs font-mono tracking-wider uppercase">
            Loading race data
          </p>
          <p className="text-[var(--text-muted)] text-[10px]">
            This may take a moment if the session is not cached
          </p>
        </div>
      )}

      {/* Sync overlay — full page */}
      {syncMessage && (
        <div className="fixed inset-0 z-50 bg-[var(--surface)]/90 flex flex-col items-center justify-center gap-6">
          <style>{`
            @keyframes f1-light {
              0%, 100% { background-color: #1a0a0a; box-shadow: none; border-color: #333; }
              20%, 90% { background-color: #e8002d; box-shadow: 0 0 14px #e8002d, 0 0 28px rgba(232,0,45,0.25); border-color: #e8002d; }
            }
          `}</style>
          <div className="flex items-center gap-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2 border-[#333]"
                style={{
                  animation: `f1-light 3s infinite`,
                  animationDelay: `${i * 0.5}s`,
                }}
              />
            ))}
          </div>
          <p className="text-[var(--text-secondary)] text-xs font-mono tracking-wider uppercase">
            {syncMessage}
          </p>
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
            driverInfo={driverInfo}
            onSelectDriver={handleDriverSelect}
          />

          {/* Right: Panels */}
          <div ref={dashboardRef} className="overflow-y-auto">

            {/* Lap Slider */}
            {totalLaps > 0 && selectedLap !== null && (
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-4">
                <span className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest shrink-0">
                  Lap
                </span>
                <input
                  type="range"
                  min={1}
                  max={totalLaps}
                  value={selectedLap}
                  onChange={handleLapChange}
                  className="flex-1 h-1 appearance-none bg-[var(--border)] rounded-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:bg-[#e8002d] [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-[#e8002d]
                    [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                />
                <span className="text-[var(--text-primary)] font-mono font-bold text-sm w-16 text-right">
                  {selectedLap}
                  <span className="text-[var(--text-muted)] font-normal text-[10px]"> / {totalLaps}</span>
                </span>
                {syncMessage && (
                  <span className="w-2 h-2 rounded-full bg-[#e8002d] animate-pulse shrink-0" />
                )}
              </div>
            )}

            {/* Metric tiles row */}
            <div className="grid grid-cols-4 border-b border-[var(--border)]">
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
              cliffConfidence={cliffConfidence}
            />

            {/* Pit window timeline */}
            {selectedLap !== null && (
              <PitWindowTimeline
                currentLap={selectedLap}
                totalLaps={totalLaps}
                crossoverLap={strategy.crossover_lap}
                optimalLap={strategy.optimal_lap}
              />
            )}

            {/* Undercut threats */}
            {strategy.undercut_threats.length > 0 && (
              <div className="p-4 border-b border-[var(--border)]">
                <p className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest mb-2">
                  Undercut Threats
                </p>
                <div className="space-y-1">
                  {strategy.undercut_threats.map((t) => (
                    <div key={t.driver} className="flex items-center gap-3 text-xs border-l-2 border-l-[#e8002d] pl-2 py-1">
                      <span className="text-[var(--text-primary)] font-mono font-bold w-10">{t.driver}</span>
                      <span className="text-[var(--text-secondary)] font-mono">P{t.position}</span>
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: COMPOUND_HEX[t.compound] ?? "#555" }}
                      />
                      <span className="text-[var(--text-secondary)]">{t.compound}</span>
                      <span className="text-[var(--text-secondary)] font-mono">{t.tyre_age} laps</span>
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
              <div className="p-4 border-b border-[var(--border)]">
                <p className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest mb-2">
                  Driver State at Lap {selectedLap}
                </p>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-[var(--text-section)] text-[10px] uppercase mb-0.5">Position</p>
                    <p className="text-[var(--text-primary)] font-mono font-bold text-lg">P{selectedDriverState.position}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-section)] text-[10px] uppercase mb-0.5">Compound</p>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COMPOUND_HEX[selectedDriverState.compound] ?? "#555" }}
                      />
                      <p className="text-[var(--text-primary)] font-mono font-bold text-lg">{selectedDriverState.compound}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[var(--text-section)] text-[10px] uppercase mb-0.5">Tyre Age</p>
                    <p className="text-[var(--text-primary)] font-mono font-bold text-lg">{selectedDriverState.tyre_age} laps</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-section)] text-[10px] uppercase mb-0.5">Gap to Leader</p>
                    <p className="text-[var(--text-primary)] font-mono font-bold text-lg">
                      {selectedDriverState.gap_to_leader === 0 ? "LEADER" : `+${selectedDriverState.gap_to_leader.toFixed(1)}s`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Strategy summary */}
            <div className="p-4 border-b border-[var(--border)]">
              <p className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest mb-2">
                Strategy Summary
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[var(--text-section)] text-[10px] uppercase mb-0.5">Remaining</p>
                  <p className="text-[var(--text-primary)] font-mono font-bold text-lg">{strategy.remaining_laps} laps</p>
                </div>
                <div>
                  <p className="text-[var(--text-section)] text-[10px] uppercase mb-0.5">Best Alternative</p>
                  <div className="flex items-center gap-2">
                    {strategy.best_alt && (
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COMPOUND_HEX[strategy.best_alt] ?? "#555" }}
                      />
                    )}
                    <p className="text-[var(--text-primary)] font-mono font-bold text-lg">{strategy.best_alt ?? "—"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[var(--text-section)] text-[10px] uppercase mb-0.5">Rivals on Track</p>
                  <p className="text-[var(--text-primary)] font-mono font-bold text-lg">{strategy.all_drivers.length}</p>
                </div>
              </div>
            </div>

            {/* What-If Simulator */}
            {parsed && selectedLap !== null && selectedDriverState && (
              <WhatIfSimulator
                year={parsed.year}
                round={parsed.round}
                driver={activeDriver}
                totalLaps={totalLaps}
                currentLap={selectedLap}
                currentCompound={selectedDriverState.compound}
              />
            )}

            {/* Race Summary */}
            {summary && <RaceSummary summary={summary} />}

            {/* Circuit info */}
            <CircuitInfo
              circuit={strategy.circuit}
              pitLoss={strategy.pit_loss}
              curves={curves}
            />

            {/* Weather chart */}
            {weather && weather.length > 0 && (
              <WeatherChart data={weather} currentLap={selectedLap} />
            )}

            {/* Gap evolution chart */}
            {gaps && gaps.length > 0 && (
              <GapChart data={gaps} currentLap={selectedLap} driver={activeDriver} raceControl={raceControl} driverInfo={driverInfo} />
            )}

            {/* Position changes chart */}
            {positions.length > 0 && (
              <PositionChart
                data={positions}
                highlightDriver={activeDriver}
                raceControl={raceControl}
                currentLap={selectedLap}
                driverInfo={driverInfo}
                onSelectDriver={handleDriverSelect}
              />
            )}

            {/* Sector times table */}
            {sectors && sectors.length > 0 && (
              <SectorTimesTable sectors={sectors} selectedDriver={activeDriver} />
            )}

            {/* Lap time distribution */}
            {lapTimes.length > 0 && (
              <LapTimeDistribution data={lapTimes} highlightDriver={activeDriver} driverInfo={driverInfo} onSelectDriver={handleDriverSelect} />
            )}

            {/* Tyre strategy timeline */}
            {stints.length > 0 && (
              <TyreTimeline stints={stints} totalLaps={totalLaps} currentLap={selectedLap ?? undefined} onSelectDriver={handleDriverSelect} highlightDriver={activeDriver} driverInfo={driverInfo} />
            )}

            {/* Pit stop performance */}
            {pitStops.length > 0 && (
              <PitStopTable stops={pitStops} highlightDriver={activeDriver} driverInfo={driverInfo} onSelectDriver={handleDriverSelect} />
            )}
          </div>
        </div>
      )}

      {/* No-data state */}
      {!loading && !error && curves && strategy === null && (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-xs">
          No strategy data available for this selection.
        </div>
      )}
    </div>
  )
}
