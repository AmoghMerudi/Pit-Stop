import Link from "next/link"
import LiveSessionBadge from "@/components/LiveSessionBadge"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Nav */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-[#222] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#e8002d] font-bold text-lg red-glow" aria-hidden="true">&#9646;</span>
          <span className="text-white font-semibold text-sm tracking-tight">PITWALL</span>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/analyze" className="text-[#888] hover:text-white text-xs uppercase tracking-widest transition-colors">
            Analyze
          </Link>
          <Link href="/live" className="text-[#888] hover:text-white text-xs uppercase tracking-widest transition-colors">
            Live
          </Link>
          <LiveSessionBadge />
        </nav>
      </header>

      {/* Pitwall Grid */}
      <section className="flex-1 grid grid-cols-[minmax(0,2fr)_minmax(0,7fr)_minmax(0,3fr)] grid-rows-[auto_1fr_auto] gap-px bg-[#222] p-px">

        {/* ──── TOP BAR: Race Info Banner ──── */}
        <div className="col-span-full bg-[#0a0a0a] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#39b54a] animate-pulse" />
              <span className="text-[#39b54a] text-[10px] font-bold uppercase tracking-widest">Track Status: Green</span>
            </div>
            <span className="text-[#333] text-[10px]">|</span>
            <span className="text-[#555] text-[10px] uppercase tracking-widest font-mono">LAP 42 / 63</span>
            <span className="text-[#333] text-[10px]">|</span>
            <span className="text-[#555] text-[10px] uppercase tracking-widest font-mono">AIR 31°C &middot; TRACK 48°C</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#555] text-[10px] uppercase tracking-widest font-mono">DRS ENABLED</span>
            <span className="text-[#333] text-[10px]">|</span>
            <span className="text-[#e8002d] text-[10px] font-bold uppercase tracking-widest font-mono">STINT 2 &middot; MEDIUM L14</span>
          </div>
        </div>

        {/* ──── LEFT PANEL: Timing Tower ──── */}
        <div className="col-span-1 bg-[#0a0a0a] p-3 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#555] text-xs uppercase tracking-widest font-bold">Timing Tower</span>
            <span className="text-[#333] text-xs font-mono">INT</span>
          </div>

          <div className="flex flex-col gap-px">
            {[
              { pos: 1,  name: "VER", time: "1:31.742", gap: "LEADER",  compound: "#e8002d", tyreAge: "L14", s: ["purple","green","purple"] },
              { pos: 2,  name: "NOR", time: "1:31.998", gap: "+1.243",  compound: "#e8002d", tyreAge: "L12", s: ["green","purple","green"] },
              { pos: 3,  name: "LEC", time: "1:32.108", gap: "+3.891",  compound: "#ffd700", tyreAge: "L22", s: ["yellow","green","yellow"] },
              { pos: 4,  name: "HAM", time: "1:32.344", gap: "+5.102",  compound: "#ffd700", tyreAge: "L22", s: ["green","yellow","green"] },
              { pos: 5,  name: "PIA", time: "1:32.511", gap: "+7.845",  compound: "#e8002d", tyreAge: "L14", s: ["yellow","green","purple"] },
              { pos: 6,  name: "SAI", time: "1:32.677", gap: "+9.331",  compound: "#ffffff", tyreAge: "L28", s: ["green","yellow","green"] },
              { pos: 7,  name: "RUS", time: "1:32.812", gap: "+11.204", compound: "#ffd700", tyreAge: "L18", s: ["yellow","green","yellow"] },
              { pos: 8,  name: "ANT", time: "1:32.945", gap: "+13.556", compound: "#e8002d", tyreAge: "L12", s: ["green","green","purple"] },
              { pos: 9,  name: "ALO", time: "1:33.001", gap: "+14.667", compound: "#ffffff", tyreAge: "L32", s: ["green","yellow","green"] },
              { pos: 10, name: "GAS", time: "1:33.244", gap: "+18.903", compound: "#ffd700", tyreAge: "L20", s: ["yellow","yellow","yellow"] },
              { pos: 11, name: "TSU", time: "1:33.398", gap: "+21.556", compound: "#ffffff", tyreAge: "L30", s: ["green","green","yellow"] },
              { pos: 12, name: "HAD", time: "1:33.512", gap: "+24.112", compound: "#ffd700", tyreAge: "L24", s: ["yellow","green","green"] },
              { pos: 13, name: "HUL", time: "1:33.601", gap: "+26.445", compound: "#ffffff", tyreAge: "L34", s: ["green","yellow","yellow"] },
              { pos: 14, name: "BOR", time: "1:33.720", gap: "+28.334", compound: "#e8002d", tyreAge: "L10", s: ["purple","green","yellow"] },
              { pos: 15, name: "LAW", time: "1:33.890", gap: "+31.002", compound: "#ffd700", tyreAge: "L22", s: ["yellow","yellow","green"] },
              { pos: 16, name: "DOO", time: "1:33.977", gap: "+34.891", compound: "#ffffff", tyreAge: "L36", s: ["green","green","yellow"] },
              { pos: 17, name: "STR", time: "1:34.102", gap: "+38.220", compound: "#ffd700", tyreAge: "L26", s: ["yellow","yellow","yellow"] },
              { pos: 18, name: "BEA", time: "1:34.234", gap: "+41.667", compound: "#ffffff", tyreAge: "L38", s: ["green","yellow","green"] },
              { pos: 19, name: "OCO", time: "1:34.401", gap: "+45.112", compound: "#ffd700", tyreAge: "L20", s: ["yellow","green","yellow"] },
              { pos: 20, name: "COL", time: "1:34.556", gap: "+48.891", compound: "#ffffff", tyreAge: "L40", s: ["green","yellow","yellow"] },
              { pos: 21, name: "DRU", time: "1:34.712", gap: "+52.334", compound: "#ffd700", tyreAge: "L24", s: ["yellow","green","green"] },
              { pos: 22, name: "MAL", time: "1:34.889", gap: "+55.778", compound: "#ffffff", tyreAge: "L42", s: ["yellow","yellow","green"] },
            ].map((d) => (
              <div key={d.pos} className={`flex items-center gap-1.5 py-1 px-1.5 ${d.pos === 1 ? "bg-[#1a1a1a]" : ""}`}>
                <span className="text-[#555] font-mono text-xs w-4 text-right">{d.pos}</span>
                <span className="text-white font-mono text-xs font-bold w-7">{d.name}</span>
                <div className="flex gap-px">
                  {d.s.map((sec, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5"
                      style={{
                        backgroundColor:
                          sec === "purple" ? "#a855f7" :
                          sec === "green" ? "#39b54a" :
                          "#ffd700"
                      }}
                    />
                  ))}
                </div>
                <span className="text-[#888] font-mono text-xs flex-1 text-right">{d.time}</span>
                <span className={`font-mono text-xs w-14 text-right ${d.gap === "LEADER" ? "text-white font-bold" : parseFloat(d.gap) < 2 ? "text-[#e8002d]" : "text-[#555]"}`}>
                  {d.gap === "LEADER" ? "---" : d.gap}
                </span>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.compound }} />
                <span className="text-[#444] font-mono text-xs w-5 text-right">{d.tyreAge}</span>
              </div>
            ))}
          </div>

          {/* DRS indicator */}
          <div className="mt-2 pt-2 border-t border-[#1a1a1a] flex items-center justify-between">
            <span className="text-xs text-[#39b54a] font-mono font-bold tracking-wider">DRS</span>
            <span className="text-xs text-[#555] font-mono">P2 within 1.000s of P1</span>
          </div>
        </div>

        {/* ──── CENTER PANEL: Hero + CTAs ──── */}
        <div className="col-span-1 bg-[#0a0a0a] flex flex-col items-center justify-center p-8">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-5 mb-4">
              <span className="text-[#e8002d] text-7xl font-bold red-glow leading-none" aria-hidden="true">&#9646;</span>
              <div>
                <h1 className="text-6xl font-bold text-white tracking-tight leading-none">PITWALL</h1>
                <p className="text-[#555] text-xs tracking-[0.3em] uppercase mt-1">F1 Strategy Engine</p>
              </div>
            </div>

            <p className="text-[#888] text-sm text-center max-w-md leading-relaxed mb-8">
              Pit window analysis powered by real telemetry data. Degradation curves, crossover laps,
              undercut threats, and optimal pit strategy — for every race since 2018.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-10">
              <Link
                href="/analyze"
                className="bg-[#e8002d] hover:bg-[#c0001f] text-white font-bold px-8 py-3
                           transition-colors text-sm uppercase tracking-widest"
              >
                Analyze a Race
              </Link>
              <Link
                href="/live"
                className="border border-[#333] hover:border-[#e8002d] text-[#888] hover:text-white
                           font-bold px-8 py-3 transition-colors text-sm uppercase tracking-widest"
              >
                Live Session
              </Link>
            </div>

            {/* Mini stats row */}
            <div className="grid grid-cols-4 gap-px bg-[#222] w-full max-w-lg">
              {[
                { value: "2018+", label: "Seasons" },
                { value: "20+", label: "Circuits" },
                { value: "5", label: "Compounds" },
                { value: "15s", label: "Live Refresh" },
              ].map((s) => (
                <div key={s.label} className="bg-[#0a0a0a] py-3 text-center">
                  <p className="text-white font-mono font-bold text-sm">{s.value}</p>
                  <p className="text-[#555] text-[9px] uppercase tracking-widest">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ──── RIGHT PANEL: Telemetry + Strategy ──── */}
        <div className="col-span-1 bg-[#0a0a0a] p-4 flex flex-col gap-4">

          {/* Tyre Degradation Chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#555] text-[10px] uppercase tracking-widest font-bold">Tyre Degradation</span>
              <span className="text-[#333] text-[9px] font-mono">ms/lap</span>
            </div>
            <svg viewBox="0 0 200 100" className="w-full" aria-hidden="true">
              {/* Grid lines */}
              <line x1="0" y1="25" x2="200" y2="25" stroke="#1a1a1a" strokeWidth="0.5" />
              <line x1="0" y1="50" x2="200" y2="50" stroke="#1a1a1a" strokeWidth="0.5" />
              <line x1="0" y1="75" x2="200" y2="75" stroke="#1a1a1a" strokeWidth="0.5" />
              {/* SOFT — steep degradation (red) */}
              <polyline
                fill="none"
                stroke="#e8002d"
                strokeWidth="1.5"
                points="0,85 15,82 30,78 45,72 60,64 75,55 90,44 105,35 120,28 135,22 150,18"
              />
              {/* MEDIUM — moderate degradation (yellow) */}
              <polyline
                fill="none"
                stroke="#ffd700"
                strokeWidth="1.5"
                points="0,90 20,88 40,85 60,81 80,76 100,70 120,63 140,56 160,49 180,43 200,38"
              />
              {/* HARD — gentle degradation (white) */}
              <polyline
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeOpacity="0.5"
                points="0,92 25,91 50,89 75,86 100,82 125,78 150,73 175,68 200,63"
              />
              {/* Compound labels */}
              <text x="152" y="16" fill="#e8002d" fontSize="7" fontFamily="monospace">SOFT</text>
              <text x="170" y="36" fill="#ffd700" fontSize="7" fontFamily="monospace">MED</text>
              <text x="170" y="61" fill="#888" fontSize="7" fontFamily="monospace">HARD</text>
              {/* Axis labels */}
              <text x="0" y="98" fill="#333" fontSize="6" fontFamily="monospace">L1</text>
              <text x="95" y="98" fill="#333" fontSize="6" fontFamily="monospace">L15</text>
              <text x="185" y="98" fill="#333" fontSize="6" fontFamily="monospace">L30</text>
            </svg>
          </div>

          {/* Pit Window */}
          <div className="border-t border-[#1a1a1a] pt-3">
            <span className="text-[#555] text-[10px] uppercase tracking-widest font-bold">Pit Window</span>
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#888] font-mono text-[10px]">Optimal stop</span>
                <span className="text-[#39b54a] font-mono text-[11px] font-bold">LAP 28-32</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#888] font-mono text-[10px]">Crossover lap</span>
                <span className="text-white font-mono text-[11px] font-bold">LAP 26</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#888] font-mono text-[10px]">Pit loss</span>
                <span className="text-[#e8002d] font-mono text-[11px] font-bold">22.4s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#888] font-mono text-[10px]">Undercut threat</span>
                <span className="text-[#ffd700] font-mono text-[11px] font-bold">HIGH</span>
              </div>
            </div>
          </div>

          {/* Sector Timing Grid */}
          <div className="border-t border-[#1a1a1a] pt-3">
            <span className="text-[#555] text-[10px] uppercase tracking-widest font-bold">Sector Analysis</span>
            <svg viewBox="0 0 200 80" className="w-full mt-2" aria-hidden="true">
              {/* Header */}
              <text x="40" y="10" fill="#555" fontSize="7" fontFamily="monospace" textAnchor="middle">S1</text>
              <text x="90" y="10" fill="#555" fontSize="7" fontFamily="monospace" textAnchor="middle">S2</text>
              <text x="140" y="10" fill="#555" fontSize="7" fontFamily="monospace" textAnchor="middle">S3</text>
              <text x="180" y="10" fill="#555" fontSize="7" fontFamily="monospace" textAnchor="middle">LAP</text>

              {/* VER row */}
              <text x="5" y="24" fill="#888" fontSize="7" fontFamily="monospace">VER</text>
              <rect x="25" y="16" width="30" height="10" fill="#a855f7" rx="1" />
              <rect x="75" y="16" width="30" height="10" fill="#39b54a" rx="1" />
              <rect x="125" y="16" width="30" height="10" fill="#a855f7" rx="1" />
              <text x="40" y="24" fill="white" fontSize="6" fontFamily="monospace" textAnchor="middle">28.4</text>
              <text x="90" y="24" fill="white" fontSize="6" fontFamily="monospace" textAnchor="middle">33.1</text>
              <text x="140" y="24" fill="white" fontSize="6" fontFamily="monospace" textAnchor="middle">30.2</text>
              <text x="180" y="24" fill="#a855f7" fontSize="6" fontFamily="monospace" textAnchor="middle">1:31.7</text>

              {/* NOR row */}
              <text x="5" y="39" fill="#888" fontSize="7" fontFamily="monospace">NOR</text>
              <rect x="25" y="31" width="30" height="10" fill="#39b54a" rx="1" />
              <rect x="75" y="31" width="30" height="10" fill="#a855f7" rx="1" />
              <rect x="125" y="31" width="30" height="10" fill="#39b54a" rx="1" />
              <text x="40" y="39" fill="white" fontSize="6" fontFamily="monospace" textAnchor="middle">28.6</text>
              <text x="90" y="39" fill="white" fontSize="6" fontFamily="monospace" textAnchor="middle">32.9</text>
              <text x="140" y="39" fill="white" fontSize="6" fontFamily="monospace" textAnchor="middle">30.5</text>
              <text x="180" y="39" fill="white" fontSize="6" fontFamily="monospace" textAnchor="middle">1:32.0</text>

              {/* LEC row */}
              <text x="5" y="54" fill="#888" fontSize="7" fontFamily="monospace">LEC</text>
              <rect x="25" y="46" width="30" height="10" fill="#ffd700" rx="1" />
              <rect x="75" y="46" width="30" height="10" fill="#39b54a" rx="1" />
              <rect x="125" y="46" width="30" height="10" fill="#ffd700" rx="1" />
              <text x="40" y="54" fill="black" fontSize="6" fontFamily="monospace" textAnchor="middle">28.9</text>
              <text x="90" y="54" fill="white" fontSize="6" fontFamily="monospace" textAnchor="middle">33.0</text>
              <text x="140" y="54" fill="black" fontSize="6" fontFamily="monospace" textAnchor="middle">30.2</text>
              <text x="180" y="54" fill="white" fontSize="6" fontFamily="monospace" textAnchor="middle">1:32.1</text>

              {/* HAM row */}
              <text x="5" y="69" fill="#888" fontSize="7" fontFamily="monospace">HAM</text>
              <rect x="25" y="61" width="30" height="10" fill="#39b54a" rx="1" />
              <rect x="75" y="61" width="30" height="10" fill="#ffd700" rx="1" />
              <rect x="125" y="61" width="30" height="10" fill="#39b54a" rx="1" />
              <text x="40" y="69" fill="white" fontSize="6" fontFamily="monospace" textAnchor="middle">28.7</text>
              <text x="90" y="69" fill="black" fontSize="6" fontFamily="monospace" textAnchor="middle">33.3</text>
              <text x="140" y="69" fill="white" fontSize="6" fontFamily="monospace" textAnchor="middle">30.3</text>
              <text x="180" y="69" fill="white" fontSize="6" fontFamily="monospace" textAnchor="middle">1:32.3</text>
            </svg>
          </div>

          {/* Strategy Summary */}
          <div className="border-t border-[#1a1a1a] pt-3">
            <span className="text-[#555] text-[10px] uppercase tracking-widest font-bold">Strategy</span>
            <div className="mt-2 flex flex-col gap-2">
              {/* Stint bar visualization */}
              <div className="flex items-center gap-1">
                <span className="text-[#444] font-mono text-[9px] w-8">VER</span>
                <div className="flex-1 flex h-3 gap-px">
                  <div className="bg-[#e8002d] flex-[18]" title="SOFT L1-L18" />
                  <div className="bg-[#ffd700] flex-[24]" title="MEDIUM L19-L42" />
                  <div className="bg-[#333] flex-[21] border border-dashed border-[#555]" title="Projected L43-L63" />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[#444] font-mono text-[9px] w-8">NOR</span>
                <div className="flex-1 flex h-3 gap-px">
                  <div className="bg-[#e8002d] flex-[14]" title="SOFT L1-L14" />
                  <div className="bg-[#ffd700] flex-[28]" title="MEDIUM L15-L42" />
                  <div className="bg-[#333] flex-[21] border border-dashed border-[#555]" title="Projected L43-L63" />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[#444] font-mono text-[9px] w-8">LEC</span>
                <div className="flex-1 flex h-3 gap-px">
                  <div className="bg-[#ffffff] flex-[12]" title="HARD L1-L12" />
                  <div className="bg-[#ffd700] flex-[30]" title="MEDIUM L13-L42" />
                  <div className="bg-[#333] flex-[21] border border-dashed border-[#555]" title="Projected L43-L63" />
                </div>
              </div>

              {/* Stint legend */}
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#e8002d]" />
                  <span className="text-[#555] text-[8px] font-mono">SOFT</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#ffd700]" />
                  <span className="text-[#555] text-[8px] font-mono">MED</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span className="text-[#555] text-[8px] font-mono">HARD</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 border border-dashed border-[#555] bg-[#333]" />
                  <span className="text-[#555] text-[8px] font-mono">PROJ</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ──── BOTTOM BAR: Feature panels ──── */}
        <div className="col-span-1 bg-[#0a0a0a] p-5">
          <div className="flex gap-1.5 mb-3">
            <span className="compound-dot" style={{ backgroundColor: "#e8002d" }} />
            <span className="compound-dot" style={{ backgroundColor: "#ffd700" }} />
            <span className="compound-dot" style={{ backgroundColor: "#ffffff" }} />
          </div>
          <h3 className="text-white text-sm font-semibold mb-2">Tyre Degradation</h3>
          <p className="text-[#666] text-xs leading-relaxed">
            Quadratic curve fitting with R&#178; confidence scores. Captures tyre cliff behavior that linear models miss.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[#e8002d] font-mono text-[10px] font-bold">+0.087s/lap</span>
            <span className="text-[#555] text-[10px] font-mono">avg deg SOFT</span>
          </div>
        </div>

        <div className="col-span-1 bg-[#0a0a0a] p-5">
          <div className="flex gap-1.5 mb-3">
            <span className="compound-dot" style={{ backgroundColor: "#e8002d" }} />
          </div>
          <h3 className="text-white text-sm font-semibold mb-2">Undercut Detection</h3>
          <p className="text-[#666] text-xs leading-relaxed">
            Threat scoring using position data, gap analysis, and degradation incentives for every rival on track.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[#ffd700] font-mono text-[10px] font-bold">THREAT: HIGH</span>
            <span className="text-[#555] text-[10px] font-mono">NOR &rarr; VER gap 1.243s</span>
          </div>
        </div>

        <div className="col-span-1 bg-[#0a0a0a] p-5">
          <div className="flex gap-1.5 mb-3">
            <span className="compound-dot" style={{ backgroundColor: "#39b54a" }} />
            <span className="compound-dot" style={{ backgroundColor: "#0067ff" }} />
          </div>
          <h3 className="text-white text-sm font-semibold mb-2">20+ Circuits</h3>
          <p className="text-[#666] text-xs leading-relaxed">
            Circuit-specific pit loss data and historical analysis spanning every season from 2018 to today.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[#39b54a] font-mono text-[10px] font-bold">22.4s</span>
            <span className="text-[#555] text-[10px] font-mono">avg pit loss this circuit</span>
          </div>
        </div>

      </section>

      {/* Footer */}
      <footer className="border-t border-[#222] px-6 py-4 flex items-center justify-between shrink-0">
        <p className="text-[#333] text-[10px] tracking-wider uppercase">
          Data sourced from FastF1 &amp; OpenF1
        </p>
        <div className="flex items-center gap-4">
          <span className="text-[#333] text-[10px] font-mono">SESSION: R &middot; 2024</span>
          <span className="text-[#333] text-[10px] tracking-wider uppercase">
            Built for F1 strategy analysis
          </span>
        </div>
      </footer>
    </div>
  )
}
