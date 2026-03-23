"use client"

import type { LapTimeStats } from "@/lib/api"
import ChartFullScreen from "./ChartFullScreen"

interface LapTimeDistributionProps {
  data: LapTimeStats[]
  highlightDriver?: string
  onSelectDriver?: (driver: string) => void
}

export default function LapTimeDistribution({ data, highlightDriver, onSelectDriver }: LapTimeDistributionProps) {
  if (data.length === 0) return null

  // Find the global range for scaling
  const globalMin = Math.min(...data.map((d) => d.whisker_low))
  const globalMax = Math.max(...data.map((d) => d.whisker_high))
  const range = globalMax - globalMin

  function toPercent(val: number): number {
    return ((val - globalMin) / range) * 100
  }

  return (
    <ChartFullScreen title="Lap Time Distribution">
      {() => (
    <div className="p-4 border-b border-[var(--border)]">
      <p className="text-xs font-medium text-[var(--text-section)] uppercase tracking-widest mb-3">
        Lap Time Distribution
      </p>

      {/* Scale */}
      <div className="flex items-center mb-1 ml-12">
        <div className="flex-1 flex justify-between text-[9px] text-[var(--text-muted)] font-mono">
          <span>{globalMin.toFixed(1)}s</span>
          <span>{((globalMin + globalMax) / 2).toFixed(1)}s</span>
          <span>{globalMax.toFixed(1)}s</span>
        </div>
      </div>

      <div className="space-y-1">
        {data.map((stat) => {
          const isHighlighted = stat.driver === highlightDriver
          const whiskerLeft = toPercent(stat.whisker_low)
          const whiskerWidth = toPercent(stat.whisker_high) - whiskerLeft
          const boxLeft = toPercent(stat.q1)
          const boxWidth = toPercent(stat.q3) - boxLeft
          const medianPos = toPercent(stat.median)

          return (
            <div
              key={stat.driver}
              onClick={() => onSelectDriver?.(stat.driver)}
              className={`flex items-center gap-2 transition-opacity ${isHighlighted ? "opacity-100" : highlightDriver ? "opacity-40" : "opacity-80"} ${onSelectDriver ? "cursor-pointer hover:opacity-100" : ""}`}
            >
              <span
                className={`text-[10px] font-mono w-10 text-right shrink-0 transition-colors ${
                  isHighlighted ? "text-[var(--text-primary)] font-bold" : "text-[var(--text-muted)]"
                }`}
              >
                {stat.driver}
              </span>
              <div className="flex-1 h-5 relative">
                {/* Whisker line */}
                <div
                  className="absolute top-1/2 h-px bg-[var(--text-muted)]"
                  style={{ left: `${whiskerLeft}%`, width: `${whiskerWidth}%`, transform: "translateY(-50%)" }}
                />
                {/* Whisker caps */}
                <div
                  className="absolute top-1/2 w-px h-2 bg-[var(--text-muted)]"
                  style={{ left: `${whiskerLeft}%`, transform: "translateY(-50%)" }}
                />
                <div
                  className="absolute top-1/2 w-px h-2 bg-[var(--text-muted)]"
                  style={{ left: `${toPercent(stat.whisker_high)}%`, transform: "translateY(-50%)" }}
                />
                {/* IQR box */}
                <div
                  className={`absolute top-0.5 bottom-0.5 rounded-sm ${isHighlighted ? "bg-[#e8002d]/60" : "bg-[var(--border)]"}`}
                  style={{ left: `${boxLeft}%`, width: `${boxWidth}%` }}
                />
                {/* Median line */}
                <div
                  className={`absolute top-0 bottom-0 w-0.5 ${isHighlighted ? "bg-[var(--text-primary)]" : "bg-[var(--text-muted)]"}`}
                  style={{ left: `${medianPos}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-[var(--text-muted)] w-14 text-right shrink-0">
                {stat.median.toFixed(2)}s
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-[9px] text-[var(--text-muted)] mt-2 ml-12">
        Box: Q1–Q3 · Line: median · Whiskers: 1.5×IQR · Excludes pit/SC laps
      </p>
    </div>
      )}
    </ChartFullScreen>
  )
}
