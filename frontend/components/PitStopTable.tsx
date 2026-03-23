"use client"

import type { PitStopInfo } from "@/lib/api"
import { COMPOUND_HEX } from "@/lib/constants"
import ChartFullScreen from "./ChartFullScreen"

interface PitStopTableProps {
  stops: PitStopInfo[]
  highlightDriver?: string
  onSelectDriver?: (driver: string) => void
}

export default function PitStopTable({ stops, highlightDriver, onSelectDriver }: PitStopTableProps) {
  if (stops.length === 0) return null

  // Find fastest pit stop for highlighting
  const fastestDuration = Math.min(...stops.map((s) => s.pit_duration))

  return (
    <ChartFullScreen title="Pit Stops">
      {() => (
    <div className="p-4 border-b border-[var(--border)]">
      <p className="text-xs font-medium text-[var(--text-section)] uppercase tracking-widest mb-3">
        Pit Stops
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-section)] text-[10px] uppercase tracking-wider">
              <th className="text-left py-1.5 px-2 font-medium">Driver</th>
              <th className="text-center py-1.5 px-2 font-medium">Lap</th>
              <th className="text-center py-1.5 px-2 font-medium">Duration</th>
              <th className="text-center py-1.5 px-2 font-medium">From</th>
              <th className="text-center py-1.5 px-2 font-medium">To</th>
            </tr>
          </thead>
          <tbody>
            {stops.map((stop, i) => {
              const isHighlighted = stop.driver === highlightDriver
              const isFastest = stop.pit_duration === fastestDuration
              return (
                <tr
                  key={`${stop.driver}-${stop.lap}-${i}`}
                  onClick={() => onSelectDriver?.(stop.driver)}
                  className={`border-b border-[var(--border)] transition-opacity ${
                    isHighlighted ? "bg-[var(--surface-raised)]" : ""
                  } ${highlightDriver && !isHighlighted ? "opacity-40" : ""} ${onSelectDriver ? "cursor-pointer hover:opacity-100 hover:bg-[var(--surface-raised)]" : ""}`}
                >
                  <td className="py-1.5 px-2">
                    <span className={`font-mono font-bold ${isHighlighted ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                      {stop.driver}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono text-[var(--text-muted)]">
                    {stop.lap}
                  </td>
                  <td className={`py-1.5 px-2 text-center font-mono font-bold ${
                    isFastest ? "text-[#a855f7]" : "text-[var(--text-primary)]"
                  }`}>
                    {stop.pit_duration.toFixed(1)}s
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: COMPOUND_HEX[stop.compound_before] ?? "#555" }}
                      />
                      <span className="text-[var(--text-muted)] font-mono text-[10px]">{stop.compound_before[0]}</span>
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: COMPOUND_HEX[stop.compound_after] ?? "#555" }}
                      />
                      <span className="text-[var(--text-muted)] font-mono text-[10px]">{stop.compound_after[0]}</span>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] text-[var(--text-muted)] mt-2">
        <span className="text-[#a855f7]">Purple</span> = fastest pit stop
      </p>
    </div>
      )}
    </ChartFullScreen>
  )
}
