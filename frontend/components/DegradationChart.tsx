"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { DegradationCurve } from "@/lib/api"

// SOFT=#e8002d  MEDIUM=#ffd700  HARD=#ffffff
const COMPOUND_COLOURS: Record<string, string> = {
  SOFT: "#e8002d",
  MEDIUM: "#ffd700",
  HARD: "#ffffff",
  INTERMEDIATE: "#39b54a",
  WET: "#0067ff",
}

interface Props {
  curves: DegradationCurve[]
  maxAge?: number
}

function buildChartData(curves: DegradationCurve[], maxAge: number) {
  return Array.from({ length: maxAge }, (_, i) => {
    const age = i + 1
    const point: Record<string, number> = { age }
    for (const curve of curves) {
      point[curve.compound] = parseFloat(
        (curve.slope * age + curve.intercept).toFixed(3)
      )
    }
    return point
  })
}

export default function DegradationChart({ curves, maxAge = 40 }: Props) {
  if (!curves.length) {
    return (
      <div className="flex items-center justify-center h-48 text-[#888]">
        No degradation data
      </div>
    )
  }

  const data = buildChartData(curves, maxAge)

  return (
    <div className="bg-[#111] border border-[#222] rounded-lg p-4">
      <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider mb-4">
        Tyre Degradation
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#222" strokeDasharray="3 3" />
          <XAxis
            dataKey="age"
            stroke="#888"
            tick={{ fill: "#888", fontSize: 11 }}
            label={{ value: "Tyre age (laps)", position: "insideBottomRight", offset: -4, fill: "#888", fontSize: 11 }}
          />
          <YAxis
            stroke="#888"
            tick={{ fill: "#888", fontSize: 11 }}
            label={{ value: "Delta (s)", angle: -90, position: "insideLeft", fill: "#888", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 4 }}
            labelStyle={{ color: "#888", fontSize: 11 }}
            itemStyle={{ fontSize: 12 }}
            formatter={(value) => [`${Number(value).toFixed(3)}s`, undefined]}
            labelFormatter={(label) => `Lap ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {curves.map((curve) => (
            <Line
              key={curve.compound}
              type="monotone"
              dataKey={curve.compound}
              stroke={COMPOUND_COLOURS[curve.compound] ?? "#888"}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
