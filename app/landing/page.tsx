import React from "react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#e8e8e8]">
        <div className="max-w-7xl mx-auto px-6 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThriveVisionLogo />
            <span className="text-[15px] font-semibold tracking-tight text-[#1a1a1a]">Thrive Vision</span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {["Pricing", "Resources", "Partnerships", "MCP", "Careers"].map((item) => (
              <Link
                key={item}
                href="#"
                className="px-3 py-1.5 text-sm text-[#555] hover:text-[#1a1a1a] transition-colors rounded-md hover:bg-[#f0f0f0]"
              >
                {item}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              prefetch={false}
              className="px-4 py-[7px] text-sm font-medium text-[#333] border border-[#d8d8d8] rounded-md bg-white hover:bg-[#f5f5f5] transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/sign-up"
              prefetch={false}
              className="px-4 py-[7px] text-sm font-semibold text-white bg-[#1a1a1a] rounded-md hover:bg-[#333] transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Hiring badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#e0e0e0] text-xs font-medium text-[#444] mb-8 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            We are hiring
          </div>

          {/* Headline */}
          <h1 className="text-[56px] md:text-[68px] font-bold leading-[1.08] tracking-[-0.03em] mb-6">
            <span className="text-[#1a1a1a]">AI search analytics</span>
            <br />
            <span className="text-[#aaa]">for marketing teams</span>
          </h1>

          {/* Subtitle */}
          <p className="text-[16px] text-[#666] mb-8 leading-relaxed max-w-xl mx-auto">
            Track, analyze, and improve brand performance on AI search platforms
            <br />
            through key metrics like{" "}
            <MetricPill icon="👁" label="Visibility" />{" "}
            <span className="text-[#999]">,</span>{" "}
            <MetricPill icon="📍" label="Position" />{" "}
            <span className="text-[#999]">, and</span>{" "}
            <MetricPill icon="😊" label="Sentiment" />
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="#"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[#333] bg-white border border-[#d8d8d8] rounded-md hover:bg-[#f5f5f5] transition-colors shadow-sm"
            >
              <span className="text-[#aaa]">◻</span> Talk to Sales
            </Link>
            <Link
              href="/sign-up"
              prefetch={false}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1a1a1a] rounded-md hover:bg-[#333] transition-colors shadow-sm"
            >
              Start Free Trial
            </Link>
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="mt-16 max-w-5xl mx-auto">
          <DashboardPreview />
        </div>
      </section>

      {/* Social proof logos */}
      <section className="py-16 px-6 border-t border-[#e8e8e8] bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm text-[#999] mb-8 font-medium">
            Trusted by +1500 marketing teams
          </p>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-semibold text-[#aaa] mb-4 text-center">Brands</p>
              <div className="grid grid-cols-2 gap-4">
                {["Breitling", "Attio", "Squarespace", "Brevo", "n8n", "ElevenLabs"].map((b) => (
                  <div key={b} className="flex items-center justify-center h-10 text-sm font-semibold text-[#555]">{b}</div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#aaa] mb-4 text-center">Agencies</p>
              <div className="grid grid-cols-2 gap-4">
                {["Seer", "Eskimoz", "Omniscient", "We Comms", "FirstPage", "Jin Global"].map((a) => (
                  <div key={a} className="flex items-center justify-center h-10 text-sm font-semibold text-[#555]">{a}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-[#e8e8e8] bg-white px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-[#999]">
          <div className="flex items-center gap-2">
            <ThriveVisionLogo size={20} />
            <span className="font-semibold text-[#555]">Thrive Vision</span>
          </div>
          <span>© 2026 Thrive Vision. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-[#555] transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-[#555] transition-colors">Terms</Link>
            <Link href="#" className="hover:text-[#555] transition-colors">Imprint</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ThriveVisionLogo({ size = 24 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, background: "#1a1a1a", borderRadius: size * 0.2,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.42, fontWeight: 700, letterSpacing: "-0.5px",
      flexShrink: 0,
    }}>
      TV
    </div>
  );
}

function MetricPill({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#d8d8d8] bg-white text-[13px] text-[#333] font-medium">
      <span>{icon}</span> {label}
    </span>
  );
}

function DashboardPreview() {
  return (
    <div className="bg-white rounded-2xl border border-[#e0e0e0] shadow-xl overflow-hidden">
      {/* Top bar */}
      <div className="border-b border-[#eee] px-4 py-3 flex items-center gap-3 bg-[#fafafa]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex gap-2">
          {["Attio", "Last 7 days", "All tags", "All Models"].map((t) => (
            <span key={t} className="px-2.5 py-1 text-xs font-medium text-[#555] border border-[#e0e0e0] rounded bg-white">{t}</span>
          ))}
        </div>
        <span className="ml-auto text-xs text-[#999]">↑ Export</span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-44 border-r border-[#eee] p-3 bg-[#fafafa]">
          <div className="text-xs font-semibold text-[#aaa] mb-3 px-2">Pages</div>
          {[
            { label: "Overview", active: true },
            { label: "Prompts", active: false },
            { label: "Sources", active: false },
            { label: "Models", active: false },
            { label: "Settings", active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`px-2 py-1.5 text-xs rounded mb-0.5 font-medium ${
                item.active ? "bg-[#eee] text-[#1a1a1a]" : "text-[#666]"
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-4">
          {/* Stats row */}
          <div className="text-xs text-[#999] mb-4">
            Overview · Attio&apos;s Visibility trending up by 5.2% this month &nbsp;
            <span className="font-medium text-[#555]">Visibility: 3/14 ↓</span> ·{" "}
            <span className="font-medium text-[#555]">Sentiment: 2/14 ↑</span> ·{" "}
            <span className="font-medium text-[#555]">Position: 5/14 ↑</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Chart */}
            <div className="border border-[#eee] rounded-xl p-3">
              <div className="flex gap-3 mb-3">
                {["Visibility", "Sentiment", "Position"].map((t) => (
                  <span key={t} className="text-xs text-[#666] font-medium">{t}</span>
                ))}
              </div>
              <div className="h-32 relative">
                <svg viewBox="0 0 300 80" className="w-full h-full" preserveAspectRatio="none">
                  <polyline points="0,60 50,50 100,45 150,35 200,30 250,28 300,25" fill="none" stroke="#ef4444" strokeWidth="2" />
                  <polyline points="0,65 50,58 100,55 150,48 200,44 250,42 300,40" fill="none" stroke="#3b82f6" strokeWidth="2" />
                  <polyline points="0,68 50,63 100,60 150,58 200,55 250,52 300,50" fill="none" stroke="#f59e0b" strokeWidth="2" />
                  <polyline points="0,72 50,70 100,68 150,66 200,65 250,64 300,63" fill="none" stroke="#10b981" strokeWidth="2" />
                </svg>
                {/* Tooltip */}
                <div className="absolute top-2 left-[45%] bg-[#1a1a1a] text-white text-[10px] rounded-lg p-2 shadow-lg min-w-[110px]">
                  <div className="font-semibold mb-1 text-[#aaa]">March 2025</div>
                  {[["HubSpot","72%","#ef4444"],["Salesforce","65%","#3b82f6"],["Attio","54%","#f59e0b"],["Zero","33%","#f59e0b"],["Pipedrive","28%","#10b981"]].map(([name,pct,color]) => (
                    <div key={name} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm inline-block" style={{background:color}} />
                        <span>{name}</span>
                      </div>
                      <span className="font-semibold">{pct}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-[#bbb] mt-1">
                {["Jan","Feb","Mar","Apr","May","Jun"].map(m=><span key={m}>{m}</span>)}
              </div>
            </div>

            {/* Competitors table */}
            <div className="border border-[#eee] rounded-xl p-3">
              <div className="font-semibold text-xs text-[#333] mb-1">Attio&apos;s competitors</div>
              <div className="text-[10px] text-[#aaa] mb-3">Compare Attio with it&apos;s competitors</div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-[#aaa] border-b border-[#eee]">
                    <th className="text-left pb-1.5 font-medium">#</th>
                    <th className="text-left pb-1.5 font-medium">Brand</th>
                    <th className="text-left pb-1.5 font-medium">Visibility</th>
                    <th className="text-left pb-1.5 font-medium">Sentiment</th>
                    <th className="text-left pb-1.5 font-medium">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["1","HubSpot","65%","86","2.7",false,false],
                    ["2","Salesforce","62%","62","2.9",true,true],
                    ["3","Attio","47%","89","3.6",false,false],
                    ["4","Pipedrive","41%","76","3.9",true,false],
                    ["5","Zero","28%","88","2.3",false,false],
                  ].map(([n,name,vis,sent,pos,sentDown,posDown]) => (
                    <tr key={String(name)} className="border-b border-[#f5f5f5]">
                      <td className="py-1.5 text-[#aaa]">{n}</td>
                      <td className="py-1.5 font-medium text-[#333]">{String(name)}</td>
                      <td className="py-1.5">{String(vis)}</td>
                      <td className={`py-1.5 ${sentDown ? "text-red-500" : ""}`}>{String(sent)}</td>
                      <td className={`py-1.5 ${posDown ? "text-red-500" : ""}`}>{String(pos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
