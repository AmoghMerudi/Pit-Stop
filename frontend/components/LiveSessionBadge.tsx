"use client"

import { useEffect, useState } from "react"
import { getLiveLaps } from "@/lib/api"

export default function LiveSessionBadge() {
  const [active, setActive] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true

    async function check() {
      try {
        const laps = await getLiveLaps()
        if (mounted) setActive(laps.length > 0)
      } catch {
        if (mounted) setActive(false)
      }
    }

    check()
    const interval = setInterval(check, 10_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  if (active === null) return null

  return active ? (
    <span className="flex items-center gap-1.5 bg-[#e8002d] text-white text-xs font-bold px-2 py-1 rounded">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
      Live
    </span>
  ) : (
    <span className="text-[var(--text-muted)] text-xs">No live session</span>
  )
}
