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
import type { PositionHistoryPoint, RaceControlEvent } from "@/lib/api"

const DRIVER_COLORS: Record<string, string> = {
  VER: "#3671C6", PER: "#3671C6",
  HAM: "#27F4D2", RUS: "#27F4D2",
  LEC: "#E8002D", SAI: "#E8002D", HAM2: "#E8002D",
  NOR: "#FF8000", PIA: "#FF8000",
  ALO: "#229971", STR: "#229971",
  GAS: "#2293D1", OCO: "#2293D1", DOO: "#2293D1",
  TSU: "#6692FF", RIC: "#6692FF", LAW: "#6692FF",
  BOT: "#52E252", ZHO: "#52E252",
  MAG: "#B6BABD", HUL: "#B6BABD", BEA: "#B6BABD",
  ALB: "#64C4FF", SAR: "#64C4FF", COL: "#64C4FF",
  BOR: "#1E6176", HAD: "#1E6176",
  ANT: "#E8002D", KIM: "#E8002D",
}

const FALLBACK_COLOR = "#555"

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
  onSelectDriver?: (driver: string) => void
}

export default function PositionChart({ data, highlightDriver, raceControl, currentLap, onSelectDriver }: PositionChartProps) {
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
    <div className="p-4 border-b border-[var(--border)]">
      <p className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest mb-3">
        Position Changes
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
          <XAxis
            dataKey="lap"
            stroke="#333"
            tick={{ fill: "#555", fontSize: 10 }}
            label={{ value: "Lap", position: "insideBottomRight", fill: "#555", fontSize: 10, offset: -5 }}
          />
          <YAxis
            reversed
            domain={[1, Math.max(20, drivers.length)]}
            stroke="#333"
            tick={{ fill: "#555", fontSize: 10 }}
            label={{ value: "Position", angle: -90, position: "insideLeft", fill: "#555", fontSize: 10 }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: 4, fontSize: 11 }}
            labelStyle={{ color: "#888" }}
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
            const color = DRIVER_COLORS[drv] ?? FALLBACK_COLOR
            return (
              <Line
                key={drv}
                type="monotone"
                dataKey={drv}
                stroke={isHighlighted ? color : color}
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
            const color = DRIVER_COLORS[drv] ?? FALLBACK_COLOR
            const isHighlighted = drv === highlightDriver
            return (
              <button
                key={drv}
                onClick={() => onSelectDriver(drv)}
                className={`flex items-center gap-1 text-[10px] font-mono transition-opacity hover:opacity-100 ${
                  isHighlighted ? "opacity-100 font-bold" : highlightDriver ? "opacity-40" : "opacity-70"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span style={{ color }}>{drv}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
