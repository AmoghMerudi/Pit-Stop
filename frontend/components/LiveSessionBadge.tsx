"use client"

import { useEffect, useState } from "react"
import { getLiveSession } from "@/lib/api"
import type { LiveSessionInfo } from "@/lib/api"

function sessionLabel(session: LiveSessionInfo): string {
  const cat = session.session_category
  if (cat === "qualifying") {
    const seg = session.qualifying_segment
    return seg ? `Q${seg}` : "Qualifying"
  }
  if (cat === "practice") {
    const match = session.session_type?.match(/(\d+)/)
    return match ? `FP${match[1]}` : "Practice"
  }
  if (cat === "sprint") return "Sprint"
  if (cat === "sprint_qualifying") return "Sprint Q"
  return "Live"
}

export default function LiveSessionBadge() {
  const [session, setSession] = useState<LiveSessionInfo | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let mounted = true

    async function check() {
      try {
        const s = await getLiveSession()
        if (mounted) { setSession(s); setChecked(true) }
      } catch {
        if (mounted) { setSession(null); setChecked(true) }
      }
    }

    check()
    const interval = setInterval(check, 10_000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  if (!checked) return null

  if (!session?.active) {
    return <span className="text-[var(--text-muted)] text-xs">No live session</span>
  }

  return (
    <span className="flex items-center gap-1.5 bg-[#e8002d] text-white text-xs font-bold px-2 py-1 rounded">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
      {sessionLabel(session)}
    </span>
  )
}
