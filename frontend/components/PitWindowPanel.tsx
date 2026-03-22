import type { StrategyResponse } from "@/lib/api"

interface Props {
  strategy: StrategyResponse
}

function netDeltaLabel(delta: number): string {
  const sign = delta >= 0 ? "+" : ""
  return `${sign}${delta.toFixed(3)}s`
}

function recommendationColour(strategy: StrategyResponse): string {
  if (strategy.recommend_pit) return "text-[#00cc44]"
  if (strategy.crossover_lap <= 6) return "text-[#ffd700]"
  return "text-[#888]"
}

export default function PitWindowPanel({ strategy }: Props) {
  const colour = recommendationColour(strategy)

  return (
    <div className="bg-[#111] border border-[#222] rounded-lg p-4 space-y-3">
      <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider">
        Pit Window — {strategy.driver}
      </h2>

      <p className={`text-lg font-semibold ${colour}`}>{strategy.reason}</p>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-[#888]">Crossover lap</span>
          <p className="text-white font-medium">{strategy.crossover_lap >= 999 ? "—" : strategy.crossover_lap}</p>
        </div>
        <div>
          <span className="text-[#888]">Net delta</span>
          <p className={`font-medium ${strategy.net_delta >= 0 ? "text-[#00cc44]" : "text-[#e8002d]"}`}>
            {netDeltaLabel(strategy.net_delta)}
          </p>
        </div>
        <div>
          <span className="text-[#888]">Optimal lap</span>
          <p className="text-white font-medium">{strategy.optimal_lap <= 0 || strategy.optimal_lap >= 999 ? "—" : strategy.optimal_lap}</p>
        </div>
        <div>
          <span className="text-[#888]">Undercut threats</span>
          <p className="text-white font-medium">
            {strategy.undercut_threats.length
              ? strategy.undercut_threats.map(t => t.driver).join(", ")
              : "None"}
          </p>
        </div>
      </div>
    </div>
  )
}
