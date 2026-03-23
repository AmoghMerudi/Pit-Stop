"use client"

import type { GapEvolutionPoint, RaceControlEvent } from "@/lib/api"
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
  Legend,
} from "recharts"

interface Props {
  data: GapEvolutionPoint[]
  currentLap: number | null
  driver: string
  raceControl?: RaceControlEvent[]
}

const PALETTE = ["#e8002d", "#06b6d4", "#f97316", "#a855f7", "#22c55e"]

const RC_COLORS: Record<string, { fill: string; label: string }> = {
  SC: { fill: "#fbbf24", label: "SC" },
  VSC: { fill: "#fbbf24", label: "VSC" },
  RED: { fill: "#ef4444", label: "RED" },
}

export default function GapChart({ data, currentLap, driver, raceControl }: Props) {
  if (!data.length) return null

  // Collect all rival codes from the data
  const rivalSet = new Set<string>()
  for (const point of data) {
    for (const key of Object.keys(point.gaps)) {
      rivalSet.add(key)
    }
  }
  const rivals = Array.from(rivalSet).slice(0, 5)

  if (!rivals.length) return null

  // Flatten data for recharts
  const chartData = data.map((point) => ({
    lap: point.lap,
    ...point.gaps,
  }))

  const rcEvents = raceControl ?? []

  return (
    <div className="p-4 border-b border-[var(--border)]">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest">
          Gap Evolution
        </p>
        {rcEvents.length > 0 && (
          <div className="flex items-center gap-3">
            {[...new Set(rcEvents.map((e) => e.type))].map((type) => (
              <div key={type} className="flex items-center gap-1">
                <span
                  className="w-3 h-2 inline-block rounded-sm"
                  style={{ backgroundColor: RC_COLORS[type]?.fill ?? "#555", opacity: 0.3 }}
                />
                <span className="text-[9px] text-[var(--text-muted)]">{RC_COLORS[type]?.label ?? type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-[9px] text-[var(--text-muted)] mb-3">
        vs {driver} — positive = {driver} ahead
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
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
            unit="s"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111",
              border: "1px solid #333",
              borderRadius: 4,
              fontSize: 11,
            }}
            labelStyle={{ color: "#888" }}
            formatter={(value, name) => {
              const v = Number(value)
              return [`${v > 0 ? "+" : ""}${v.toFixed(1)}s`, String(name)]
            }}
            labelFormatter={(lap) => `Lap ${lap}`}
          />
          {/* Race control event shading */}
          {rcEvents.map((evt, i) => (
            <ReferenceArea
              key={`rc-${i}`}
              x1={evt.start_lap}
              x2={evt.end_lap}
              fill={RC_COLORS[evt.type]?.fill ?? "#555"}
              fillOpacity={evt.type === "RED" ? 0.15 : 0.1}
              strokeOpacity={0}
              label={{
                value: RC_COLORS[evt.type]?.label ?? evt.type,
                position: "insideTopRight",
                fill: RC_COLORS[evt.type]?.fill ?? "#555",
                fontSize: 9,
                fontWeight: "bold",
                opacity: 0.6,
              }}
            />
          ))}
          <ReferenceLine
            y={0}
            stroke="#fff"
            strokeDasharray="4 2"
            strokeWidth={1}
            strokeOpacity={0.3}
          />
          {currentLap !== null && (
            <ReferenceLine
              x={currentLap}
              stroke="#e8002d"
              strokeDasharray="4 2"
              strokeWidth={1}
            />
          )}
          {rivals.map((rival, i) => (
            <Line
              key={rival}
              type="monotone"
              dataKey={rival}
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          ))}
          <Legend
            verticalAlign="bottom"
            height={24}
            iconType="plainline"
            iconSize={12}
            wrapperStyle={{ fontSize: 10, color: "#888" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
