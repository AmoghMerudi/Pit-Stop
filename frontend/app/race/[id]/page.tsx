"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getDegradation, getStrategy } from "@/lib/api"
import type { DegradationCurve, StrategyResponse } from "@/lib/api"
import DegradationChart from "@/components/DegradationChart"
import PitWindowPanel from "@/components/PitWindowPanel"
import RivalTable from "@/components/RivalTable"
import LiveTicker from "@/components/LiveTicker"

interface DriverRow {
  driver: string
  compound: string
  tyre_age: number
  position: number
  is_threat: boolean
}

interface PageProps {
  params: Promise<{ id: string }>
}

function buildRivalRows(strategy: StrategyResponse): DriverRow[] {
  return strategy.undercut_threats.map((driver, index) => ({
    driver,
    compound: "SOFT",
    tyre_age: 0,
    position: index + 1,
    is_threat: true,
  }))
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

export default function RacePage({ params }: PageProps) {
  const [id, setId] = useState<string>("")
  const [curves, setCurves] = useState<DegradationCurve[] | null>(null)
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Unwrap params (Next.js 15 async params)
  useEffect(() => {
    params.then((p) => setId(p.id))
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-6 md:px-8">
      {/* Top bar */}
      <header className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-[#888] hover:text-white text-sm transition-colors"
        >
          <span aria-hidden="true">&#8592;</span>
          Back
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[#e8002d] font-bold text-lg">&#9646;</span>
          <span className="text-white font-semibold tracking-tight">Pit Stop</span>
        </div>

        {parsed && (
          <div className="text-right text-sm">
            <span className="text-white font-medium">
              {parsed.year} · R{parsed.round} · {parsed.driver}
            </span>
          </div>
        )}
      </header>

      {/* Error banner */}
      {error && (
        <div className="mb-6 bg-[#2a0a0a] border border-[#e8002d] rounded-lg px-5 py-4 text-[#e8002d] text-sm">
          <span className="font-semibold">Error: </span>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="space-y-4">
          {/* Skeleton blocks */}
          <div className="bg-[#111] border border-[#222] rounded-lg h-64 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#111] border border-[#222] rounded-lg h-40 animate-pulse" />
            <div className="bg-[#111] border border-[#222] rounded-lg h-40 animate-pulse" />
          </div>
          <div className="flex items-center justify-center py-8 text-[#555] text-sm">
            Loading race data — this may take a moment if the session is not cached...
          </div>
        </div>
      )}

      {/* Dashboard content */}
      {!loading && !error && curves && strategy && (
        <div className="space-y-4">
          {/* Degradation chart — full width */}
          <DegradationChart curves={curves} />

          {/* Pit window + rival table — side by side on wider screens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PitWindowPanel strategy={strategy} />
            <RivalTable rows={buildRivalRows(strategy)} />
          </div>

          {/* Live ticker */}
          <LiveTicker />
        </div>
      )}

      {/* No-data state (fetched successfully but empty) */}
      {!loading && !error && curves && strategy === null && (
        <div className="flex items-center justify-center py-20 text-[#888] text-sm">
          No strategy data available for this selection.
        </div>
      )}
    </div>
  )
}
