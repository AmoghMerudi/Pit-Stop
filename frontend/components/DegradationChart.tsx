"use client"

import { useState } from "react"
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
import type { DegradationCurve, DriverCurveResult } from "@/lib/api"
import { COMPOUND_HEX } from "@/lib/constants"
import ChartFullScreen from "./ChartFullScreen"

interface Props {
  curves: DegradationCurve[]
  maxAge?: number
  currentTyreAge?: number
}

type CurveShape = Pick<DegradationCurve, "slope" | "intercept" | "coeffs">

function evalCurve(curve: CurveShape, age: number): number {
  if (curve.coeffs && curve.coeffs.length > 0) {
    let result = 0
    for (let i = 0; i < curve.coeffs.length; i++) {
      result = result * age + curve.coeffs[i]
    }
    return Math.max(0, result)
  }
  return Math.max(0, curve.slope * age + curve.intercept)
}

function buildChartData(
  curves: DegradationCurve[],
  maxAge: number,
  driverOverrides: Record<string, DriverCurveResult>,
) {
  return Array.from({ length: maxAge }, (_, i) => {
    const age = i + 1
    const point: Record<string, number> = { age }
    for (const curve of curves) {
      const override = driverOverrides[curve.compound]
      const source: CurveShape = override ?? curve
      point[curve.compound] = parseFloat(evalCurve(source, age).toFixed(3))
    }
    return point
  })
}

function getActiveCurve(
  curve: DegradationCurve,
  driverOverrides: Record<string, DriverCurveResult>,
): { cliff_lap?: number | null; cliff_confidence?: "high" | "low" | null; isPopulationFallback: boolean } {
  const override = driverOverrides[curve.compound]
  if (override) {
    return { cliff_lap: override.cliff_lap, cliff_confidence: override.cliff_confidence, isPopulationFallback: false }
  }
  return { cliff_lap: curve.cliff_lap, cliff_confidence: curve.cliff_confidence, isPopulationFallback: false }
}

export default function DegradationChart({ curves, maxAge = 40, currentTyreAge }: Props) {
  const [driverSelections, setDriverSelections] = useState<Record<string, string>>({})

  if (!curves.length) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-xs">
        No degradation data
      </div>
    )
  }

  const hasAnyPerDriver = curves.some((c) => c.per_driver && Object.keys(c.per_driver).length > 0)

  const driverOverrides: Record<string, DriverCurveResult> = {}
  const populationFallbacks = new Set<string>()

  for (const curve of curves) {
    const selectedDriver = driverSelections[curve.compound]
    if (selectedDriver && selectedDriver !== "_all") {
      const driverCurve = curve.per_driver?.[selectedDriver]
      if (driverCurve) {
        driverOverrides[curve.compound] = driverCurve
      } else {
        populationFallbacks.add(curve.compound)
      }
    }
  }

  const data = buildChartData(curves, maxAge, driverOverrides)

  return (
    <ChartFullScreen title="Tyre Degradation">
      {(isFullScreen) => (
    <div className={`p-4 ${isFullScreen ? "" : "border-b border-[var(--border)]"} ${isFullScreen ? "h-full flex flex-col" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-[var(--text-section)] uppercase tracking-widest">
          Tyre Degradation
        </p>
        <div className="flex flex-wrap gap-3">
          {curves.map((curve) => (
            <div key={curve.compound} className="flex items-center gap-1.5 text-[10px]">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: COMPOUND_HEX[curve.compound] ?? "#888" }}
              />
              <span className="text-[var(--text-muted)] font-medium">{curve.compound}</span>
              <span className="font-mono text-[var(--text-muted)]">
                {(() => {
                  const override = driverOverrides[curve.compound]
                  const r2 = override ? override.r2 : curve.r2
                  return r2 > 0 ? `r\u00B2=${r2.toFixed(2)}` : ""
                })()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-driver selector */}
      {hasAnyPerDriver && (
        <div className="flex flex-wrap gap-2 mb-3">
          {curves.map((curve) => {
            const drivers = curve.per_driver ? Object.keys(curve.per_driver).sort() : []
            if (drivers.length === 0) return null
            const selected = driverSelections[curve.compound] ?? "_all"
            return (
              <div key={curve.compound} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: COMPOUND_HEX[curve.compound] ?? "#888" }}
                />
                <select
                  value={selected}
                  onChange={(e) =>
                    setDriverSelections((prev) => ({ ...prev, [curve.compound]: e.target.value }))
                  }
                  className="bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] text-[10px] font-mono px-1.5 py-0.5 rounded focus:outline-none focus:border-[var(--border-hover)]"
                >
                  <option value="_all">All drivers</option>
                  {drivers.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}

      {/* Population fallback notices */}
      {populationFallbacks.size > 0 && (
        <div className="mb-2">
          {Array.from(populationFallbacks).map((compound) => (
            <p key={compound} className="text-[9px] text-[var(--text-dim)] italic">
              {compound}: Using population curve (insufficient data for{" "}
              {driverSelections[compound]})
            </p>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={isFullScreen ? "100%" : 280} className={isFullScreen ? "flex-1 min-h-0" : ""}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis
            dataKey="age"
            stroke="var(--text-muted)"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            label={{ value: "Tyre age (laps)", position: "insideBottomRight", offset: -4, fill: "var(--text-secondary)", fontSize: 11 }}
          />
          <YAxis
            stroke="var(--text-muted)"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            label={{ value: "Delta (s)", angle: -90, position: "insideLeft", fill: "var(--text-secondary)", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border-hover)", borderRadius: 6, fontSize: 12, padding: "8px 12px" }}
            labelStyle={{ color: "var(--text-primary)", fontSize: 11, fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ fontSize: 12 }}
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

          {/* Cliff markers per compound */}
          {curves.map((curve) => {
            const active = getActiveCurve(curve, driverOverrides)
            const conf = active.cliff_confidence
            const lap = active.cliff_lap
            if (!conf || !lap || lap >= 60) return null

            if (conf === "high") {
              return (
                <ReferenceLine
                  key={`cliff-${curve.compound}`}
                  x={lap}
                  stroke={COMPOUND_HEX[curve.compound] ?? "#888"}
                  strokeWidth={1.5}
                  label={{
                    value: `Cliff: lap ${lap}`,
                    position: "top",
                    fill: COMPOUND_HEX[curve.compound] ?? "#888",
                    fontSize: 9,
                  }}
                />
              )
            }

            return (
              <ReferenceLine
                key={`cliff-${curve.compound}`}
                x={lap}
                stroke={COMPOUND_HEX[curve.compound] ?? "#888"}
                strokeDasharray="4 4"
                strokeWidth={1}
                strokeOpacity={0.4}
                label={{
                  value: `Cliff: lap ${lap} (?)`,
                  position: "top",
                  fill: "#888",
                  fontSize: 9,
                }}
              />
            )
          })}

          {curves.map((curve) => {
            const isFallback = populationFallbacks.has(curve.compound)
            return (
              <Line
                key={curve.compound}
                type="monotone"
                dataKey={curve.compound}
                stroke={COMPOUND_HEX[curve.compound] ?? "#888"}
                strokeWidth={isFallback ? 1 : 2}
                strokeDasharray={isFallback ? "6 3" : undefined}
                strokeOpacity={isFallback ? 0.5 : 1}
                dot={false}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Low-confidence tooltip notice — shown below chart when any compound has "(?)" */}
      {curves.some((c) => {
        const active = getActiveCurve(c, driverOverrides)
        return active.cliff_confidence === "low"
      }) && (
        <p className="text-[9px] text-[var(--text-muted)] mt-1 italic">
          (?) Cliff prediction has low confidence — limited post-cliff data for this
          driver/compound.
        </p>
      )}
    </div>
      )}
    </ChartFullScreen>
  )
}
