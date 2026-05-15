"use client";

import React, { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Settings, ChevronDown,
} from "lucide-react";
import ChatModal from "./ChatModal";
import EngineIcon from "./EngineIcon";
import DomainFavicon from "./DomainFavicon";
import DateRangeDropdown, { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import BrandsDropdown from "./BrandsDropdown";
import { guessBrandDomain } from "../lib/brand-domain";
import {
  ChatFact, ChatRecordView, Resolution,
  aggregateBrands, aggregateDomains, totalCitations, toChatRecords,
  buildVisibilitySeries, filterByEngines, filterByDateRange, aggregateByCategory,
} from "../lib/chat-aggregations";

interface ProjectBrand {
  name: string;
  isOwn: boolean;
}

interface Props {
  chatFacts: ChatFact[];
  projectName: string;
  projectBrands: ProjectBrand[];
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

export default function OverviewClient({ chatFacts, projectName, projectBrands }: Props) {
  const [resolution, setResolution] = useState<Resolution>("W");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatRecordView | null>(null);
  const [onlyOwnMentions, setOnlyOwnMentions] = useState(false);

  const ownBrandNames = useMemo(
    () => new Set(projectBrands.filter((b) => b.isOwn).map((b) => b.name)),
    [projectBrands],
  );

  function sentimentDotColor(score: number): string {
    if (score >= 65) return "#10b981";
    if (score >= 50) return "#eab308";
    if (score > 0) return "#ef4444";
    return "#cbd5e1";
  }

  function formatTimeAgo(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    if (diffMs < 0) return "just now";
    const hours = Math.floor(diffMs / 3600000);
    if (hours < 1) {
      const mins = Math.max(1, Math.floor(diffMs / 60000));
      return `${mins} min ago`;
    }
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? "1 d ago" : `${days} d ago`;
  }

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

  // Stable color map: assign once based on full unfiltered top brands so colors
  // don't reshuffle when the user toggles engines.
  const stableBrandColors = useMemo(() => {
    const all = aggregateBrands(chatFacts, 20);
    const map: Record<string, string> = {};
    for (const b of all) map[b.name] = b.color;
    return map;
  }, [chatFacts]);

  // ── Filtered derivations ──────────────────────────────────────────────
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
    return records.slice(0, 50);
  }, [filteredChats]);

  const visibleRecentChats = useMemo(() => {
    if (!onlyOwnMentions) return recentChats;
    if (ownBrandNames.size === 0) return recentChats;
    return recentChats.filter((c) =>
      c.brandsFound.some((name) => ownBrandNames.has(name)),
    );
  }, [recentChats, onlyOwnMentions, ownBrandNames]);

  const totalMentions = brands.reduce((s, b) => s + b.count, 0);
  const maxDomainCount = domains.length > 0 ? domains[0].count : 1;

  const categoryStats = useMemo(
    () => aggregateByCategory(filteredChats, (cat, dom) => getCategoryLabel(cat, dom, projectName)),
    [filteredChats, projectName],
  );
  const totalTypeCounts = Object.values(categoryStats).reduce((s, v) => s + v.count, 0);

  return (
    <div className="prompt-detail-page">
      {selectedChat && <ChatModal chat={selectedChat} onClose={() => setSelectedChat(null)} />}
      <div className="pd-topbar">
        <div className="pd-breadcrumb">
          <a href="/" className="pd-breadcrumb-link">Dashboard</a>
          <span className="pd-breadcrumb-sep">&gt;</span>
          <span className="pd-breadcrumb-current">Overview</span>
        </div>
        <button className="pd-settings-btn">
          <Settings size={14} />
          Settings
        </button>
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
                        <DomainFavicon domain={guessBrandDomain(b.name)} size={16} />
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
                  <tr><td colSpan={6} className="pd-empty">No brands extracted yet</td></tr>
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
                  const typeLabel = getCategoryLabel(d.category, d.domain, projectName);
                  return (
                    <tr key={i}>
                      <td className="pd-domain-cell">
                        <DomainFavicon domain={d.domain} size={16} />
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
            <p className="pd-section-subtitle">Your latest AI responses across all prompts.</p>
          </div>
          <button
            type="button"
            className={`pd-recent-toggle ${onlyOwnMentions ? "pd-recent-toggle-on" : ""}`}
            onClick={() => setOnlyOwnMentions((v) => !v)}
            disabled={ownBrandNames.size === 0}
            title={
              ownBrandNames.size === 0
                ? "Mark a brand as 'own' on the Brands page to enable this filter"
                : `Show only chats mentioning ${projectName}`
            }
          >
            <span className="pd-recent-toggle-label">
              {projectName} mentioned
            </span>
            <span className="pd-recent-toggle-track">
              <span className="pd-recent-toggle-thumb" />
            </span>
          </button>
        </div>

        {visibleRecentChats.length === 0 ? (
          <div className="pd-empty-chats">
            {onlyOwnMentions
              ? `🔍 No recent chats mention ${projectName} yet.`
              : "🔍 No recent chats recorded yet."}
          </div>
        ) : (
          <div className="pd-recent-chats-scroll custom-scrollbar">
            {visibleRecentChats.map((chat) => {
              const timeAgo = formatTimeAgo(chat.runDate);
              const snippet = chat.rawResponse ? chat.rawResponse.slice(0, 150) + "..." : "No response content...";
              const ownMentioned = chat.brandsFound.some((n) => ownBrandNames.has(n));

              return (
                <div
                  key={chat.id}
                  className="pd-chat-card"
                  onClick={() => setSelectedChat(chat)}
                >
                  <div className="pd-chat-card-header">
                    <EngineIcon engine={chat.engine} />
                    <span className="pd-chat-engine-name">{chat.engine}</span>
                    {ownMentioned && chat.avgPosition > 0 && (
                      <span className="pd-chat-position">
                        #{chat.avgPosition.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="pd-chat-query">{chat.query}</div>
                  <div className="pd-chat-snippet">{snippet}</div>
                  <div className="pd-chat-footer">
                    <div className="pd-chat-mentions">
                      {chat.brandsFound.slice(0, 3).map((b) => (
                        <DomainFavicon
                          key={b}
                          domain={guessBrandDomain(b)}
                          size={18}
                        />
                      ))}
                      {chat.brandsFound.length > 3 && (
                        <span className="pd-mention-more">+{chat.brandsFound.length - 3}</span>
                      )}
                      {chat.avgSentiment > 0 && (
                        <span
                          className="pd-chat-sentiment"
                          style={{ background: sentimentDotColor(chat.avgSentiment) }}
                          title={`Sentiment ${chat.avgSentiment.toFixed(0)}`}
                        >
                          {chat.avgSentiment.toFixed(0)}
                        </span>
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
