"use client"

import { useEffect, useCallback, useState } from "react"

interface ChartFullScreenProps {
  title: string
  children: (isFullScreen: boolean) => React.ReactNode
}

export default function ChartFullScreen({ title, children }: ChartFullScreenProps) {
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, close])

  return (
    <>
      {/* Inline view with expand button */}
      <div className="relative group">
        <button
          onClick={() => setOpen(true)}
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity
            bg-[var(--surface-raised)] border border-[var(--border)] hover:border-[var(--border-hover)]
            text-[var(--text-secondary)] hover:text-[var(--text-primary)]
            px-1.5 py-1 text-[10px] font-mono rounded"
          title="Full screen"
          aria-label="View full screen"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
          </svg>
        </button>
        {children(false)}
      </div>

      {/* Fullscreen modal */}
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-[var(--surface)] flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Header bar */}
          <div className="h-10 flex items-center justify-between px-4 border-b border-[var(--border)] shrink-0">
            <span className="text-[var(--text-section)] text-xs font-mono uppercase tracking-widest">
              {title}
            </span>
            <button
              onClick={close}
              className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                text-xs font-mono transition-colors"
            >
              Close
              <kbd className="text-[9px] px-1 py-0.5 border border-[var(--border)] rounded text-[var(--text-muted)]">
                ESC
              </kbd>
            </button>
          </div>
          {/* Chart content — fills remaining space */}
          <div className="flex-1 overflow-auto p-4">
            {children(true)}
          </div>
        </div>
      )}
    </>
  )
}
