"use client"

import type { PitStopInfo } from "@/lib/api"
import { COMPOUND_HEX } from "@/lib/constants"

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
    <div className="p-4 border-b border-[#222]">
      <p className="text-[10px] font-medium text-[#555] uppercase tracking-widest mb-3">
        Pit Stops
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#222] text-[#555] text-[10px] uppercase tracking-wider">
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
                  className={`border-b border-[#111] transition-opacity ${
                    isHighlighted ? "bg-[#1a1a1a]" : ""
                  } ${highlightDriver && !isHighlighted ? "opacity-40" : ""} ${onSelectDriver ? "cursor-pointer hover:opacity-100 hover:bg-[#1a1a1a]" : ""}`}
                >
                  <td className="py-1.5 px-2">
                    <span className={`font-mono font-bold ${isHighlighted ? "text-white" : "text-[#888]"}`}>
                      {stop.driver}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono text-[#888]">
                    {stop.lap}
                  </td>
                  <td className={`py-1.5 px-2 text-center font-mono font-bold ${
                    isFastest ? "text-[#a855f7]" : "text-white"
                  }`}>
                    {stop.pit_duration.toFixed(1)}s
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: COMPOUND_HEX[stop.compound_before] ?? "#555" }}
                      />
                      <span className="text-[#888] font-mono text-[10px]">{stop.compound_before[0]}</span>
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: COMPOUND_HEX[stop.compound_after] ?? "#555" }}
                      />
                      <span className="text-[#888] font-mono text-[10px]">{stop.compound_after[0]}</span>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] text-[#333] mt-2">
        <span className="text-[#a855f7]">Purple</span> = fastest pit stop
      </p>
    </div>
  )
}
