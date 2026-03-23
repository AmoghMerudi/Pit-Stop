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
  neutral: "text-[var(--text-primary)]",
}

export default function MetricTile({ label, value, unit, status = "neutral" }: MetricTileProps) {
  return (
    <div className="p-3 border-r border-[var(--border)] last:border-r-0">
      <p className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className={`text-2xl font-mono font-bold ${STATUS_COLOR[status]}`}>
        {value}
        {unit && <span className="text-xs text-[var(--text-muted)] ml-1 font-normal">{unit}</span>}
      </p>
    </div>
  )
}
