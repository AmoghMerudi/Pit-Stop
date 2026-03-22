import type { DriverStateResponse } from "@/lib/api"
import { COMPOUND_HEX } from "@/lib/constants"

interface TimingTowerProps {
  drivers: DriverStateResponse[]
  selectedDriver: string
  threats: string[]
}

function formatGap(gap: number, position: number): string {
  if (position <= 1 || gap === 0) return "LEADER"
  const sign = gap >= 0 ? "+" : ""
  return `${sign}${gap.toFixed(1)}`
}

export default function TimingTower({ drivers, selectedDriver, threats }: TimingTowerProps) {
  const sorted = [...drivers]
    .filter((d) => d.position > 0)
    .sort((a, b) => a.position - b.position)

  const threatSet = new Set(threats)

  return (
    <div className="h-full border-r border-[#222] overflow-y-auto">
      <div className="p-3 border-b border-[#222]">
        <p className="text-xs font-medium text-[#555] uppercase tracking-widest">
          Timing Tower
        </p>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[28px_48px_60px_16px_36px] gap-1 px-3 py-1.5 text-xs text-[#444] uppercase tracking-wider font-medium border-b border-[#222]">
        <span>P</span>
        <span>DRV</span>
        <span>GAP</span>
        <span />
        <span>AGE</span>
      </div>

      {/* Driver rows */}
      {sorted.map((d) => {
        const isSelected = d.driver === selectedDriver
        const isThreat = threatSet.has(d.driver)

        return (
          <div
            key={d.driver}
            className={`
              grid grid-cols-[28px_48px_60px_16px_36px] gap-1 px-3 py-1 items-center
              border-b border-[#1a1a1a]
              ${isThreat ? "border-l-2 border-l-[#e8002d]" : "border-l-2 border-l-transparent"}
              ${isSelected ? "bg-[#e8002d]/8" : ""}
            `}
          >
            {/* Position */}
            <span className="text-sm font-mono text-[#555]">{d.position}</span>

            {/* Driver code */}
            <span
              className={`text-sm font-mono font-bold ${
                isSelected ? "text-[#e8002d]" : "text-white"
              }`}
            >
              {d.driver}
            </span>

            {/* Gap */}
            <span className="text-sm font-mono text-[#666] truncate">
              {formatGap(d.gap_to_leader, d.position)}
            </span>

            {/* Compound dot */}
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: COMPOUND_HEX[d.compound] ?? "#555" }}
            />

            {/* Tyre age */}
            <span
              className={`text-sm font-mono ${
                d.tyre_age > 20 ? "text-white font-bold" : "text-[#666]"
              }`}
            >
              {d.tyre_age}
            </span>
          </div>
        )
      })}

      {sorted.length === 0 && (
        <div className="px-3 py-4 text-sm text-[#555]">No driver data</div>
      )}
    </div>
  )
}
