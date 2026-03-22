"use client"

import { useEffect, useState } from "react"
import { getLiveSession, getLiveStints, getLiveLaps } from "@/lib/api"
import type { LiveSessionInfo, LiveLap, LiveStint } from "@/lib/api"

interface TickerData {
  session: LiveSessionInfo
  currentLap: number
  totalLaps: number
  compound: string | null
  stintLap: number | null
}

export default function LiveTicker() {
  const [data, setData] = useState<TickerData | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchData() {
      try {
        const [session, laps, stints] = await Promise.all([
          getLiveSession(),
          getLiveLaps().catch(() => [] as LiveLap[]),
          getLiveStints().catch(() => [] as LiveStint[]),
        ])

        if (!mounted || !session.active) {
          if (mounted) setData(null)
          return
        }

        let currentLap = 0
        if (laps.length > 0) {
          currentLap = Math.max(...laps.map((l) => l.lap_number))
        }

        const totalLaps = 57

        let compound: string | null = null
        let stintLap: number | null = null
        if (stints.length > 0) {
          const latest = stints.reduce((a, b) =>
            b.stint_number > a.stint_number ? b : a
          )
          compound = latest.compound
          stintLap = currentLap > 0 ? currentLap - latest.lap_start : null
        }

        if (mounted) {
          setData({ session, currentLap, totalLaps, compound, stintLap })
        }
      } catch {
        if (mounted) setData(null)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 15_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  if (!data) return null

  const { session, currentLap, totalLaps, compound, stintLap } = data

  return (
    <div className="bg-[#0a0a0a] border-b border-[#222] px-6 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#39b54a] animate-pulse" />
          <span className="text-[#39b54a] text-[10px] font-bold uppercase tracking-widest">
            Live: {session.circuit ?? session.country ?? "Active"}
          </span>
        </div>
        <span className="text-[#333] text-[10px]">|</span>
        <span className="text-[#555] text-[10px] uppercase tracking-widest font-mono">
          {session.session_type ?? "Race"}
        </span>
        {currentLap > 0 && (
          <>
            <span className="text-[#333] text-[10px]">|</span>
            <span className="text-[#555] text-[10px] uppercase tracking-widest font-mono">
              LAP {currentLap} / {totalLaps}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        {compound && (
          <span className="text-[#e8002d] text-[10px] font-bold uppercase tracking-widest font-mono">
            {compound}{stintLap !== null ? ` L${stintLap}` : ""}
          </span>
        )}
        {session.year && session.round && (
          <>
            <span className="text-[#333] text-[10px]">|</span>
            <span className="text-[#555] text-[10px] uppercase tracking-widest font-mono">
              {session.year} R{session.round}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
