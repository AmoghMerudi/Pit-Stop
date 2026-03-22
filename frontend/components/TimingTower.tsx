import type { DriverStateResponse } from "@/lib/api"
import { COMPOUND_HEX } from "@/lib/constants"

interface TimingTowerProps {
  drivers: DriverStateResponse[]
  selectedDriver: string
  threats: string[]
  onSelectDriver?: (driver: string) => void
}

function formatGap(gap: number, position: number): string {
  if (position === 1) return "LEADER"
  if (position <= 0) return "—"
  if (gap === 0) return "—"
  const sign = gap >= 0 ? "+" : ""
  return `${sign}${gap.toFixed(1)}`
}

const STATUS_STYLE: Record<string, { text: string; color: string }> = {
  PIT: { text: "PIT", color: "#f97316" },
  DNF: { text: "DNF", color: "#ef4444" },
  DSQ: { text: "DSQ", color: "#ef4444" },
  RETIRED: { text: "DNF", color: "#ef4444" },
}

export default function TimingTower({ drivers, selectedDriver, threats, onSelectDriver }: TimingTowerProps) {
  const sorted = [...drivers].sort((a, b) => {
    // DNF/DSQ/RETIRED go to the bottom, sorted by position or name
    const aOut = a.status === "DNF" || a.status === "DSQ" || a.status === "RETIRED"
    const bOut = b.status === "DNF" || b.status === "DSQ" || b.status === "RETIRED"
    if (aOut && !bOut) return 1
    if (!aOut && bOut) return -1
    if (a.position > 0 && b.position > 0) return a.position - b.position
    if (a.position > 0) return -1
    if (b.position > 0) return 1
    return 0
  })

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
        const statusInfo = d.status ? STATUS_STYLE[d.status] : null
        const isOut = d.status === "DNF" || d.status === "DSQ" || d.status === "RETIRED"

        return (
          <div
            key={d.driver}
            onClick={() => onSelectDriver?.(d.driver)}
            className={`
              grid grid-cols-[28px_48px_60px_16px_36px] gap-1 px-3 py-1 items-center relative
              border-b border-[#1a1a1a]
              ${onSelectDriver ? "cursor-pointer hover:bg-[#1a1a1a]" : ""}
              ${isThreat && !isOut ? "border-l-2 border-l-[#e8002d]" : "border-l-2 border-l-transparent"}
              ${isSelected ? "bg-[#e8002d]/8" : ""}
              ${isOut ? "opacity-40" : ""}
            `}
          >
            {/* Position */}
            <span className="text-sm font-mono text-[#555]">
              {isOut ? "—" : d.position}
            </span>

            {/* Driver code */}
            <span
              className={`text-sm font-mono font-bold ${
                isSelected ? "text-[#e8002d]" : "text-white"
              }`}
            >
              {d.driver}
            </span>

            {/* Gap / Status badge */}
            {statusInfo ? (
              <span
                className="text-[10px] font-mono font-bold uppercase tracking-wider"
                style={{ color: statusInfo.color }}
              >
                {statusInfo.text}
              </span>
            ) : (
              <span className="text-sm font-mono text-[#666] truncate">
                {formatGap(d.gap_to_leader, d.position)}
              </span>
            )}

            {/* Compound dot */}
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: isOut ? "#333" : (COMPOUND_HEX[d.compound] ?? "#555") }}
            />

            {/* Tyre age */}
            <span
              className={`text-sm font-mono ${
                !isOut && d.tyre_age > 20 ? "text-white font-bold" : "text-[#666]"
              }`}
            >
              {isOut ? "—" : d.tyre_age}
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
