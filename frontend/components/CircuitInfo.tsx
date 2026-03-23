import type { DegradationCurve } from "@/lib/api"
import { COMPOUND_HEX } from "@/lib/constants"

interface CircuitInfoProps {
  circuit: string | null
  pitLoss: number
  curves: DegradationCurve[]
  curveSource?: string
}

function r2Color(r2: number): string {
  if (r2 < 0.5) return "text-[#e8002d]"
  if (r2 < 0.7) return "text-[#ffd700]"
  return "text-[var(--text-muted)]"
}

function formatCurveSource(source: string): string {
  if (source === "benchmark") return "Benchmark (generic)"
  const match = source.match(/prior_race:(\d+)\/(\d+)/)
  if (match) return `${match[1]} R${match[2]} (prior race)`
  return source
}

export default function CircuitInfo({ circuit, pitLoss, curves, curveSource }: CircuitInfoProps) {
  return (
    <div className="p-3">
      <p className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest mb-2">
        Curve Info
      </p>

      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] mb-2">
        {circuit && (
          <span className="text-[var(--text-primary)] font-medium">{circuit}</span>
        )}
        <span className="font-mono">{pitLoss.toFixed(1)}s pit loss</span>
        {curveSource && (
          <>
            <span className="text-[var(--text-muted)]">|</span>
            <span>{formatCurveSource(curveSource)}</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {curves.map((curve) => (
          <div key={curve.compound} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: COMPOUND_HEX[curve.compound] ?? "#888" }}
            />
            <span className="text-[var(--text-muted)] font-medium">{curve.compound}</span>
            <span className={`font-mono ${r2Color(curve.r2)}`}>
              {curve.r2 > 0 ? `r\u00B2=${curve.r2.toFixed(2)}` : "benchmark"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
