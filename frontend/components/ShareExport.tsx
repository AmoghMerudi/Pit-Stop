"use client"

import { useState, useCallback, type RefObject } from "react"

interface ShareExportProps {
  dashboardRef: RefObject<HTMLDivElement | null>
}

export default function ShareExport({ dashboardRef }: ShareExportProps) {
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input")
      input.value = window.location.href
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  const handleExport = useCallback(async () => {
    if (!dashboardRef.current) return
    setExporting(true)
    try {
      const { default: html2canvas } = await import("html2canvas")
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: "#0a0a0a",
        scale: 2,
        logging: false,
      })
      const link = document.createElement("a")
      link.download = `pitwall-${Date.now()}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch {
      // html2canvas not available or failed
    } finally {
      setExporting(false)
    }
  }, [dashboardRef])

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleCopyLink}
        className="px-2 py-1 text-[10px] font-mono text-[var(--text-dim)] hover:text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors"
        title="Copy link to clipboard"
      >
        {copied ? "Copied!" : "Share"}
      </button>
      <button
        onClick={handleExport}
        disabled={exporting}
        className="px-2 py-1 text-[10px] font-mono text-[var(--text-dim)] hover:text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors disabled:opacity-30"
        title="Export dashboard as PNG"
      >
        {exporting ? "..." : "Export"}
      </button>
    </div>
  )
}
