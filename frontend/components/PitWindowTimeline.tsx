"use client"

interface PitWindowTimelineProps {
  currentLap: number
  totalLaps: number
  crossoverLap: number
  optimalLap: number
}

export default function PitWindowTimeline({
  currentLap,
  totalLaps,
  crossoverLap,
  optimalLap,
}: PitWindowTimelineProps) {
  if (totalLaps <= 0) return null

  const toPercent = (lap: number) => Math.max(0, Math.min(100, ((lap - 1) / (totalLaps - 1)) * 100))

  // Undercut window: crossover - 3 to crossover
  const undercutStart = crossoverLap < 999 ? Math.max(1, crossoverLap - 3) : null
  const undercutEnd = crossoverLap < 999 ? crossoverLap : null

  // Overcut window: crossover to crossover + 5
  const overcutStart = crossoverLap < 999 ? crossoverLap : null
  const overcutEnd = crossoverLap < 999 ? Math.min(totalLaps, crossoverLap + 5) : null

  const showOptimal = optimalLap > 0 && optimalLap < 999

  return (
    <div className="px-4 py-3 border-b border-[var(--border)]">
      <p className="text-[10px] font-medium text-[var(--text-section)] uppercase tracking-widest mb-2">
        Pit Window
      </p>

      <div className="relative h-8 bg-[var(--surface-raised)] rounded-sm overflow-hidden">
        {/* Undercut zone (green) */}
        {undercutStart !== null && undercutEnd !== null && (
          <div
            className="absolute top-0 bottom-0 bg-[#22c55e]/15 border-l border-r border-[#22c55e]/30"
            style={{
              left: `${toPercent(undercutStart)}%`,
              width: `${toPercent(undercutEnd) - toPercent(undercutStart)}%`,
            }}
          />
        )}

        {/* Overcut zone (amber) */}
        {overcutStart !== null && overcutEnd !== null && (
          <div
            className="absolute top-0 bottom-0 bg-[#f59e0b]/10 border-r border-[#f59e0b]/30"
            style={{
              left: `${toPercent(overcutStart)}%`,
              width: `${toPercent(overcutEnd) - toPercent(overcutStart)}%`,
            }}
          />
        )}

        {/* Optimal lap marker (white) */}
        {showOptimal && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/70"
            style={{ left: `${toPercent(optimalLap)}%` }}
          >
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-[var(--text-primary)] font-mono whitespace-nowrap">
              OPT L{optimalLap}
            </span>
          </div>
        )}

        {/* Current lap marker (red) */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-[#e8002d] z-10"
          style={{ left: `${toPercent(currentLap)}%` }}
        >
          <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-[#e8002d] font-mono font-bold whitespace-nowrap">
            L{currentLap}
          </span>
        </div>

        {/* Crossover marker */}
        {crossoverLap < 999 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-[#22c55e]/60 border-l border-dashed border-[#22c55e]/40"
            style={{ left: `${toPercent(crossoverLap)}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 bg-[#22c55e]/20 border border-[#22c55e]/40 rounded-sm" />
          <span className="text-[9px] text-[var(--text-muted)]">Undercut</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 bg-[#f59e0b]/15 border border-[#f59e0b]/40 rounded-sm" />
          <span className="text-[9px] text-[var(--text-muted)]">Overcut</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-[#e8002d]" />
          <span className="text-[9px] text-[var(--text-muted)]">Current</span>
        </div>
        {showOptimal && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-white/70" />
            <span className="text-[9px] text-[var(--text-muted)]">Optimal</span>
          </div>
        )}
      </div>
    </div>
  )
}
