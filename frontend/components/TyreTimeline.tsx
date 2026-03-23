"use client"

import type { StintInfo, DriverInfo } from "@/lib/api"
import { COMPOUND_HEX, getDriverColor } from "@/lib/constants"
import ChartFullScreen from "./ChartFullScreen"

interface TyreTimelineProps {
  stints: StintInfo[]
  totalLaps: number
  currentLap?: number
  onSelectDriver?: (driver: string) => void
  highlightDriver?: string
  driverInfo?: DriverInfo[]
}

export default function TyreTimeline({ stints, totalLaps, currentLap, onSelectDriver, highlightDriver, driverInfo }: TyreTimelineProps) {
  if (stints.length === 0) return null

  // Group stints by driver
  const driverStints = new Map<string, StintInfo[]>()
  for (const stint of stints) {
    const existing = driverStints.get(stint.driver) ?? []
    existing.push(stint)
    driverStints.set(stint.driver, existing)
  }

  // Sort drivers by their first stint position (roughly grid order)
  const drivers = Array.from(driverStints.keys()).sort()

  return (
    <ChartFullScreen title="Tyre Strategy Timeline">
      {() => (
    <div className="p-4 border-b border-[var(--border)]">
      <p className="text-xs font-medium text-[var(--text-section)] uppercase tracking-widest mb-3">
        Tyre Strategy Timeline
      </p>

      {/* Lap scale */}
      <div className="flex items-center mb-1 ml-12">
        <div className="flex-1 flex justify-between text-[9px] text-[var(--text-muted)] font-mono">
          <span>L1</span>
          <span>L{Math.round(totalLaps / 4)}</span>
          <span>L{Math.round(totalLaps / 2)}</span>
          <span>L{Math.round((3 * totalLaps) / 4)}</span>
          <span>L{totalLaps}</span>
        </div>
      </div>

      <div className="space-y-0.5">
        {drivers.map((driver) => {
          const driverStintList = driverStints.get(driver) ?? []
          return (
            <div
              key={driver}
              onClick={() => onSelectDriver?.(driver)}
              className={`flex items-center gap-2 transition-opacity ${highlightDriver && driver !== highlightDriver ? "opacity-40" : ""} ${onSelectDriver ? "cursor-pointer hover:opacity-100" : ""}`}
            >
              <span
                className={`text-[10px] font-mono w-10 text-right shrink-0 transition-colors ${
                  driver === highlightDriver ? "font-bold" : ""
                }`}
                style={{ color: driver === highlightDriver ? getDriverColor(driver, driverInfo) : "var(--text-muted)" }}
              >
                {driver}
              </span>
              <div className="flex-1 flex h-5 bg-[var(--surface-raised)] rounded-sm overflow-hidden relative">
                {driverStintList.map((stint) => {
                  const width = ((stint.lap_end - stint.lap_start + 1) / totalLaps) * 100
                  const left = ((stint.lap_start - 1) / totalLaps) * 100
                  const color = COMPOUND_HEX[stint.compound] ?? "#555"
                  return (
                    <div
                      key={stint.stint_number}
                      className="h-full relative group"
                      style={{
                        width: `${width}%`,
                        marginLeft: stint.stint_number === 1 ? `${left}%` : 0,
                        backgroundColor: color,
                        opacity: 0.85,
                      }}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                        <div className="bg-[var(--surface-raised)] border border-[var(--border)] px-2 py-1 text-[9px] font-mono text-[var(--text-primary)] whitespace-nowrap rounded">
                          {stint.compound} · L{stint.lap_start}–L{stint.lap_end} ({stint.lap_end - stint.lap_start + 1} laps)
                        </div>
                      </div>
                    </div>
                  )
                })}
                {currentLap != null && totalLaps > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-px pointer-events-none z-10"
                    style={{ left: `${(currentLap / totalLaps) * 100}%`, backgroundColor: "#e8002d", opacity: 0.8 }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3">
        {["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"].map((c) => (
          <div key={c} className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: COMPOUND_HEX[c] }}
            />
            <span className="text-[9px] text-[var(--text-muted)]">{c[0]}</span>
          </div>
        ))}
      </div>
    </div>
      )}
    </ChartFullScreen>
  )
}
