"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import type { DegradationCurve } from "@/lib/api"
import { COMPOUND_HEX } from "@/lib/constants"

interface Props {
  curves: DegradationCurve[]
  maxAge?: number
  currentTyreAge?: number
}

function evalCurve(curve: DegradationCurve, age: number): number {
  if (curve.coeffs && curve.coeffs.length > 0) {
    // Polynomial: coeffs[0]*age^n + coeffs[1]*age^(n-1) + ... + coeffs[n]
    let result = 0
    for (let i = 0; i < curve.coeffs.length; i++) {
      result = result * age + curve.coeffs[i]
    }
    return Math.max(0, result)
  }
  // Fallback to linear
  return Math.max(0, curve.slope * age + curve.intercept)
}

function buildChartData(curves: DegradationCurve[], maxAge: number) {
  return Array.from({ length: maxAge }, (_, i) => {
    const age = i + 1
    const point: Record<string, number> = { age }
    for (const curve of curves) {
      point[curve.compound] = parseFloat(evalCurve(curve, age).toFixed(3))
    }
    return point
  })
}

export default function DegradationChart({ curves, maxAge = 40, currentTyreAge }: Props) {
  if (!curves.length) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-xs">
        No degradation data
      </div>
    )
  }

  const data = buildChartData(curves, maxAge)

  return (
    <div className="p-4 border-b border-[var(--border)]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest">
          Tyre Degradation
        </p>
        {/* Custom legend with R² */}
        <div className="flex flex-wrap gap-3">
          {curves.map((curve) => (
            <div key={curve.compound} className="flex items-center gap-1.5 text-[10px]">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: COMPOUND_HEX[curve.compound] ?? "#888" }}
              />
              <span className="text-[var(--text-muted)] font-medium">{curve.compound}</span>
              <span className="font-mono text-[var(--text-muted)]">
                {curve.r2 > 0 ? `r\u00B2=${curve.r2.toFixed(2)}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1a1a1a" />
          <XAxis
            dataKey="age"
            stroke="#555"
            tick={{ fill: "#555", fontSize: 10 }}
            label={{ value: "Tyre age (laps)", position: "insideBottomRight", offset: -4, fill: "#555", fontSize: 10 }}
          />
          <YAxis
            stroke="#555"
            tick={{ fill: "#555", fontSize: 10 }}
            label={{ value: "Delta (s)", angle: -90, position: "insideLeft", fill: "#555", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 4, fontSize: 11 }}
            labelStyle={{ color: "#888", fontSize: 10 }}
            itemStyle={{ fontSize: 11 }}
            formatter={(value) => [`${Number(value).toFixed(3)}s`, undefined]}
            labelFormatter={(label) => `Lap ${label}`}
          />
          {currentTyreAge && currentTyreAge > 0 && (
            <ReferenceLine
              x={currentTyreAge}
              stroke="#e8002d"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: "NOW", position: "top", fill: "#e8002d", fontSize: 10 }}
            />
          )}
          {curves.map((curve) => (
            <Line
              key={curve.compound}
              type="monotone"
              dataKey={curve.compound}
              stroke={COMPOUND_HEX[curve.compound] ?? "#888"}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
