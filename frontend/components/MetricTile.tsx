interface MetricTileProps {
  label: string
  value: string | number
  unit?: string
  status?: "green" | "amber" | "red" | "neutral"
}

const STATUS_COLOR: Record<string, string> = {
  green: "text-[#00cc44]",
  amber: "text-[#ffd700]",
  red: "text-[#e8002d]",
  neutral: "text-white",
}

export default function MetricTile({ label, value, unit, status = "neutral" }: MetricTileProps) {
  return (
    <div className="p-3 border-r border-[#222] last:border-r-0">
      <p className="text-[10px] font-medium text-[#555] uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className={`text-2xl font-mono font-bold ${STATUS_COLOR[status]}`}>
        {value}
        {unit && <span className="text-xs text-[#555] ml-1 font-normal">{unit}</span>}
      </p>
    </div>
  )
}
