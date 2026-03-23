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
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ])

      // Capture the full dashboard at 2x resolution
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: "#0a0a0a",
        scale: 2,
        logging: false,
        useCORS: true,
        scrollY: -window.scrollY,
        windowHeight: dashboardRef.current.scrollHeight,
      })

      const imgData = canvas.toDataURL("image/png")
      const imgWidth = canvas.width
      const imgHeight = canvas.height

      // A4 landscape for wide dashboard layouts
      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? "landscape" : "portrait",
        unit: "px",
        format: [imgWidth / 2, imgHeight / 2],
        hotfixes: ["px_scaling"],
      })

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth / 2, imgHeight / 2)
      pdf.save(`pitwall-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error("PDF export failed:", err)
    } finally {
      setExporting(false)
    }
  }, [dashboardRef])

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleCopyLink}
        className="px-2 py-1 text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors rounded"
        title="Copy link to clipboard"
      >
        {copied ? "Copied!" : "Share"}
      </button>
      <button
        onClick={handleExport}
        disabled={exporting}
        className="px-2 py-1 text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors disabled:opacity-30 rounded"
        title="Export dashboard as PDF"
      >
        {exporting ? "Exporting..." : "Export PDF"}
      </button>
    </div>
  )
}
