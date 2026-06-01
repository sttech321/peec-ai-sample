"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Search, Info, Eye, EyeOff, Plus } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VisitedUrl {
  path: string;
  folder: string;
  bot: string;
  botDomain: string;
  visits: number;
  visitedAt: Date;
}

// ── Dynamic date helpers ───────────────────────────────────────────────────────

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}
function daysAgo(d: number): Date {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Yesterday";
  if (diffD < 30) return `${diffD}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatUpdatedDate(date: Date): string {
  const now = new Date();
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isSameDay) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const DATE_RANGES: Record<string, number> = {
  "Last 24 hours": 1,
  "Last 7 days": 7,
  "Last 30 days": 30,
  "Last 90 days": 90,
};

// ── Mock data (timestamps relative to now) ────────────────────────────────────

function buildMockUrls(): VisitedUrl[] {
  return [
    { path: "/docs/getting-started",   folder: "/docs",  bot: "GPTBot",          botDomain: "openai.com",       visits: 312, visitedAt: hoursAgo(2)  },
    { path: "/docs/api-reference",     folder: "/docs",  bot: "anthropic-ai",    botDomain: "anthropic.com",    visits: 287, visitedAt: hoursAgo(4)  },
    { path: "/blog/seo-guide-2026",    folder: "/blog",  bot: "Google-Extended", botDomain: "google.com",       visits: 201, visitedAt: daysAgo(1)   },
    { path: "/",                        folder: "/",      bot: "GPTBot",          botDomain: "openai.com",       visits: 198, visitedAt: hoursAgo(6)  },
    { path: "/docs/installation",      folder: "/docs",  bot: "PerplexityBot",   botDomain: "perplexity.ai",    visits: 156, visitedAt: hoursAgo(3)  },
    { path: "/pricing",                folder: "/",      bot: "ChatGPT-User",    botDomain: "openai.com",       visits: 142, visitedAt: hoursAgo(8)  },
    { path: "/about",                  folder: "/",      bot: "GPTBot",          botDomain: "openai.com",       visits: 89,  visitedAt: daysAgo(2)   },
    { path: "/docs/changelog",         folder: "/docs",  bot: "anthropic-ai",    botDomain: "anthropic.com",    visits: 76,  visitedAt: daysAgo(1)   },
    { path: "/blog/ai-visibility",     folder: "/blog",  bot: "Google-Extended", botDomain: "google.com",       visits: 68,  visitedAt: daysAgo(3)   },
    { path: "/docs/faq",               folder: "/docs",  bot: "GPTBot",          botDomain: "openai.com",       visits: 54,  visitedAt: hoursAgo(5)  },
    { path: "/features",               folder: "/",      bot: "PerplexityBot",   botDomain: "perplexity.ai",    visits: 47,  visitedAt: hoursAgo(12) },
    { path: "/docs/quickstart",        folder: "/docs",  bot: "anthropic-ai",    botDomain: "anthropic.com",    visits: 43,  visitedAt: hoursAgo(7)  },
    { path: "/blog/chatgpt-citations", folder: "/blog",  bot: "OAI-SearchBot",   botDomain: "openai.com",       visits: 39,  visitedAt: daysAgo(4)   },
    { path: "/contact",                folder: "/",      bot: "GPTBot",          botDomain: "openai.com",       visits: 28,  visitedAt: daysAgo(1)   },
    { path: "/docs/integrations",      folder: "/docs",  bot: "Google-Extended", botDomain: "google.com",       visits: 24,  visitedAt: daysAgo(2)   },
    { path: "/terms",                  folder: "/",      bot: "CCBot",           botDomain: "commoncrawl.org",  visits: 19,  visitedAt: daysAgo(5)   },
    { path: "/docs/webhooks",          folder: "/docs",  bot: "anthropic-ai",    botDomain: "anthropic.com",    visits: 15,  visitedAt: daysAgo(8)   },
    { path: "/blog/llm-citations",     folder: "/blog",  bot: "PerplexityBot",   botDomain: "perplexity.ai",    visits: 12,  visitedAt: daysAgo(12)  },
    { path: "/case-studies",           folder: "/",      bot: "Google-Extended", botDomain: "google.com",       visits: 9,   visitedAt: daysAgo(18)  },
    { path: "/docs/sdk",               folder: "/docs",  bot: "GPTBot",          botDomain: "openai.com",       visits: 7,   visitedAt: daysAgo(25)  },
  ];
}

// Static preview rows (used only in the blurred setup pane)
const PREVIEW_URLS = [
  { path: "/docs/getting-started", folder: "/docs", bot: "GPTBot" },
  { path: "/docs/api-reference",   folder: "/docs", bot: "anthropic-ai" },
  { path: "/blog/seo-guide-2026",  folder: "/blog", bot: "Google-Extended" },
  { path: "/",                      folder: "/",     bot: "GPTBot" },
];

const PROVIDERS = [
  { id: "cloudflare", label: "Cloudflare", emoji: "🟠", workerLabel: "Cloudflare Worker", deployLabel: "Deploy worker", docsLabel: "View Cloudflare docs" },
  { id: "vercel",     label: "Vercel",     emoji: "▲",  workerLabel: "Vercel Drain",       deployLabel: "Deploy drain",  docsLabel: "View Agent analytics docs" },
  { id: "file",       label: "File",       emoji: "📄", workerLabel: "Log File",            deployLabel: "Upload file",   docsLabel: "View file format docs" },
];

// ── Bot favicon chip ───────────────────────────────────────────────────────────

function BotChip({ bot, domain }: { bot: string; domain: string }) {
  return (
    <span className="ci-bot-chip">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`}
        alt=""
        style={{ width: 11, height: 11, borderRadius: 2 }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      {bot}
    </span>
  );
}

// ── Blurred preview pane ───────────────────────────────────────────────────────

function PreviewPane() {
  return (
    <div className="ci-preview ci-preview-blur" aria-hidden>
      {/* Tab bar */}
      <div style={{ padding: "12px 16px", background: "#fff", borderBottom: "1px solid #e4e4e7", display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 12, color: "#71717a", padding: "6px 10px" }}>Agent analytics</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#18181b", padding: "6px 10px", borderBottom: "2px solid #18181b", marginBottom: -1 }}>Crawl insights</span>
      </div>
      {/* Filters */}
      <div style={{ padding: "10px 14px", display: "flex", gap: 6, borderBottom: "1px solid #f4f4f5" }}>
        {[
          { label: "Last 7 days", icon: "○" },
          { label: "All operators", icon: "⊙" },
          { label: "All bot types", icon: "≡" },
        ].map(({ label, icon }) => (
          <span key={label} style={{ padding: "4px 9px", border: "1px solid #e4e4e7", borderRadius: 6, fontSize: 11, color: "#52525b", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 9, color: "#a1a1aa" }}>{icon}</span>
            {label} <ChevronDown size={10} />
          </span>
        ))}
      </div>
      {/* Sub-tabs */}
      <div style={{ padding: "0 14px", display: "flex", gap: 0, borderBottom: "1px solid #e4e4e7" }}>
        {["Crawl insights", "Insight details", "Settings"].map((t, i) => (
          <span key={t} style={{ padding: "8px 12px", fontSize: 12, color: i === 1 ? "#18181b" : "#71717a", fontWeight: i === 1 ? 600 : 500, borderBottom: i === 1 ? "2px solid #18181b" : "2px solid transparent", marginBottom: -1 }}>
            {t}
          </span>
        ))}
      </div>
      {/* Insight card */}
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 10, color: "#a1a1aa", marginBottom: 4 }}>Updated · Today</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#18181b", lineHeight: 1.3, marginBottom: 4 }}>
          ChatGPT leads with 29% of hits — /docs/ is your most crawled folder
        </div>
        <div style={{ fontSize: 11, color: "#71717a", marginBottom: 12 }}>
          AI bots made 2,236 requests across 16 URLs in the last 7 days
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div style={{ background: "#fafafa", border: "1px solid #f4f4f5", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#71717a", marginBottom: 2 }}>Total visits</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#18181b" }}>2,249 <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 500 }}>+26.1%</span></div>
          </div>
          <div style={{ background: "#fafafa", border: "1px solid #f4f4f5", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#71717a", marginBottom: 2 }}>Top visited folder</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#6366f1" }}>/docs</div>
          </div>
        </div>
        {/* Visited URLs mini table header */}
        <div style={{ fontSize: 11, fontWeight: 600, color: "#18181b", marginBottom: 6 }}>Visited URLs</div>
        <div style={{ fontSize: 10, color: "#71717a", marginBottom: 8 }}>All URLs visited by AI bots, with model breakdown and source matchi…</div>
        <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px", gap: 8, padding: "7px 10px", background: "#fafafa", borderBottom: "1px solid #e4e4e7" }}>
            {["URLs ↕", "Folders ↕", "Bot"].map(h => (
              <span key={h} style={{ fontSize: 10, color: "#71717a", fontWeight: 500 }}>{h}</span>
            ))}
          </div>
          {PREVIEW_URLS.slice(0, 4).map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px", gap: 8, padding: "6px 10px", borderBottom: "1px solid #f4f4f5", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "#18181b" }}>{r.path}</span>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "#71717a" }}>{r.folder}</span>
              <span style={{ fontSize: 9, color: "#52525b" }}>{r.bot}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function CrawlInsightsClient({ projectName }: { projectName: string }) {
  const [provider, setProvider] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [connected, setConnected] = useState(false);
  const [subTab, setSubTab] = useState<"insights" | "detail" | "settings">("detail");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("Last 7 days");
  const [sortField, setSortField] = useState<"visits" | "path" | "date">("visits");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [now] = useState(() => new Date());

  const providerInfo = PROVIDERS.find(p => p.id === provider) ?? null;

  // Build mock URLs once, anchored to component mount time
  const allUrls = useMemo(() => buildMockUrls(), []);

  const handleSort = (f: "visits" | "path" | "date") => {
    if (sortField === f) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortField(f); setSortDir("desc"); }
  };

  // Filter by selected date range
  const dateFilteredUrls = useMemo(() => {
    const days = DATE_RANGES[dateRange] ?? 7;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return allUrls.filter(r => r.visitedAt >= cutoff);
  }, [allUrls, dateRange, now]);

  const filtered = useMemo(() => {
    let rows = dateFilteredUrls;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.path.toLowerCase().includes(q) || r.bot.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      if (sortField === "visits") return sortDir === "desc" ? b.visits - a.visits : a.visits - b.visits;
      if (sortField === "date")   return sortDir === "desc" ? b.visitedAt.getTime() - a.visitedAt.getTime() : a.visitedAt.getTime() - b.visitedAt.getTime();
      return sortDir === "desc" ? b.path.localeCompare(a.path) : a.path.localeCompare(b.path);
    });
  }, [dateFilteredUrls, search, sortField, sortDir]);

  const stats = useMemo(() => {
    const rows = dateFilteredUrls;
    const total = rows.reduce((s, r) => s + r.visits, 0);
    const folderCounts = new Map<string, number>();
    for (const r of rows) folderCounts.set(r.folder, (folderCounts.get(r.folder) ?? 0) + r.visits);
    const topFolder = Array.from(folderCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "/";
    const botCounts = new Map<string, number>();
    for (const r of rows) botCounts.set(r.bot, (botCounts.get(r.bot) ?? 0) + r.visits);
    const topBotEntry = Array.from(botCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    const topBot = topBotEntry?.[0] ?? "GPTBot";
    const topBotPct = topBotEntry ? Math.round((topBotEntry[1] / total) * 100) : 0;
    // Simulated previous-period comparison (previous same window = -12% to +35%)
    const prevTotal = Math.round(total * 0.793);
    const changePct = total > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0;
    return { total, topFolder, topBot, topBotPct, changePct, uniqueUrls: rows.length };
  }, [dateFilteredUrls]);

  // ── Setup view ───────────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="ci-page">
        <div className="ci-setup-wrap">
          {/* Left card */}
          <div className="ci-setup-card">
            <div>
              <h2 className="ci-setup-title">Agent analytics setup</h2>
              <p className="ci-setup-desc">
                Let Thrive Vision analyze traffic on your website, to gain insights into AI traffic and usage.
              </p>
            </div>

            {/* Provider row */}
            <div className="ci-provider-row">
              <span className="ci-provider-row-label">Logs provider:</span>
              <div style={{ position: "relative", flex: 1 }}>
                <button
                  className={`ci-select-btn ${dropdownOpen ? "ci-select-btn-open" : ""}`}
                  onClick={() => setDropdownOpen(v => !v)}
                >
                  {provider
                    ? <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#18181b" }}>
                        <span>{providerInfo?.emoji}</span>{providerInfo?.label}
                      </span>
                    : <span>Please select</span>
                  }
                  <ChevronRight size={14} style={{ transform: dropdownOpen ? "rotate(90deg)" : undefined, transition: "transform 0.15s" }} />
                </button>
                {dropdownOpen && (
                  <div className="ci-dropdown" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20 }}>
                    <div className="ci-dropdown-label">Choose one integration</div>
                    {PROVIDERS.map(p => (
                      <div
                        key={p.id}
                        className="ci-dropdown-item"
                        onClick={() => { setProvider(p.id); setDropdownOpen(false); }}
                      >
                        <span className="ci-dropdown-item-icon" style={{ background: p.id === "cloudflare" ? "#fff7ed" : "#f4f4f5" }}>
                          {p.emoji}
                        </span>
                        {p.label}
                      </div>
                    ))}
                    <hr className="ci-dropdown-divider" />
                    <div className="ci-dropdown-request">
                      <Plus size={13} />
                      Request new integration
                      <ChevronRight size={13} style={{ marginLeft: "auto" }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* API key box (appears when provider selected) */}
            {provider && (
              <div className="ci-apikey-box">
                <div className="ci-apikey-box-title">{providerInfo?.workerLabel}</div>
                <div className="ci-apikey-label">API key</div>
                <div className="ci-apikey-input-wrap">
                  <input
                    type={showKey ? "text" : "password"}
                    className="ci-apikey-input"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder=""
                    autoComplete="off"
                  />
                  <button
                    className="ci-apikey-eye"
                    onClick={() => setShowKey(v => !v)}
                    type="button"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
              <button
                className="ci-connect-btn"
                disabled={!provider}
                onClick={() => setConnected(true)}
              >
                {providerInfo?.deployLabel ?? "Deploy worker"}
              </button>
              <button className="ci-docs-link" onClick={() => {}}>
                {provider ? providerInfo?.docsLabel : "View agent analytics docs"}
              </button>
            </div>
          </div>

          {/* Right: blurred preview */}
          <div style={{ position: "relative" }}>
            <PreviewPane />
            <div className="ci-preview-overlay">
              <div className="ci-preview-badge">
                Connect a logs provider to see live AI bot data
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [dateDropOpen, setDateDropOpen] = useState(false);

  // ── Connected view ────────────────────────────────────────────────────────────
  return (
    <div className="ci-page">
      <div className="ci-header">
        <div className="ci-tabs">
          <button className={`ci-tab ${subTab === "detail" ? "ci-tab-active" : ""}`} onClick={() => setSubTab("detail")}>
            Insight details
          </button>
          <button className={`ci-tab ${subTab === "insights" ? "ci-tab-active" : ""}`} onClick={() => setSubTab("insights")}>
            Crawl insights
          </button>
          <button className={`ci-tab ${subTab === "settings" ? "ci-tab-active" : ""}`} onClick={() => setSubTab("settings")}>
            Settings
          </button>
        </div>
        <div className="ci-filter-bar">
          {providerInfo && (
            <span className="ci-provider-badge">
              <span>{providerInfo.emoji}</span>
              {providerInfo.label} connected
            </span>
          )}

          {/* Date range dropdown */}
          <div style={{ position: "relative" }}>
            <button className="ci-chip" onClick={() => setDateDropOpen(v => !v)}>
              {dateRange} <ChevronDown size={12} />
            </button>
            {dateDropOpen && (
              <div className="ci-dropdown" style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 30, minWidth: 160 }}>
                {Object.keys(DATE_RANGES).map(r => (
                  <div key={r}
                    className="ci-dropdown-item"
                    style={{ fontWeight: r === dateRange ? 600 : 400, background: r === dateRange ? "#f4f4f5" : undefined }}
                    onClick={() => { setDateRange(r); setDateDropOpen(false); }}
                  >
                    {r}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="ci-chip"><span style={{ color: "#a1a1aa", marginRight: 4 }}>Bots:</span> All operators <ChevronDown size={12} /></button>
          <button className="ci-chip"><span style={{ color: "#a1a1aa", marginRight: 4 }}>Type:</span> All bot types <ChevronDown size={12} /></button>
        </div>
      </div>

      {subTab === "detail" && (
        <div className="ci-insight-card">
          <div className="ci-insight-meta">
            Updated · {formatUpdatedDate(now)}
            <span style={{ marginLeft: 8, color: "#d1d5db" }}>·</span>
            <span style={{ marginLeft: 8 }}>{dateRange}</span>
          </div>
          <div>
            <h2 className="ci-insight-headline">
              {stats.topBot} leads with {stats.topBotPct}% of hits — {stats.topFolder} is your most crawled folder
            </h2>
            <p className="ci-insight-sub">
              AI bots made {stats.total.toLocaleString()} requests across {stats.uniqueUrls} URLs in the {dateRange.toLowerCase()}
            </p>
          </div>
          <div className="ci-stats-row">
            <div className="ci-stat-box">
              <span className="ci-stat-label">Total visits <Info size={11} style={{ color: "#a1a1aa" }} /></span>
              <span className="ci-stat-value">
                {stats.total.toLocaleString()}
                <span className={`ci-stat-trend ${stats.changePct >= 0 ? "ci-trend-up" : "ci-trend-down"}`}>
                  {" "}{stats.changePct >= 0 ? "+" : ""}{stats.changePct}%
                </span>
              </span>
            </div>
            <div className="ci-stat-box">
              <span className="ci-stat-label">Top visited folder <Info size={11} style={{ color: "#a1a1aa" }} /></span>
              <span className="ci-stat-value ci-stat-sub">{stats.topFolder}</span>
            </div>
            <div className="ci-stat-box">
              <span className="ci-stat-label">Unique URLs crawled</span>
              <span className="ci-stat-value">{stats.uniqueUrls}</span>
            </div>
            <div className="ci-stat-box">
              <span className="ci-stat-label">Leading bot</span>
              <span className="ci-stat-value" style={{ fontSize: 14 }}>{stats.topBot}</span>
            </div>
          </div>
        </div>
      )}

      {(subTab === "insights" || subTab === "detail") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="ci-section-head">
            <div>
              <h3 className="ci-section-title">Visited URLs</h3>
              <p className="ci-section-sub">
                All URLs visited by AI bots in the {dateRange.toLowerCase()}, with model breakdown and source matching
              </p>
            </div>
            <div className="ci-search">
              <Search size={13} style={{ color: "#a1a1aa", flexShrink: 0 }} />
              <input
                placeholder="Search"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="ci-urls-table">
            <div className="ci-urls-head">
              <span onClick={() => handleSort("path")}>URLs {sortField === "path" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</span>
              <span>Folders</span>
              <span>Bot</span>
              <span onClick={() => handleSort("visits")}>Visits {sortField === "visits" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</span>
              <span onClick={() => handleSort("date")}>Last visited {sortField === "date" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</span>
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: "#71717a" }}>
                No URLs crawled in the {dateRange.toLowerCase()}.
              </div>
            ) : (
              filtered.map((row, i) => (
                <div key={i} className="ci-urls-row">
                  <span className="ci-url-path">{row.path}</span>
                  <span className="ci-url-folder">{row.folder}</span>
                  <BotChip bot={row.bot} domain={row.botDomain} />
                  <span className="ci-visits-num">{row.visits.toLocaleString()}</span>
                  <span className="ci-time-ago">{timeAgo(row.visitedAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {subTab === "settings" && (
        <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#18181b" }}>Integration settings</h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fafafa", border: "1px solid #f4f4f5", borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#18181b" }}>{providerInfo?.emoji} {providerInfo?.label} integration</div>
              <div style={{ fontSize: 12, color: "#71717a", marginTop: 2 }}>Connected and receiving logs</div>
            </div>
            <span className="ci-provider-badge">Active</span>
          </div>
          <button
            style={{ padding: "8px 14px", background: "#fff", border: "1px solid #e4e4e7", borderRadius: 8, fontSize: 13, color: "#dc2626", cursor: "pointer", alignSelf: "flex-start" }}
            onClick={() => { setConnected(false); setProvider(null); setApiKey(""); }}
          >
            Disconnect provider
          </button>
        </div>
      )}
    </div>
  );
}
