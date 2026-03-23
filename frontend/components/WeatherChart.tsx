"use client"

import type { WeatherDataPoint } from "@/lib/api"
import ChartFullScreen from "./ChartFullScreen"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts"

interface Props {
  data: WeatherDataPoint[]
  currentLap: number | null
}

export default function WeatherChart({ data, currentLap }: Props) {
  if (!data.length) return null

  // Find rainfall lap ranges for shading
  const rainRanges: { start: number; end: number }[] = []
  let rangeStart: number | null = null
  for (const point of data) {
    if (point.rainfall && rangeStart === null) {
      rangeStart = point.lap
    } else if (!point.rainfall && rangeStart !== null) {
      rainRanges.push({ start: rangeStart, end: point.lap - 1 })
      rangeStart = null
    }
  }
  if (rangeStart !== null) {
    rainRanges.push({ start: rangeStart, end: data[data.length - 1].lap })
  }

  return (
    <ChartFullScreen title="Weather Conditions">
      {(isFullScreen) => (
    <div className={`p-4 ${isFullScreen ? "" : "border-b border-[var(--border)]"} ${isFullScreen ? "h-full flex flex-col" : ""}`}>
      <p className="text-xs font-medium text-[var(--text-section)] uppercase tracking-widest mb-3">
        Weather Conditions
      </p>
      <ResponsiveContainer width="100%" height={isFullScreen ? "100%" : 180} className={isFullScreen ? "flex-1 min-h-0" : ""}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis
            dataKey="lap"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            axisLine={{ stroke: "var(--text-muted)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            axisLine={{ stroke: "var(--text-muted)" }}
            tickLine={false}
            domain={["auto", "auto"]}
            unit="°"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface-raised)",
              border: "1px solid var(--border-hover)",
              borderRadius: 6,
              fontSize: 12,
              padding: "8px 12px",
            }}
            labelStyle={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}
            formatter={(value, name) => [
              `${Number(value).toFixed(1)}°C`,
              name === "track_temp" ? "Track" : name === "air_temp" ? "Air" : String(name),
            ]}
            labelFormatter={(lap) => `Lap ${lap}`}
          />
          {rainRanges.map((r, i) => (
            <ReferenceArea
              key={i}
              x1={r.start}
              x2={r.end}
              fill="#3b82f6"
              fillOpacity={0.08}
              strokeOpacity={0}
            />
          ))}
          {currentLap !== null && (
            <ReferenceLine
              x={currentLap}
              stroke="#e8002d"
              strokeDasharray="4 2"
              strokeWidth={1}
            />
          )}
          <Line
            type="monotone"
            dataKey="track_temp"
            stroke="#f97316"
            strokeWidth={1.5}
            dot={false}
            name="track_temp"
          />
          <Line
            type="monotone"
            dataKey="air_temp"
            stroke="#06b6d4"
            strokeWidth={1.5}
            dot={false}
            name="air_temp"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#f97316] inline-block" />
          <span className="text-[10px] text-[var(--text-muted)]">Track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#06b6d4] inline-block" />
          <span className="text-[10px] text-[var(--text-muted)]">Air</span>
        </div>
        {rainRanges.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 bg-[#3b82f6]/20 inline-block" />
            <span className="text-[10px] text-[var(--text-muted)]">Rain</span>
          </div>
        )}
      </div>
    </div>
      )}
    </ChartFullScreen>
  )
}
