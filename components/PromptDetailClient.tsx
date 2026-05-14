"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Settings, ChevronDown, Sparkles, MessageSquare, Play, Loader2,
} from "lucide-react";
import ChatModal from "./ChatModal";
import EngineIcon from "./EngineIcon";
import DomainFavicon from "./DomainFavicon";
import DateRangeDropdown, { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import BrandsDropdown from "./BrandsDropdown";
import PromptSettingsModal from "./PromptSettingsModal";
import {
  ChatFact, ChatRecordView, Resolution,
  aggregateBrands, aggregateDomains, totalCitations, toChatRecords,
  buildVisibilitySeries, filterByEngines, filterByDateRange, aggregateByCategory,
} from "../lib/chat-aggregations";

interface ProjectBrand {
  name: string;
  isOwn: boolean;
}

interface PromptInfo {
  id: string;
  query: string;
  createdAt: string;
  volumeTier: string;
  topicName: string;
  projectName: string;
  isActive: boolean;
  location: string;
}

interface ProjectTag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  prompt: PromptInfo;
  chatFacts: ChatFact[];
  projectBrands: ProjectBrand[];
  availableTags: ProjectTag[];
  selectedTagIds: string[];
}

const DOMAIN_TYPE_COLORS: Record<string, string> = {
  Corporate: "#f97316", UGC: "#3b82f6", Other: "#22c55e",
  Reference: "#a855f7", You: "#ef4444", Competitor: "#14b8a6",
  Editorial: "#eab308", Institutional: "#ec4899",
};

function formatCitationCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

const VOLUME_TIER_LEVEL: Record<string, number> = {
  "Very High": 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function volumeLevel(tier: string): number {
  return VOLUME_TIER_LEVEL[tier] ?? 2;
}

function getCategoryLabel(cat: string | null, domain: string, projectName: string): string {
  if (projectName && projectName !== "General") {
    const projectBase = projectName.toLowerCase().split('.')[0].replace(/[^a-z0-9]/g, '');
    const domainBase = domain.toLowerCase().split('.')[0].replace(/[^a-z0-9]/g, '');
    if (projectBase.length >= 2 && (domainBase.includes(projectBase) || projectBase.includes(domainBase))) {
      return "You";
    }
  }
  if (!cat) return "Other";
  const map: Record<string, string> = {
    owned: "Corporate", editorial: "Editorial", reference: "Reference",
    ugc: "UGC", competitor: "Competitor", institutional: "Institutional",
  };
  return map[cat.toLowerCase()] || "Other";
}

export default function PromptDetailClient({ prompt, chatFacts, projectBrands, availableTags, selectedTagIds }: Props) {
  const router = useRouter();
  const [resolution, setResolution] = useState<Resolution>("W");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatRecordView | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  const allAvailableModels = useMemo(() => {
    const set = new Set<string>();
    for (const c of chatFacts) set.add(c.engine);
    const found = Array.from(set);
    const defaults = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Groq"];
    for (const d of defaults) if (!found.includes(d)) found.push(d);
    return found;
  }, [chatFacts]);

  const [selectedModels, setSelectedModels] = useState<string[]>(allAvailableModels);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => makePresetRange("30"));
  const [selectedBrands, setSelectedBrands] = useState<string[] | null>(null);

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model],
    );
  };

  const runScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanStatus(`Querying ${selectedModels.length} engine${selectedModels.length === 1 ? "" : "s"}…`);
    try {
      const engines = selectedModels.join(",");
      const res = await fetch(
        `/api/run-daily-scan?promptId=${encodeURIComponent(prompt.id)}&engines=${encodeURIComponent(engines)}`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Scan failed (HTTP ${res.status})`);
      }
      setScanStatus(
        data.mode === "inngest"
          ? `Dispatched ${data.dispatched} jobs — results stream in shortly.`
          : `Completed ${data.dispatched} engine calls. Refreshing…`,
      );
      router.refresh();
      window.setTimeout(() => setScanStatus(null), 4000);
    } catch (err) {
      setScanStatus(err instanceof Error ? `Error: ${err.message}` : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const stableBrandColors = useMemo(() => {
    const all = aggregateBrands(chatFacts, 20);
    const map: Record<string, string> = {};
    for (const b of all) map[b.name] = b.color;
    return map;
  }, [chatFacts]);

  const filteredChats = useMemo(
    () => filterByDateRange(filterByEngines(chatFacts, selectedModels), dateRange),
    [chatFacts, selectedModels, dateRange],
  );

  const brands = useMemo(() => {
    const all = aggregateBrands(filteredChats, 50, undefined, stableBrandColors);
    const filtered = selectedBrands === null
      ? all
      : all.filter((b) => selectedBrands.includes(b.name));
    return filtered.slice(0, 7);
  }, [filteredChats, stableBrandColors, selectedBrands]);

  const domains = useMemo(() => aggregateDomains(filteredChats, 10), [filteredChats]);
  const totalDomainCitations = useMemo(() => totalCitations(filteredChats), [filteredChats]);

  const chartData = useMemo(
    () => buildVisibilitySeries(filteredChats, brands.map((b) => b.name), resolution, dateRange),
    [filteredChats, brands, resolution, dateRange],
  );

  const recentChats = useMemo(() => {
    const records = toChatRecords(filteredChats);
    records.sort((a, b) => new Date(b.runDate).getTime() - new Date(a.runDate).getTime());
    return records;
  }, [filteredChats]);

  const totalMentions = brands.reduce((s, b) => s + b.count, 0);
  const maxDomainCount = domains.length > 0 ? domains[0].count : 1;

  const categoryStats = useMemo(
    () => aggregateByCategory(filteredChats, (cat, dom) => getCategoryLabel(cat, dom, prompt.projectName)),
    [filteredChats, prompt.projectName],
  );
  const totalTypeCounts = Object.values(categoryStats).reduce((s, v) => s + v.count, 0);

  const createdDate = new Date(prompt.createdAt);
  const diffDays = Math.floor((Date.now() - createdDate.getTime()) / 86400000);
  const timeAgo = diffDays > 0 ? `${diffDays} day${diffDays > 1 ? "s" : ""} ago` : "today";

  return (
    <div className="prompt-detail-page">
      {selectedChat && <ChatModal chat={selectedChat} onClose={() => setSelectedChat(null)} />}
      {isSettingsOpen && (
        <PromptSettingsModal
          promptId={prompt.id}
          initialActive={prompt.isActive}
          initialLocation={prompt.location}
          availableTags={availableTags}
          selectedTagIds={selectedTagIds}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
      {/* ── Top bar ───────────────────────────────────────── */}
      <div className="pd-topbar">
        <div className="pd-breadcrumb">
          <MessageSquare size={13} className="pd-breadcrumb-icon" />
          <a href="/prompts" className="pd-breadcrumb-link">Prompts</a>
          <span className="pd-breadcrumb-sep">›</span>
          <span className="pd-breadcrumb-current">
            {prompt.query.length > 52
              ? prompt.query.slice(0, 52) + "..."
              : prompt.query}
          </span>
        </div>

        <div className="pd-topbar-actions">
          {scanStatus && (
            <span
              className={`pd-scan-status ${scanStatus.startsWith("Error") ? "pd-scan-status-error" : ""}`}
            >
              {scanStatus}
            </span>
          )}
          <button
            className="pd-run-scan-btn"
            onClick={runScan}
            disabled={isScanning || selectedModels.length === 0}
            title="Query selected AI engines now and refresh data"
          >
            {isScanning ? (
              <>
                <Loader2 size={14} strokeWidth={2} className="pd-spin" />
                <span>Running…</span>
              </>
            ) : (
              <>
                <Play size={14} strokeWidth={2} />
                <span>Run scan</span>
              </>
            )}
          </button>
          <button
            className="pd-settings-btn"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings size={14} strokeWidth={2} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      <div className="pd-filters">
        <BrandsDropdown
          projectBrands={projectBrands}
          projectName={prompt.projectName}
          value={selectedBrands}
          onChange={setSelectedBrands}
        />
        <DateRangeDropdown value={dateRange} onChange={setDateRange} />

        <div className="relative inline-block text-left">
          <button
            className="pd-filter-chip"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
          >
            <Sparkles size={11} />
            {selectedModels.length === allAvailableModels.length ? "All Models" : `${selectedModels.length} Models`} <ChevronDown size={11} />
          </button>

          {isModelDropdownOpen && (
            <div className="absolute left-0 z-50 mt-2 w-56 origin-top-left rounded-md bg-[#141418] shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-slate-800">
              <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/50">
                  Active models
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  {allAvailableModels.map((model) => (
                    <label key={model} className="flex items-center px-4 py-2 hover:bg-slate-800/50 cursor-pointer group transition-colors">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer appearance-none checked:bg-indigo-500 checked:border-indigo-500 transition-colors"
                          checked={selectedModels.includes(model)}
                          onChange={() => toggleModel(model)}
                        />
                        {selectedModels.includes(model) && (
                          <svg className="absolute w-3 h-3 text-white pointer-events-none left-0.5 top-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        <EngineIcon engine={model} size={16} />
                        <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{model}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Header Card ───────────────────────────────────── */}
      <div className="pd-prompt-header">
        <span className="pd-header-label">Prompt</span>

        <h1 className="pd-prompt-title">{prompt.query}</h1>

        <div className="pd-meta-grid">
          <div className="pd-meta-item">
            <span className="pd-meta-label">Date added</span>
            <span className="pd-meta-value">{timeAgo}</span>
          </div>

          <div className="pd-meta-item">
            <span className="pd-meta-label">Topic</span>
            <span className="pd-meta-value">
              {prompt.topicName || "—"}
            </span>
          </div>

          <div className="pd-meta-item">
            <span className="pd-meta-label">Volume</span>

            <span className="pd-meta-value">
              <span
                className="pd-volume-bars"
                aria-label={prompt.volumeTier || "Medium"}
              >
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`pd-volume-bar ${
                      i <= volumeLevel(prompt.volumeTier)
                        ? "pd-volume-bar-on"
                        : ""
                    }`}
                  />
                ))}
              </span>
            </span>
          </div>

          <div className="pd-meta-item">
            <span className="pd-meta-label">Location</span>

            <span className="pd-meta-value pd-location">
              <img
                src={`https://flagcdn.com/w40/${(
                  prompt.location || "us"
                ).toLowerCase()}.png`}
                alt=""
                width={16}
                height={12}
                className="pd-flag-img"
              />

              {(prompt.location || "US").toUpperCase()}
            </span>
          </div>

          <div className="pd-meta-item">
            <span className="pd-meta-label">Status</span>

            <span className="pd-status-badge">
              {prompt.isActive ? "Active" : "Paused"}
            </span>
          </div>
        </div>
      </div>

      <div className="pd-section">
        <h2 className="pd-section-title">Overview</h2>
        <p className="pd-section-subtitle">How often each brand appears in AI generated discussions</p>

        <div className="pd-overview-grid">
          <div className="pd-chart-card">
            <div className="pd-chart-header">
              <div className="pd-chart-label">
                Visibility <span className="pd-info-icon" title="Brand visibility over time">ⓘ</span>
              </div>
              <div className="pd-resolution-toggle">
                {(["D", "W", "M"] as const).map((r) => (
                  <button key={r} className={`pd-res-btn ${resolution === r ? "pd-res-active" : ""}`}
                    onClick={() => setResolution(r)}>{r}</button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9", fontSize: 11 }} />
                {brands.map((b) => (
                  <Line key={b.name} type="monotone" dataKey={b.name} stroke={b.color} strokeWidth={2} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="pd-chart-footer">Showing data for 30 days</div>
          </div>

          <div className="pd-brands-card">
            <div className="pd-brands-header">
              <span className="pd-brands-title">Top 7 Brands <span className="pd-info-icon">ⓘ</span></span>
            </div>
            <table className="pd-brands-table">
              <thead>
                <tr>
                  <th></th><th>Brand</th>
                  <th>Visibility <ChevronDown size={9} style={{ display: "inline" }} /></th>
                  <th>SOV</th><th>Brand count</th><th>Position</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b, i) => {
                  const vis = totalMentions > 0 ? Math.round((b.count / totalMentions) * 100) : 0;
                  return (
                    <tr key={b.name}>
                      <td className="pd-rank">{i + 1}</td>
                      <td className="pd-brand-cell">
                        <span className="pd-brand-dot" style={{ background: b.color }}></span>
                        {b.name}
                      </td>
                      <td><span className="pd-vis-value">{vis}%</span></td>
                      <td>{vis}%</td>
                      <td><span className="pd-brand-count-badge">{b.count}</span></td>
                      <td>#{b.position ? b.position.toFixed(1) : "—"}</td>
                    </tr>
                  );
                })}
                {brands.length === 0 && (
                  <tr>
                    <td colSpan={6} className="pd-empty">
                      {isScanning
                        ? "Querying engines — brands will appear once responses are parsed…"
                        : "No brands extracted yet. Click “Run scan” above to query the selected AI engines."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="pd-section">
        <div className="pd-domains-header-row">
          <div>
            <h2 className="pd-section-title">Top Domains</h2>
            <p className="pd-section-subtitle">Top domains retrieved by AI models in their answers.</p>
          </div>
          <div className="pd-domains-links">
            <span className="pd-link-tab pd-link-active">All URLs</span>
            <span className="pd-link-tab">All domains</span>
          </div>
        </div>

        <div className="pd-domains-grid">
          <div className="pd-domains-table-card">
            <table className="pd-domains-table">
              <thead><tr><th>Domain</th><th>Retrieved</th><th>Citation rate</th><th>Type</th></tr></thead>
              <tbody>
                {domains.slice(0, 8).map((d, i) => {
                  const pct = ((d.count / maxDomainCount) * 100).toFixed(1);
                  const rate = (d.count / Math.max(totalDomainCitations, 1)).toFixed(1);
                  const typeLabel = getCategoryLabel(d.category, d.domain, prompt.projectName);
                  return (
                    <tr key={i}>
                      <td className="pd-domain-cell">
                        <span className="pd-domain-favicon" style={{ background: DOMAIN_TYPE_COLORS[typeLabel] || "#6366f1" }}></span>
                        {d.domain}
                      </td>
                      <td>{pct}%</td>
                      <td>{rate}</td>
                      <td><span className={`pd-type-badge pd-type-${typeLabel.toLowerCase()}`}>{typeLabel}</span></td>
                    </tr>
                  );
                })}
                {domains.length === 0 && <tr><td colSpan={4} className="pd-empty">No domains found.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="pd-domain-types-card">
            <div className="pd-domain-types-header">
              <span className="pd-domain-types-title">Domain types</span>
              <span className="pd-domain-types-total">Total citations: {totalDomainCitations}</span>
            </div>
            <div className="pd-domain-types-list">
              {["Corporate", "UGC", "Other", "Reference", "You", "Competitor", "Editorial", "Institutional"].map((type) => {
                const stats = categoryStats[type] || { count: 0, topSources: [] };
                const pct = totalTypeCounts > 0 ? Math.round((stats.count / totalTypeCounts) * 100) : 0;
                return (
                  <div key={type} className="pd-dtype-row">
                    <div className="pd-dtype-label">
                      <span className="pd-dtype-dot" style={{ background: DOMAIN_TYPE_COLORS[type] || "#64748b" }}></span>
                      {type}
                    </div>
                    <div className="pd-dtype-bar-wrapper">
                      <div className="pd-dtype-bar" style={{ width: `${Math.max(pct, 1)}%`, background: DOMAIN_TYPE_COLORS[type] || "#64748b" }}></div>
                    </div>
                    <span className="pd-dtype-pct">{pct}%</span>
                    {stats.count > 0 && (
                      <div className="pd-dtype-tooltip">
                        <div className="pd-dtype-tooltip-header">
                          <span className="pd-dtype-tooltip-type">{type}</span>
                          <span className="pd-dtype-tooltip-count">{formatCitationCount(stats.count)} citations</span>
                        </div>
                        {stats.topSources.length > 0 && (
                          <>
                            <div className="pd-dtype-tooltip-label">Top sources</div>
                            <div className="pd-dtype-tooltip-sources">
                              {stats.topSources.map((s) => (
                                <DomainFavicon key={s.domain} domain={s.domain} size={18} />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="pd-section">
        <div className="pd-domains-header-row">
          <div>
            <h2 className="pd-section-title">Recent Chats</h2>
            <p className="pd-section-subtitle">Where AI gets its information about this brand</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 font-medium">{prompt.projectName} mentioned</span>
            <div className="w-8 h-4 bg-slate-800 rounded-full relative p-0.5 cursor-pointer">
              <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
            </div>
          </div>
        </div>

        {recentChats.length === 0 ? (
          <div className="pd-empty-chats">
            🔍 No recent chats recorded yet.
          </div>
        ) : (
          <div className="pd-recent-chats-scroll custom-scrollbar">
            {recentChats.map((chat) => {
              const runDate = new Date(chat.runDate);
              const diffMs = Date.now() - runDate.getTime();
              const diffHr = Math.floor(diffMs / 3600000);
              const timeAgo = diffHr > 24 ? `${Math.floor(diffHr / 24)} d ago` : `${diffHr} hr ago`;
              const snippet = chat.rawResponse ? chat.rawResponse.slice(0, 150) + "..." : "No response content...";

              return (
                <div
                  key={chat.id}
                  className="pd-chat-card"
                  onClick={() => setSelectedChat(chat)}
                >
                  <div className="pd-chat-card-header">
                    <EngineIcon engine={chat.engine} />
                    <span className="pd-chat-engine-name">{chat.engine}</span>
                  </div>
                  <div className="pd-chat-query">{prompt.query}</div>
                  <div className="pd-chat-snippet">{snippet}</div>
                  <div className="pd-chat-footer">
                    <div className="pd-chat-mentions">
                      {chat.brandsFound.slice(0, 3).map((b, i) => (
                        <div key={i} className="pd-mention-dot" title={b} style={{ background: "#cbd5e1" }}>
                          {b.charAt(0)}
                        </div>
                      ))}
                      {chat.brandsFound.length > 3 && (
                        <span className="pd-mention-more">+{chat.brandsFound.length - 3}</span>
                      )}
                    </div>
                    <span className="pd-chat-time">{timeAgo}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
