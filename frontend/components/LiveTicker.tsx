"use client"

import { useEffect, useState, useRef } from "react"
import { getLiveLaps } from "@/lib/api"
import type { LiveLap } from "@/lib/api"

export default function LiveTicker() {
  const [laps, setLaps] = useState<LiveLap[]>([])
  const [flash, setFlash] = useState<boolean>(false)
  const [fetchError, setFetchError] = useState<boolean>(false)
  const prevDataRef = useRef<string>("")

  useEffect(() => {
    let active = true

    async function poll() {
      if (!active) return
      try {
        const data = await getLiveLaps()
        if (!active) return

        const serialised = JSON.stringify(data)
        if (serialised !== prevDataRef.current && data.length > 0) {
          prevDataRef.current = serialised
          setLaps(data)
          setFetchError(false)
          // Trigger flash animation
          setFlash(true)
          setTimeout(() => setFlash(false), 600)
        } else if (data.length === 0) {
          setLaps([])
          setFetchError(false)
        }
      } catch {
        if (active) setFetchError(true)
      }
    }

    // Initial fetch
    poll()
    const interval = setInterval(poll, 2000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="bg-[#111] border border-[#222] rounded-lg p-4">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider">
          Live Timing
        </h2>
        <span className="flex items-center gap-1.5 bg-[#e8002d] text-white text-xs font-bold px-2 py-0.5 rounded">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse"
            aria-hidden="true"
          />
          Live
        </span>
      </div>

      {/* Error or empty state */}
      {fetchError && (
        <p className="text-[#888] text-sm">No live session</p>
      )}

      {!fetchError && laps.length === 0 && (
        <p className="text-[#888] text-sm">No live session</p>
      )}

      {/* Lap list */}
      {!fetchError && laps.length > 0 && (
        <ul
          className={`space-y-1 transition-opacity duration-300 ${flash ? "opacity-60" : "opacity-100"}`}
        >
          {laps.map((lap) => (
            <li
              key={lap.driver_number}
              className={`flex items-center justify-between text-sm py-1 border-b border-[#1a1a1a] last:border-b-0
                          ${flash ? "border-l-2 border-l-[#e8002d]" : "border-l-2 border-l-transparent"}
                          transition-colors duration-300`}
            >
              <span className="text-[#888] w-10 shrink-0">#{lap.driver_number}</span>
              <span className="text-white font-medium flex-1">
                Lap {lap.lap_number}
              </span>
              {lap.lap_duration !== null && (
                <span className="text-[#888] text-xs font-mono">
                  {lap.lap_duration.toFixed(3)}s
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
