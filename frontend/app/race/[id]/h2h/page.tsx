"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { getDegradation, getStrategy, getStints, getGapEvolution } from "@/lib/api"
import type { DegradationCurve, StrategyResponse, StintInfo, GapEvolutionPoint } from "@/lib/api"
import DegradationChart from "@/components/DegradationChart"
import MetricTile from "@/components/MetricTile"
import PitCountdown from "@/components/PitCountdown"
import TyreTimeline from "@/components/TyreTimeline"
import ThemeToggle from "@/components/ThemeToggle"
import { COMPOUND_HEX } from "@/lib/constants"

interface PageProps {
  params: Promise<{ id: string }>
}

function parseId(id: string) {
  const parts = id.split("-")
  if (parts.length < 3) return null
  const year = parseInt(parts[0], 10)
  const round = parseInt(parts[1], 10)
  const driver = parts.slice(2).join("-").toUpperCase()
  if (isNaN(year) || isNaN(round) || !driver) return null
  return { year, round, driver }
}

function ndDisplay(delta: number) {
  const sign = delta >= 0 ? "+" : ""
  return { value: `${sign}${delta.toFixed(3)}`, status: (delta >= 0 ? "green" : "red") as "green" | "red" }
}

interface DriverColumn {
  strategy: StrategyResponse | null
  gaps: GapEvolutionPoint[]
  loading: boolean
}

export default function H2HPage({ params }: PageProps) {
  const searchParams = useSearchParams()
  const [id, setId] = useState("")
  const [parsed, setParsed] = useState<{ year: number; round: number; driver: string } | null>(null)
  const [curves, setCurves] = useState<DegradationCurve[]>([])
  const [stints, setStints] = useState<StintInfo[]>([])
  const [totalLaps, setTotalLaps] = useState(57)
  const [selectedLap, setSelectedLap] = useState<number | null>(null)
  const [allDrivers, setAllDrivers] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const [d1Code, setD1Code] = useState("")
  const [d2Code, setD2Code] = useState("")
  const [col1, setCol1] = useState<DriverColumn>({ strategy: null, gaps: [], loading: true })
  const [col2, setCol2] = useState<DriverColumn>({ strategy: null, gaps: [], loading: true })

  useEffect(() => {
    params.then((p) => setId(p.id)).catch(() => setError("Failed to read route"))
  }, [params])

  // Initialize from URL
  useEffect(() => {
    if (!id) return
    const p = parseId(id)
    if (!p) { setError("Invalid race ID"); return }
    setParsed(p)

    const urlD1 = searchParams.get("d1")?.toUpperCase() || p.driver
    const urlD2 = searchParams.get("d2")?.toUpperCase() || ""

    setD1Code(urlD1)

    // Load shared data + first driver
    Promise.all([
      getDegradation(p.year, p.round),
      getStrategy(p.year, p.round, urlD1),
      getStints(p.year, p.round),
      getGapEvolution(p.year, p.round, urlD1),
    ]).then(([deg, strat, st, gaps]) => {
      setCurves(deg)
      setStints(st)
      const tl = strat.total_laps ?? strat.current_lap ?? 57
      setTotalLaps(tl)
      setSelectedLap(strat.current_lap ?? tl)
      setCol1({ strategy: strat, gaps, loading: false })

      const drivers = strat.all_drivers.map((d) => d.driver).filter((d) => d !== urlD1)
      setAllDrivers(strat.all_drivers.map((d) => d.driver))

      // Set d2 from URL or pick first available
      const finalD2 = urlD2 && drivers.includes(urlD2) ? urlD2 : drivers[0] || ""
      setD2Code(finalD2)

      if (finalD2) {
        Promise.all([
          getStrategy(p.year, p.round, finalD2),
          getGapEvolution(p.year, p.round, finalD2),
        ]).then(([s2, g2]) => {
          setCol2({ strategy: s2, gaps: g2, loading: false })
        }).catch(() => setCol2({ strategy: null, gaps: [], loading: false }))
      }
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load")
      setCol1((c) => ({ ...c, loading: false }))
    })
  }, [id, searchParams])

  function switchDriver(col: 1 | 2, driver: string) {
    if (!parsed) return
    const setter = col === 1 ? setCol1 : setCol2
    const codeSetter = col === 1 ? setD1Code : setD2Code
    codeSetter(driver)
    setter({ strategy: null, gaps: [], loading: true })
    setSyncMessage("Race control is syncing data")
    const lap = selectedLap ?? undefined
    Promise.all([
      getStrategy(parsed.year, parsed.round, driver, lap),
      getGapEvolution(parsed.year, parsed.round, driver),
    ]).then(([s, g]) => {
      setter({ strategy: s, gaps: g, loading: false })
    }).catch(() => setter({ strategy: null, gaps: [], loading: false }))
      .finally(() => setSyncMessage(null))
  }

  function handleLapChange(e: React.ChangeEvent<HTMLInputElement>) {
    const lap = parseInt(e.target.value, 10)
    setSelectedLap(lap)
    if (!parsed) return
    setSyncMessage("Optimizing race strategy")
    Promise.all([
      d1Code ? getStrategy(parsed.year, parsed.round, d1Code, lap).then((s) => setCol1((c) => ({ ...c, strategy: s }))) : Promise.resolve(),
      d2Code ? getStrategy(parsed.year, parsed.round, d2Code, lap).then((s) => setCol2((c) => ({ ...c, strategy: s }))) : Promise.resolve(),
    ]).finally(() => setSyncMessage(null))
  }

  function renderColumn(code: string, col: DriverColumn, colNum: 1 | 2) {
    const s = col.strategy
    if (col.loading) {
      return <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-xs py-12">Loading {code}...</div>
    }
    if (!s) {
      return <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-xs py-12">No data</div>
    }

    const nd = ndDisplay(s.net_delta)
    const driverState = s.all_drivers.find((d) => d.driver === code)

    return (
      <div className="flex-1 min-w-0">
        {/* Driver selector */}
        <div className="px-3 py-2 border-b border-[var(--border)]">
          <select
            value={code}
            onChange={(e) => switchDriver(colNum, e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] px-2 py-1.5 text-[var(--text-primary)] text-sm font-mono font-bold focus:outline-none focus:border-[#e8002d]"
          >
            {allDrivers.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Driver state */}
        {driverState && (
          <div className="px-3 py-2 border-b border-[var(--border)] grid grid-cols-2 gap-2">
            <div>
              <p className="text-[8px] text-[var(--text-muted)] uppercase">Position</p>
              <p className="text-[var(--text-primary)] font-mono font-bold">P{driverState.position}</p>
            </div>
            <div>
              <p className="text-[8px] text-[var(--text-muted)] uppercase">Compound</p>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COMPOUND_HEX[driverState.compound] ?? "#555" }} />
                <p className="text-[var(--text-primary)] font-mono font-bold text-sm">{driverState.compound}</p>
              </div>
            </div>
            <div>
              <p className="text-[8px] text-[var(--text-muted)] uppercase">Tyre Age</p>
              <p className="text-[var(--text-primary)] font-mono font-bold">{driverState.tyre_age}L</p>
            </div>
            <div>
              <p className="text-[8px] text-[var(--text-muted)] uppercase">Gap</p>
              <p className="text-[var(--text-primary)] font-mono font-bold">
                {driverState.position === 1 ? "LEAD" : `+${driverState.gap_to_leader.toFixed(1)}s`}
              </p>
            </div>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 border-b border-[var(--border)]">
          <MetricTile label="Crossover" value={s.crossover_lap >= 999 ? "—" : s.crossover_lap} unit={s.crossover_lap < 999 ? "laps" : undefined} />
          <MetricTile label="Net Delta" value={nd.value} unit="s" status={nd.status} />
        </div>

        {/* Pit rec */}
        <PitCountdown crossoverLap={s.crossover_lap} recommendPit={s.recommend_pit} reason={s.reason} />

        {/* Threats */}
        {s.undercut_threats.length > 0 && (
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Threats</p>
            {s.undercut_threats.slice(0, 3).map((t) => (
              <div key={t.driver} className="flex items-center gap-2 text-[10px] border-l-2 border-l-[#e8002d] pl-1.5 py-0.5">
                <span className="text-[var(--text-primary)] font-mono font-bold">{t.driver}</span>
                <span className="text-[var(--text-secondary)] font-mono">P{t.position}</span>
                <span className="ml-auto text-[#e8002d] font-mono font-bold">{(t.threat_score * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--surface)]">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-[var(--border)] shrink-0">
        <Link
          href={`/race/${id}`}
          className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition-colors"
        >
          <span aria-hidden="true">&#8592;</span> Back to Race
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[#e8002d] font-bold text-sm" aria-hidden="true">&#9646;</span>
          <span className="text-[var(--text-primary)] font-semibold text-sm tracking-tight">PITWALL</span>
          <span className="text-[var(--text-muted)] text-xs font-mono ml-2">H2H</span>
        </div>
        <div className="flex items-center gap-3">
          {parsed && (
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              {parsed.year} · R{parsed.round}
            </span>
          )}
          <ThemeToggle />
        </div>
      </header>

      {error && (
        <div className="px-4 py-3 bg-[var(--error-bg)] border-b border-[#e8002d] text-[#e8002d] text-xs">
          <span className="font-bold">ERROR: </span>{error}
        </div>
      )}

      {/* Lap slider */}
      {selectedLap !== null && totalLaps > 0 && (
        <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-4 shrink-0">
          <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-widest">Lap</span>
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
              [&::-moz-range-thumb]:border-0"
          />
          <span className="text-[var(--text-primary)] font-mono font-bold text-sm w-16 text-right">
            {selectedLap}<span className="text-[var(--text-muted)] font-normal text-[10px]"> / {totalLaps}</span>
          </span>
        </div>
      )}

      {/* Sync overlay — full page */}
      {syncMessage && (
        <div className="fixed inset-0 z-50 bg-[var(--surface)]/90 flex flex-col items-center justify-center gap-6">
          <style>{`
            @keyframes f1-light-h2h {
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
                  animation: "f1-light-h2h 3s infinite",
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

      {/* Two columns */}
      <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x divide-[var(--border)]">
        <div className="overflow-y-auto">
          {renderColumn(d1Code, col1, 1)}
        </div>
        <div className="overflow-y-auto">
          {renderColumn(d2Code, col2, 2)}
        </div>
      </div>

      {/* Shared sections */}
      {curves.length > 0 && (
        <div className="border-t border-[var(--border)] max-h-[40vh] overflow-y-auto">
          <DegradationChart
            curves={curves}
            currentTyreAge={col1.strategy?.all_drivers.find((d) => d.driver === d1Code)?.tyre_age}
          />
          {stints.length > 0 && <TyreTimeline stints={stints} totalLaps={totalLaps} />}
        </div>
      )}
    </div>
  )
}
