"use client"

import type { WeatherDataPoint } from "@/lib/api"
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
    <div className="p-4 border-b border-[#222]">
      <p className="text-[10px] font-medium text-[#555] uppercase tracking-widest mb-3">
        Weather Conditions
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis
            dataKey="lap"
            tick={{ fill: "#555", fontSize: 10 }}
            axisLine={{ stroke: "#333" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#555", fontSize: 10 }}
            axisLine={{ stroke: "#333" }}
            tickLine={false}
            domain={["auto", "auto"]}
            unit="°"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111",
              border: "1px solid #333",
              borderRadius: 4,
              fontSize: 11,
            }}
            labelStyle={{ color: "#888" }}
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
          <span className="text-[10px] text-[#666]">Track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#06b6d4] inline-block" />
          <span className="text-[10px] text-[#666]">Air</span>
        </div>
        {rainRanges.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 bg-[#3b82f6]/20 inline-block" />
            <span className="text-[10px] text-[#666]">Rain</span>
          </div>
        )}
      </div>
    </div>
  )
}
