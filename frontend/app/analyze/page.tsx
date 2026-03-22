"use client"

import { useState, useEffect, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import LiveSessionBadge from "@/components/LiveSessionBadge"
import LiveTicker from "@/components/LiveTicker"
import ThemeToggle from "@/components/ThemeToggle"
import { getSchedule } from "@/lib/api"
import type { RaceEvent } from "@/lib/api"

const INPUT_CLASS =
  "w-full bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-[var(--text-primary)] text-sm font-mono " +
  "focus:outline-none focus:border-[#e8002d] transition-colors " +
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

const SELECT_CLASS =
  "w-full bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-[var(--text-primary)] text-sm font-mono " +
  "focus:outline-none focus:border-[#e8002d] transition-colors cursor-pointer"

export default function AnalyzePage() {
  const router = useRouter()
  const [year, setYear] = useState<number>(2024)
  const [round, setRound] = useState<number>(1)
  const [driver, setDriver] = useState<string>("VER")
  const [schedule, setSchedule] = useState<RaceEvent[]>([])
  const [loadingSchedule, setLoadingSchedule] = useState<boolean>(false)

  // Fetch schedule when year changes
  useEffect(() => {
    setLoadingSchedule(true)
    getSchedule(year)
      .then((events) => {
        setSchedule(events)
        // Reset round to first race if current round doesn't exist in new schedule
        if (events.length > 0 && !events.some((e) => e.round === round)) {
          setRound(events[0].round)
        }
      })
      .catch(() => setSchedule([]))
      .finally(() => setLoadingSchedule(false))
  }, [year])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const id = `${year}-${round}-${driver.trim().toUpperCase()}`
    router.push(`/race/${id}`)
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] flex flex-col">
      {/* Nav */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-[var(--border)] shrink-0">
        <Link href="/" className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <span aria-hidden="true">&#8592;</span>
          <span className="text-[#e8002d] font-bold text-lg red-glow" aria-hidden="true">&#9646;</span>
          <span className="text-[var(--text-primary)] font-semibold text-sm tracking-tight">PITWALL</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/live" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs uppercase tracking-widest transition-colors">
            Live
          </Link>
          <LiveSessionBadge />
          <ThemeToggle />
        </nav>
      </header>

      {/* Live ticker — only shows when a session is active */}
      <LiveTicker />

      {/* Form */}
      <section className="flex-1 flex flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Analyze a Race</h1>
        <p className="text-[var(--text-muted)] text-xs mb-8">
          Select a season, grand prix, and driver to view pit strategy analysis
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
          <div>
            <label htmlFor="year" className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-1">
              Season
            </label>
            <select
              id="year"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className={SELECT_CLASS}
            >
              {Array.from({ length: new Date().getFullYear() - 2018 + 1 }, (_, i) => 2018 + i)
                .reverse()
                .map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label htmlFor="round" className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-1">
              Grand Prix
            </label>
            {loadingSchedule ? (
              <div className={`${INPUT_CLASS} text-[var(--text-muted)] flex items-center gap-2`}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#e8002d] animate-pulse" />
                Loading calendar...
              </div>
            ) : (
              <select
                id="round"
                value={round}
                onChange={(e) => setRound(parseInt(e.target.value, 10))}
                className={SELECT_CLASS}
              >
                {schedule.map((race) => (
                  <option key={race.round} value={race.round}>
                    R{race.round} — {race.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="driver" className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-1">
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
              className={`${INPUT_CLASS} uppercase placeholder:normal-case placeholder:text-[var(--text-dim)]`}
            />
          </div>

          <button
            type="submit"
            disabled={loadingSchedule || schedule.length === 0}
            className="w-full bg-[#e8002d] hover:bg-[#c0001f] disabled:bg-[#333] disabled:cursor-not-allowed
                       text-white font-bold py-3 transition-colors text-sm uppercase tracking-widest"
          >
            Analyze Strategy
          </button>
        </form>

        <p className="text-[var(--text-dim)] text-[10px] uppercase tracking-widest mt-6">
          Supports all races from 2018 to {new Date().getFullYear()}
        </p>
      </section>
    </div>
  )
}
