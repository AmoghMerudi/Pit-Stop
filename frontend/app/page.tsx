"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function Home() {
  const router = useRouter()
  const [year, setYear] = useState<number>(2023)
  const [round, setRound] = useState<number>(1)
  const [driver, setDriver] = useState<string>("VER")

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const id = `${year}-${round}-${driver.trim().toUpperCase()}`
    router.push(`/race/${id}`)
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-[#e8002d] text-3xl font-bold tracking-tight">&#9646;</span>
            <h1 className="text-4xl font-bold text-white tracking-tight">Pit Stop</h1>
          </div>
          <p className="text-[#888] text-sm tracking-wide uppercase">
            F1 Strategy Optimizer — Tyre Degradation &amp; Pit Window Analysis
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#111] border border-[#222] rounded-xl p-8 space-y-6"
        >
          <div className="space-y-1">
            <label
              htmlFor="year"
              className="block text-xs font-medium text-[#888] uppercase tracking-wider"
            >
              Season Year
            </label>
            <input
              id="year"
              type="number"
              min={2018}
              max={new Date().getFullYear()}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              required
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white text-sm
                         focus:outline-none focus:border-[#e8002d] transition-colors
                         [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <p className="text-[#555] text-xs">2018 – {new Date().getFullYear()}</p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="round"
              className="block text-xs font-medium text-[#888] uppercase tracking-wider"
            >
              Race Round
            </label>
            <input
              id="round"
              type="number"
              min={1}
              max={24}
              value={round}
              onChange={(e) => setRound(parseInt(e.target.value, 10))}
              required
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white text-sm
                         focus:outline-none focus:border-[#e8002d] transition-colors
                         [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <p className="text-[#555] text-xs">1 – 24</p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="driver"
              className="block text-xs font-medium text-[#888] uppercase tracking-wider"
            >
              Driver Code
            </label>
            <input
              id="driver"
              type="text"
              maxLength={3}
              value={driver}
              onChange={(e) => setDriver(e.target.value.toUpperCase())}
              placeholder="e.g. VER, HAM, LEC"
              required
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white text-sm
                         uppercase placeholder:text-[#333] focus:outline-none focus:border-[#e8002d] transition-colors"
            />
            <p className="text-[#555] text-xs">3-letter driver abbreviation (uppercase)</p>
          </div>

          <button
            type="submit"
            className="w-full bg-[#e8002d] hover:bg-[#c0001f] text-white font-semibold rounded-lg px-4 py-3
                       transition-colors text-sm uppercase tracking-wider"
          >
            Analyse Strategy
          </button>

          <Link
            href="/live"
            className="block w-full text-center border border-[#333] hover:border-[#555] text-[#888]
                       hover:text-white font-medium rounded-lg px-4 py-3 transition-colors text-sm
                       uppercase tracking-wider"
          >
            Live Race Analysis
          </Link>
        </form>

        <p className="text-center text-[#555] text-xs mt-6">
          Data sourced from FastF1 &amp; OpenF1
        </p>
      </div>
    </div>
  )
}
