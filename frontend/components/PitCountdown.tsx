interface PitCountdownProps {
  crossoverLap: number
  recommendPit: boolean
  reason: string
  cliffConfidence?: "high" | "low" | null
}

function getStatus(crossoverLap: number, recommendPit: boolean) {
  if (recommendPit || (crossoverLap <= 3 && crossoverLap < 999)) {
    return { color: "bg-[#e8002d]", textColor: "text-[#e8002d]", label: "PIT NOW", pulse: true }
  }
  if (crossoverLap <= 6 && crossoverLap < 999) {
    return { color: "bg-[#ffd700]", textColor: "text-[#ffd700]", label: "PIT WINDOW APPROACHING", pulse: false }
  }
  return { color: "bg-[#00cc44]", textColor: "text-[#00cc44]", label: "STAY OUT", pulse: false }
}

function formatWindow(crossoverLap: number, cliffConfidence?: "high" | "low" | null): string | null {
  if (crossoverLap <= 0 || crossoverLap >= 999) return null
  if (cliffConfidence === "low") {
    const lo = Math.max(1, crossoverLap - 2)
    const hi = crossoverLap + 2
    return `${lo}\u2013${hi}`
  }
  return `${crossoverLap}`
}

export default function PitCountdown({
  crossoverLap,
  recommendPit,
  reason,
  cliffConfidence,
}: PitCountdownProps) {
  const status = getStatus(crossoverLap, recommendPit)
  const windowText = formatWindow(crossoverLap, cliffConfidence)
  const isUncertain = cliffConfidence === "low"

  return (
    <div className="p-4 border-b border-[var(--border)]">
      <div className="flex items-center gap-3 mb-2">
        <span
          className={`inline-block w-3 h-3 rounded-full ${status.color} ${status.pulse ? "animate-pulse" : ""}`}
        />
        <span className={`text-xs font-bold uppercase tracking-widest ${status.textColor}`}>
          {status.label}
        </span>
        {windowText && (
          <span className="text-[var(--text-primary)] font-mono font-bold text-lg ml-auto flex items-center gap-1.5">
            {windowText}
            <span className="text-[var(--text-muted)] text-xs font-normal">
              laps{isUncertain ? " (uncertain)" : ""}
            </span>
            {isUncertain && (
              <span
                className="text-[#f59e0b] text-sm cursor-help"
                title="Cliff lap estimate is uncertain for this driver on this compound."
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
            )}
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--text-muted)]">{reason}</p>
    </div>
  )
}
