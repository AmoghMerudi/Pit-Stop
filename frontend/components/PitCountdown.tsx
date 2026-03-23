interface PitCountdownProps {
  crossoverLap: number
  recommendPit: boolean
  reason: string
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

export default function PitCountdown({ crossoverLap, recommendPit, reason }: PitCountdownProps) {
  const status = getStatus(crossoverLap, recommendPit)

  return (
    <div className="p-4 border-b border-[var(--border)]">
      <div className="flex items-center gap-3 mb-2">
        <span
          className={`inline-block w-3 h-3 rounded-full ${status.color} ${status.pulse ? "animate-pulse" : ""}`}
        />
        <span className={`text-xs font-bold uppercase tracking-widest ${status.textColor}`}>
          {status.label}
        </span>
        {crossoverLap > 0 && crossoverLap < 999 && (
          <span className="text-[var(--text-primary)] font-mono font-bold text-lg ml-auto">
            {crossoverLap}
            <span className="text-[var(--text-muted)] text-xs font-normal ml-1">laps</span>
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--text-muted)]">{reason}</p>
    </div>
  )
}
