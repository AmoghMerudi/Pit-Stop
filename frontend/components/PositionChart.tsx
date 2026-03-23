"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts"
import type { PositionHistoryPoint, RaceControlEvent, DriverInfo } from "@/lib/api"
import { getDriverColor, getDriverTeam } from "@/lib/constants"
import ChartFullScreen from "./ChartFullScreen"

const RC_COLORS: Record<string, string> = {
  SC: "rgba(255, 215, 0, 0.12)",
  VSC: "rgba(255, 215, 0, 0.08)",
  RED: "rgba(232, 0, 45, 0.12)",
}

interface PositionChartProps {
  data: PositionHistoryPoint[]
  highlightDriver?: string
  raceControl?: RaceControlEvent[]
  currentLap?: number | null
  driverInfo?: DriverInfo[]
  onSelectDriver?: (driver: string) => void
}

export default function PositionChart({ data, highlightDriver, raceControl, currentLap, driverInfo, onSelectDriver }: PositionChartProps) {
  if (data.length === 0) return null

  // Get all drivers from the data
  const allDrivers = new Set<string>()
  for (const point of data) {
    for (const drv of Object.keys(point.positions)) {
      allDrivers.add(drv)
    }
  }
  const drivers = Array.from(allDrivers)

  // Transform data for recharts: each row has lap + one key per driver
  const chartData = data.map((point) => {
    const row: Record<string, number> = { lap: point.lap }
    for (const drv of drivers) {
      if (point.positions[drv] !== undefined) {
        row[drv] = point.positions[drv]
      }
    }
    return row
  })

  return (
    <ChartFullScreen title="Position Changes">
      {(isFullScreen) => (
    <div className={`p-4 ${isFullScreen ? "" : "border-b border-[var(--border)]"} ${isFullScreen ? "h-full flex flex-col" : ""}`}>
      <p className="text-xs font-medium text-[var(--text-section)] uppercase tracking-widest mb-3">
        Position Changes
      </p>
      <ResponsiveContainer width="100%" height={isFullScreen ? "100%" : 320} className={isFullScreen ? "flex-1 min-h-0" : ""}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} strokeDasharray="3 3" />
          <XAxis
            dataKey="lap"
            stroke="var(--text-muted)"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            label={{ value: "Lap", position: "insideBottomRight", fill: "var(--text-secondary)", fontSize: 11, offset: -5 }}
          />
          <YAxis
            reversed
            domain={[1, Math.max(20, drivers.length)]}
            stroke="var(--text-muted)"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            label={{ value: "Position", angle: -90, position: "insideLeft", fill: "var(--text-secondary)", fontSize: 11 }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--border-hover)", borderRadius: 6, fontSize: 12, padding: "8px 12px" }}
            labelStyle={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}
            labelFormatter={(label) => `Lap ${label}`}
            formatter={(value, name) => [`P${Number(value)}`, String(name)]}
          />

          {/* Race control events */}
          {raceControl?.map((event, i) => (
            <ReferenceArea
              key={`rc-${i}`}
              x1={event.start_lap}
              x2={event.end_lap}
              fill={RC_COLORS[event.type] ?? RC_COLORS.SC}
              fillOpacity={1}
            />
          ))}

          {/* Current lap marker */}
          {currentLap && (
            <ReferenceLine x={currentLap} stroke="#e8002d" strokeDasharray="4 4" strokeWidth={1} />
          )}

          {/* One line per driver */}
          {drivers.map((drv) => {
            const isHighlighted = drv === highlightDriver
            const color = getDriverColor(drv, driverInfo)
            return (
              <Line
                key={drv}
                type="monotone"
                dataKey={drv}
                stroke={color}
                strokeWidth={isHighlighted ? 2.5 : 1}
                strokeOpacity={isHighlighted ? 1 : highlightDriver ? 0.2 : 0.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
                style={{ cursor: onSelectDriver ? "pointer" : undefined }}
                activeDot={onSelectDriver ? {
                  onClick: () => onSelectDriver(drv),
                  r: 4,
                  stroke: color,
                  fill: color,
                  cursor: "pointer",
                } : false}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Clickable driver legend */}
      {onSelectDriver && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {drivers.map((drv) => {
            const color = getDriverColor(drv, driverInfo)
            const team = getDriverTeam(drv, driverInfo)
            const isHighlighted = drv === highlightDriver
            return (
              <button
                key={drv}
                onClick={() => onSelectDriver(drv)}
                className={`flex items-center gap-1 text-[10px] font-mono transition-opacity hover:opacity-100 ${
                  isHighlighted ? "opacity-100 font-bold" : highlightDriver ? "opacity-40" : "opacity-70"
                }`}
                title={team ?? undefined}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span style={{ color }}>{drv}</span>
                {team && isHighlighted && (
                  <span className="text-[9px] text-[var(--text-muted)] font-normal ml-0.5">{team}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
      )}
    </ChartFullScreen>
  )
}
