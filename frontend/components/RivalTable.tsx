interface DriverRow {
  driver: string
  compound: string
  tyre_age: number
  position: number
  is_threat: boolean
}

interface Props {
  rows: DriverRow[]
}

const COMPOUND_COLOURS: Record<string, string> = {
  SOFT: "text-[#e8002d]",
  MEDIUM: "text-[#ffd700]",
  HARD: "text-white",
  INTERMEDIATE: "text-[#39b54a]",
  WET: "text-[#0067ff]",
}

export default function RivalTable({ rows }: Props) {
  const sorted = [...rows].sort((a, b) => a.position - b.position)

  return (
    <div className="bg-[#111] border border-[#222] rounded-lg p-4">
      <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider mb-3">
        Rival States
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[#888] text-left border-b border-[#222]">
            <th className="pb-2 pr-4 font-medium">Pos</th>
            <th className="pb-2 pr-4 font-medium">Driver</th>
            <th className="pb-2 pr-4 font-medium">Compound</th>
            <th className="pb-2 font-medium">Tyre age</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.driver}
              className={`border-l-2 ${row.is_threat ? "border-l-[#e8002d]" : "border-l-transparent"} `}
            >
              <td className="py-1.5 pr-4 text-[#888]">{row.position}</td>
              <td className="py-1.5 pr-4 text-white font-medium">{row.driver}</td>
              <td className={`py-1.5 pr-4 font-medium ${COMPOUND_COLOURS[row.compound] ?? "text-[#888]"}`}>
                {row.compound}
              </td>
              <td className={`py-1.5 ${row.tyre_age > 25 ? "font-bold text-white" : "text-[#888]"}`}>
                {row.tyre_age}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
