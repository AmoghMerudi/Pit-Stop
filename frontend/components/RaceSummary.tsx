"use client"

import { useState } from "react"
import type { RaceSummary as RaceSummaryType } from "@/lib/api"
import { COMPOUND_HEX } from "@/lib/constants"

interface RaceSummaryProps {
  summary: RaceSummaryType
}

export default function RaceSummary({ summary }: RaceSummaryProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-[var(--border)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--surface-raised)] transition-colors"
      >
        <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-widest">
          Race Summary
        </span>
        <span className="text-[var(--text-dim)] text-xs">{expanded ? "\u2212" : "+"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Key stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Overtakes" value={summary.total_overtakes} />
            <StatCard label="Leader Changes" value={summary.leader_changes} />
            <StatCard label="Pit Stops" value={summary.total_pit_stops} />
            <StatCard label="Safety Cars" value={summary.safety_car_periods} />
            <StatCard label="Red Flags" value={summary.red_flags} />
            <StatCard label="Strategies" value={summary.unique_strategies} />
          </div>

          {/* Highlights */}
          <div className="space-y-2">
            {summary.fastest_lap && (
              <Highlight
                label="Fastest Lap"
                content={`${summary.fastest_lap.driver} \u2014 ${summary.fastest_lap.time.toFixed(3)}s on lap ${summary.fastest_lap.lap}`}
                accent="#a855f7"
              />
            )}

            {summary.biggest_gainer && (
              <Highlight
                label="Biggest Gainer"
                content={`${summary.biggest_gainer.driver} \u2014 P${summary.biggest_gainer.grid} \u2192 P${summary.biggest_gainer.finish} (+${summary.biggest_gainer.positions_gained})`}
                accent="#22c55e"
              />
            )}

            {summary.most_overtakes && (
              <Highlight
                label="Most Overtakes"
                content={`${summary.most_overtakes.driver} \u2014 ${summary.most_overtakes.overtakes} passes`}
                accent="#3b82f6"
              />
            )}

            {summary.best_pit_stop && (
              <Highlight
                label="Best Pit Stop"
                content={`${summary.best_pit_stop.driver} \u2014 ${summary.best_pit_stop.pit_duration}s (L${summary.best_pit_stop.lap})`}
                accent="#22c55e"
                compound={summary.best_pit_stop.compound_after}
              />
            )}

            {summary.worst_pit_stop && (
              <Highlight
                label="Slowest Pit Stop"
                content={`${summary.worst_pit_stop.driver} \u2014 ${summary.worst_pit_stop.pit_duration}s (L${summary.worst_pit_stop.lap})`}
                accent="#e8002d"
                compound={summary.worst_pit_stop.compound_after}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--surface-raised)] border border-[var(--border)] px-3 py-2">
      <p className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
      <p className="text-[var(--text-primary)] font-mono font-bold text-lg">{value}</p>
    </div>
  )
}

function Highlight({
  label,
  content,
  accent,
  compound,
}: {
  label: string
  content: string
  accent: string
  compound?: string
}) {
  return (
    <div className="flex items-center gap-2 text-xs border-l-2 pl-2 py-1" style={{ borderColor: accent }}>
      <span className="text-[var(--text-muted)] text-[9px] uppercase w-24 shrink-0">{label}</span>
      <span className="text-[var(--text-primary)] font-mono">{content}</span>
      {compound && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: COMPOUND_HEX[compound] ?? "#555" }}
        />
      )}
    </div>
  )
}
