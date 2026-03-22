import type { SectorTime } from "@/lib/api"

interface Props {
  sectors: SectorTime[]
  selectedDriver: string
}

const SECTOR_COLORS: Record<string, string> = {
  purple: "#a855f7",
  green: "#22c55e",
  yellow: "#ffd700",
}

function formatSector(val: number | null): string {
  if (val === null) return "--"
  return val.toFixed(3)
}

export default function SectorTimesTable({ sectors, selectedDriver }: Props) {
  if (!sectors.length) {
    return (
      <div className="flex items-center justify-center h-24 text-[#555] text-xs">
        No sector data
      </div>
    )
  }

  // Sort by total sector time
  const sorted = [...sectors].sort((a, b) => {
    const totalA = (a.s1 ?? 999) + (a.s2 ?? 999) + (a.s3 ?? 999)
    const totalB = (b.s1 ?? 999) + (b.s2 ?? 999) + (b.s3 ?? 999)
    return totalA - totalB
  })

  return (
    <div className="p-4 border-b border-[#222]">
      <p className="text-[10px] font-medium text-[#555] uppercase tracking-widest mb-3">
        Sector Analysis
      </p>
      <div className="grid grid-cols-[40px_48px_1fr_1fr_1fr_64px] gap-1 text-[10px] text-[#444] uppercase tracking-wider font-medium mb-1 px-1">
        <span>P</span>
        <span>DRV</span>
        <span>S1</span>
        <span>S2</span>
        <span>S3</span>
        <span className="text-right">LAP</span>
      </div>
      {sorted.map((s, i) => {
        const total = s.s1 !== null && s.s2 !== null && s.s3 !== null
          ? (s.s1 + s.s2 + s.s3).toFixed(3)
          : "--"
        const isSelected = s.driver === selectedDriver

        return (
          <div
            key={s.driver}
            className={`grid grid-cols-[40px_48px_1fr_1fr_1fr_64px] gap-1 items-center px-1 py-0.5
              ${isSelected ? "bg-[#e8002d]/8 border-l-2 border-l-[#e8002d]" : "border-l-2 border-l-transparent"}`}
          >
            <span className="text-xs font-mono text-[#555]">{i + 1}</span>
            <span className={`text-xs font-mono font-bold ${isSelected ? "text-[#e8002d]" : "text-white"}`}>
              {s.driver}
            </span>
            <span className="text-xs font-mono font-bold" style={{ color: SECTOR_COLORS[s.s1_color] }}>
              {formatSector(s.s1)}
            </span>
            <span className="text-xs font-mono font-bold" style={{ color: SECTOR_COLORS[s.s2_color] }}>
              {formatSector(s.s2)}
            </span>
            <span className="text-xs font-mono font-bold" style={{ color: SECTOR_COLORS[s.s3_color] }}>
              {formatSector(s.s3)}
            </span>
            <span className="text-xs font-mono text-[#888] text-right">{total}</span>
          </div>
        )
      })}
    </div>
  )
}
