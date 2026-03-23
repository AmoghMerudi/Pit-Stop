"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import LiveSessionBadge from "@/components/LiveSessionBadge"
import MetricTile from "@/components/MetricTile"
import PitCountdown from "@/components/PitCountdown"
import CircuitInfo from "@/components/CircuitInfo"
import ThemeToggle from "@/components/ThemeToggle"
import { getLiveSession, getLiveGrid, getLiveStrategy, getLiveTyrePrediction } from "@/lib/api"
import type { LiveSessionInfo, LiveDriverState, LiveStrategyResponse, DegradationCurve, TyrePrediction } from "@/lib/api"
import { COMPOUND_COLOURS, COMPOUND_HEX } from "@/lib/constants"
import { requestPermission, notify, checkTriggers } from "@/lib/notifications"
import type { StrategySnapshot } from "@/lib/notifications"

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
  const [predictions, setPredictions] = useState<TyrePrediction[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const prevStrategyRef = useRef<StrategySnapshot | null>(null)

  // Load notification preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("pitwall-notifications")
    if (saved === "true") setNotificationsEnabled(true)
  }, [])

  async function toggleNotifications() {
    if (!notificationsEnabled) {
      const perm = await requestPermission()
      if (perm === "granted") {
        setNotificationsEnabled(true)
        localStorage.setItem("pitwall-notifications", "true")
        notify("Pitwall Notifications", "You'll be alerted on strategy changes")
      }
    } else {
      setNotificationsEnabled(false)
      localStorage.setItem("pitwall-notifications", "false")
    }
  }

  // Poll session + grid + tyre predictions
  const refresh = useCallback(async () => {
    try {
      const [sess, drivers, preds] = await Promise.all([
        getLiveSession(),
        getLiveGrid(),
        getLiveTyrePrediction().catch(() => []),
      ])
      setSession(sess)
      setGrid(drivers)
      setPredictions(preds)
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
        if (mounted) {
          // Check notification triggers
          if (notificationsEnabled) {
            const snapshot: StrategySnapshot = {
              recommend_pit: data.recommend_pit,
              crossover_lap: data.crossover_lap,
              undercut_threats: data.undercut_threats,
            }
            checkTriggers(prevStrategyRef.current, snapshot)
            prevStrategyRef.current = snapshot
          }
          setResult(data)
        }
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
  }, [selectedDriver, session?.active, notificationsEnabled])

  const nd = result ? netDeltaDisplay(result.net_delta) : null
  const fakeCurves: DegradationCurve[] = []

  // Get prediction for selected driver
  const driverPrediction = selectedDriver
    ? predictions.find((p) => p.driver === selectedDriver)
    : null

  // Loading state
  if (initialLoading) {
    return (
      <div className="h-screen flex flex-col bg-[var(--surface)]">
        <header className="h-12 flex items-center justify-between px-4 border-b border-[var(--border)] shrink-0">
          <Link href="/" className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition-colors">
            <span aria-hidden="true">&#8592;</span> Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[#e8002d] font-bold text-sm" aria-hidden="true">&#9646;</span>
            <span className="text-[var(--text-primary)] font-semibold text-sm tracking-tight">PITWALL</span>
            <span className="text-[var(--text-muted)] text-xs font-mono ml-2">LIVE</span>
          </div>
          <ThemeToggle />
        </header>
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-xs">
          Checking for active session...
        </div>
      </div>
    )
  }

  // No active race session
  if (!session?.active) {
    return (
      <div className="h-screen flex flex-col bg-[var(--surface)]">
        <header className="h-12 flex items-center justify-between px-4 border-b border-[var(--border)] shrink-0">
          <Link href="/" className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition-colors">
            <span aria-hidden="true">&#8592;</span> Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[#e8002d] font-bold text-sm" aria-hidden="true">&#9646;</span>
            <span className="text-[var(--text-primary)] font-semibold text-sm tracking-tight">PITWALL</span>
            <span className="text-[var(--text-muted)] text-xs font-mono ml-2">LIVE</span>
          </div>
          <div className="flex items-center gap-3">
            <LiveSessionBadge />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-3 h-3 rounded-full bg-[var(--border)]" />
          <p className="text-[var(--text-muted)] text-sm">No active race session</p>
          <p className="text-[var(--text-dim)] text-xs max-w-xs text-center">
            Live analysis is available during F1 race sessions. Check back when a race is underway.
          </p>
          <Link
            href="/"
            className="mt-4 text-[#e8002d] hover:text-[var(--text-primary)] text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Analyze a past race instead
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--surface)]">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-[var(--border)] shrink-0">
        <Link href="/" className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition-colors">
          <span aria-hidden="true">&#8592;</span> Back
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[#e8002d] font-bold text-sm" aria-hidden="true">&#9646;</span>
          <span className="text-[var(--text-primary)] font-semibold text-sm tracking-tight">PITWALL</span>
          <span className="text-[var(--text-muted)] text-xs font-mono ml-2">LIVE</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Notification toggle */}
          <button
            onClick={toggleNotifications}
            className={`text-xs transition-colors ${
              notificationsEnabled ? "text-[#e8002d]" : "text-[var(--text-dim)]"
            } hover:text-[var(--text-primary)]`}
            title={notificationsEnabled ? "Notifications on" : "Notifications off"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              {!notificationsEnabled && <line x1="1" y1="1" x2="23" y2="23" />}
            </svg>
          </button>
          <LiveSessionBadge />
          <ThemeToggle />
        </div>
      </header>

      {/* Session info bar */}
      <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-4 shrink-0">
        <span className="text-[var(--text-primary)] text-sm font-semibold">{session.circuit}</span>
        {session.country && <span className="text-[var(--text-muted)] text-xs">{session.country}</span>}
        {session.year && session.round && (
          <span className="text-[var(--text-muted)] text-xs font-mono">
            {session.year} R{session.round}
          </span>
        )}
        <span className="ml-auto text-[var(--text-dim)] text-[10px] font-mono">
          Auto-refresh {POLL_INTERVAL / 1000}s
        </span>
      </div>

      {/* Driver grid */}
      <div className="border-b border-[var(--border)] px-4 py-3 shrink-0">
        <p className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest mb-2">
          Select Driver
        </p>
        <div className="flex flex-wrap gap-1.5">
          {grid.map((d) => {
            const pred = predictions.find((p) => p.driver === d.driver)
            return (
              <button
                key={d.driver}
                onClick={() => {
                  setSelectedDriver(d.driver)
                  setResult(null)
                  setError(null)
                  prevStrategyRef.current = null
                }}
                className={`px-2.5 py-1.5 text-xs font-mono font-bold border transition-colors ${
                  selectedDriver === d.driver
                    ? "border-[#e8002d] text-[#e8002d] bg-[#e8002d]/10"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="mr-1.5 text-[var(--text-muted)] font-normal">P{d.position || "?"}</span>
                {d.driver}
                <span className={`ml-1.5 text-[10px] ${COMPOUND_COLOURS[d.compound] ?? "text-[var(--text-muted)]"}`}>
                  {d.compound?.charAt(0)}
                </span>
                {pred && (
                  <span className={`ml-1 text-[9px] font-normal ${
                    pred.estimated_laps_remaining <= 3 ? "text-[#e8002d]" :
                    pred.estimated_laps_remaining <= 8 ? "text-[#f59e0b]" :
                    "text-[var(--text-dim)]"
                  }`}>
                    {pred.estimated_laps_remaining}L
                  </span>
                )}
              </button>
            )
          })}
          {grid.length === 0 && (
            <span className="text-[var(--text-muted)] text-xs">Waiting for driver data...</span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-[var(--error-bg)] border-b border-[#e8002d] text-[#e8002d] text-xs">
          <span className="font-bold">ERROR: </span>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !result && (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-xs">
          Loading strategy for {selectedDriver}...
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="flex-1 overflow-y-auto">
          {/* Metric tiles */}
          <div className="grid grid-cols-4 border-b border-[var(--border)]">
            <MetricTile
              label="Crossover"
              value={result.crossover_lap >= 999 ? "\u2014" : result.crossover_lap}
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
              value={result.optimal_lap <= 0 || result.optimal_lap >= 999 ? "\u2014" : result.optimal_lap}
            />
            <MetricTile
              label="Rivals"
              value={result.rival_count}
              status={result.rival_count > 0 ? "neutral" : "amber"}
            />
          </div>

          {/* Tyre life prediction */}
          {driverPrediction && (
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <p className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest mb-2">
                Tyre Life Prediction
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COMPOUND_HEX[driverPrediction.compound] ?? "#555" }}
                  />
                  <span className="text-[var(--text-primary)] font-mono font-bold text-sm">
                    {driverPrediction.compound}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-[var(--text-muted)] uppercase">Age </span>
                  <span className="text-[var(--text-primary)] font-mono font-bold text-sm">
                    {driverPrediction.tyre_age}L
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-[var(--text-muted)] uppercase">Cliff </span>
                  <span className="text-[var(--text-primary)] font-mono font-bold text-sm">
                    {driverPrediction.predicted_cliff_lap}L
                  </span>
                </div>
                <div className={`ml-auto font-mono font-bold text-sm ${
                  driverPrediction.estimated_laps_remaining <= 3 ? "text-[#e8002d]" :
                  driverPrediction.estimated_laps_remaining <= 8 ? "text-[#f59e0b]" :
                  "text-[#22c55e]"
                }`}>
                  {driverPrediction.estimated_laps_remaining}L remaining
                </div>
              </div>
              {/* Visual bar */}
              <div className="mt-2 h-1.5 bg-[var(--border)] relative overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.min(100, (driverPrediction.tyre_age / driverPrediction.predicted_cliff_lap) * 100)}%`,
                    backgroundColor:
                      driverPrediction.estimated_laps_remaining <= 3 ? "#e8002d" :
                      driverPrediction.estimated_laps_remaining <= 8 ? "#f59e0b" :
                      "#22c55e",
                  }}
                />
              </div>
            </div>
          )}

          {/* Pit recommendation */}
          <PitCountdown
            crossoverLap={result.crossover_lap}
            recommendPit={result.recommend_pit}
            reason={result.reason}
          />

          {/* Undercut threats */}
          {result.undercut_threats.length > 0 && (
            <div className="p-4 border-b border-[var(--border)]">
              <p className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest mb-2">
                Undercut Threats
              </p>
              <div className="space-y-1">
                {result.undercut_threats.map((t) => (
                  <div key={t.driver} className="flex items-center gap-3 text-xs border-l-2 border-l-[#e8002d] pl-2 py-1">
                    <span className="text-[var(--text-primary)] font-mono font-bold w-10">{t.driver}</span>
                    <span className="text-[var(--text-secondary)] font-mono">P{t.position}</span>
                    <span className="text-[var(--text-secondary)]">{t.compound}</span>
                    <span className="text-[var(--text-secondary)] font-mono">{t.tyre_age} laps</span>
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
        <div className="flex-1 flex items-center justify-center text-[var(--text-dim)] text-xs">
          Select a driver from the grid above
        </div>
      )}
    </div>
  )
}
