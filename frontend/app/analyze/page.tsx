"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import LiveSessionBadge from "@/components/LiveSessionBadge"

const INPUT_CLASS =
  "w-full bg-[#0a0a0a] border border-[#222] px-3 py-2.5 text-white text-sm font-mono " +
  "focus:outline-none focus:border-[#e8002d] transition-colors " +
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

export default function AnalyzePage() {
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
      {/* Nav */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-[#222] shrink-0">
        <Link href="/" className="flex items-center gap-2 text-[#555] hover:text-white transition-colors">
          <span aria-hidden="true">&#8592;</span>
          <span className="text-[#e8002d] font-bold text-lg red-glow" aria-hidden="true">&#9646;</span>
          <span className="text-white font-semibold text-sm tracking-tight">PIT STOP</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/live" className="text-[#888] hover:text-white text-xs uppercase tracking-widest transition-colors">
            Live
          </Link>
          <LiveSessionBadge />
        </nav>
      </header>

      {/* Form */}
      <section className="flex-1 flex flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Analyze a Race</h1>
        <p className="text-[#555] text-xs mb-8">
          Enter a year, round, and driver code to view pit strategy analysis
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
          <div>
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

          <div>
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

          <div>
            <label htmlFor="driver" className="block text-[10px] font-medium text-[#555] uppercase tracking-widest mb-1">
              Driver Code
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
            className="w-full bg-[#e8002d] hover:bg-[#c0001f] text-white font-bold py-3
                       transition-colors text-sm uppercase tracking-widest"
          >
            Analyze Strategy
          </button>
        </form>

        <p className="text-[#333] text-[10px] uppercase tracking-widest mt-6">
          Supports all races from 2018 to {new Date().getFullYear()}
        </p>
      </section>
    </div>
  )
}
