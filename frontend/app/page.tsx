"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import LiveSessionBadge from "@/components/LiveSessionBadge"

const INPUT_CLASS =
  "w-full bg-[#0a0a0a] border border-[#222] px-3 py-2.5 text-white text-sm font-mono " +
  "focus:outline-none focus:border-[#e8002d] transition-colors " +
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

const FEATURES = [
  {
    label: "Crossover Lap",
    value: "12",
    desc: "Know exactly when your current tyres become slower than a fresh set",
  },
  {
    label: "Net Delta",
    value: "+0.342s",
    desc: "See whether pitting now gains or loses time versus staying out",
  },
  {
    label: "Optimal Pit Lap",
    value: "14",
    desc: "Find the lap that minimizes total race time across all compounds",
  },
  {
    label: "Pit Loss",
    value: "24.0s",
    desc: "Circuit-specific pit lane time loss for every track on the calendar",
  },
]

const CAPABILITIES = [
  {
    title: "Degradation Analysis",
    dots: ["#e8002d", "#ffd700", "#ffffff"],
    desc: "Linear curve fitting with R\u00B2 confidence scores per compound. See how SOFT, MEDIUM, and HARD tyres degrade lap by lap.",
  },
  {
    title: "Undercut Detection",
    dots: ["#e8002d"],
    desc: "Degradation-aware threat scoring using real position data, gap analysis, and compound state for every rival on track.",
  },
  {
    title: "20+ Circuits",
    dots: ["#39b54a", "#0067ff"],
    desc: "Real pit loss data for every circuit on the calendar. Supports historical analysis back to the 2018 season.",
  },
]

export default function Home() {
  const router = useRouter()
  const [year, setYear] = useState<number>(2024)
  const [round, setRound] = useState<number>(1)
  const [driver, setDriver] = useState<string>("VER")

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const id = `${year}-${round}-${driver.trim().toUpperCase()}`
    router.push(`/race/${id}`)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Nav bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-[#222] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#e8002d] font-bold text-sm red-glow" aria-hidden="true">&#9646;</span>
          <span className="text-white font-semibold text-sm tracking-tight">PIT STOP</span>
        </div>
        <LiveSessionBadge />
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center pt-16 pb-12 px-4">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-[#e8002d] text-5xl font-bold red-glow" aria-hidden="true">&#9646;</span>
          <h1 className="text-5xl font-bold text-white tracking-tight">PIT STOP</h1>
        </div>
        <p className="text-[#888] text-sm text-center max-w-md leading-relaxed mb-2">
          Real-time pit window analysis powered by telemetry data from every F1 session since 2018
        </p>
        <p className="text-[#555] text-[10px] tracking-widest uppercase mb-10">
          Tyre Degradation &middot; Pit Strategy &middot; Undercut Threats
        </p>

        {/* Inline form */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl border border-[#222] p-4">
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="w-full sm:w-24">
              <label htmlFor="year" className="block text-[10px] font-medium text-[#555] uppercase tracking-widest mb-1">
                Year
              </label>
              <input
                id="year"
                type="number"
                min={2018}
                max={new Date().getFullYear()}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                required
                className={INPUT_CLASS}
              />
            </div>

            <div className="w-full sm:w-20">
              <label htmlFor="round" className="block text-[10px] font-medium text-[#555] uppercase tracking-widest mb-1">
                Round
              </label>
              <input
                id="round"
                type="number"
                min={1}
                max={24}
                value={round}
                onChange={(e) => setRound(parseInt(e.target.value, 10))}
                required
                className={INPUT_CLASS}
              />
            </div>

            <div className="w-full sm:w-24">
              <label htmlFor="driver" className="block text-[10px] font-medium text-[#555] uppercase tracking-widest mb-1">
                Driver
              </label>
              <input
                id="driver"
                type="text"
                maxLength={3}
                value={driver}
                onChange={(e) => setDriver(e.target.value.toUpperCase())}
                placeholder="VER"
                required
                className={`${INPUT_CLASS} uppercase placeholder:normal-case placeholder:text-[#333]`}
              />
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto bg-[#e8002d] hover:bg-[#c0001f] text-white font-bold px-6 py-2.5
                         transition-colors text-xs uppercase tracking-widest whitespace-nowrap"
            >
              Analyse Strategy
            </button>
          </div>
        </form>

        <Link
          href="/live"
          className="mt-3 text-[#555] hover:text-white text-[10px] uppercase tracking-widest transition-colors"
        >
          or <span className="border-b border-[#555] hover:border-white pb-px">Live Race Analysis</span>
        </Link>
      </section>

      {/* Feature tiles */}
      <section className="border-t border-[#222]">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.label} className="p-5 border-b border-r border-[#222] last:border-r-0">
              <p className="text-[10px] font-medium text-[#555] uppercase tracking-widest mb-2">
                {f.label}
              </p>
              <p className="text-2xl font-mono font-bold text-white mb-2">{f.value}</p>
              <p className="text-[#666] text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section className="border-t border-[#222]">
        <div className="grid grid-cols-1 md:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <div key={c.title} className="p-5 border-b border-r border-[#222] last:border-r-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-1">
                  {c.dots.map((color, i) => (
                    <span
                      key={i}
                      className="compound-dot"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <p className="text-[10px] font-medium text-[#888] uppercase tracking-widest">
                  {c.title}
                </p>
              </div>
              <p className="text-[#666] text-xs leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#222] px-4 py-4 flex items-center justify-between">
        <p className="text-[#333] text-[10px] tracking-wider uppercase">
          Data sourced from FastF1 &amp; OpenF1 &middot; 2018–{new Date().getFullYear()} seasons
        </p>
        <p className="text-[#333] text-[10px] tracking-wider uppercase">
          Built for F1 strategy analysis
        </p>
      </footer>
    </div>
  )
}
