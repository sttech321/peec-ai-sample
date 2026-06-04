"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
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
import { classifyDomain, DOMAIN_TYPE_COLORS } from "../lib/domain-aggregations";
import TypeDropdown from "./TypeDropdown";
import InfoTooltip from "./InfoTooltip";

interface ProjectBrand {
  name: string;
  isOwn: boolean;
  domains?: string[] | null;
}

export interface OverviewExternalFilters {
  dateRange?: { start: Date; end: Date; preset: string; label: string } | null;
  models?: string[] | null;
  brandIds?: string[] | null;
}

interface Props {
  chatFacts: ChatFact[];
  projectName: string;
  projectBrands: ProjectBrand[];
  externalFilters?: OverviewExternalFilters;
}


export default function OverviewClient({ chatFacts, projectName, projectBrands, externalFilters }: Props) {
  const [resolution, setResolution] = useState<Resolution>("W");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatRecordView | null>(null);
  const [onlyOwnMentions, setOnlyOwnMentions] = useState(false);
  const [selectedDomainType, setSelectedDomainType] = useState<string | null>(null);
  const [typeOverrides, setTypeOverrides] = useState<Map<string, string>>(new Map());
  const [openTypeDropdown, setOpenTypeDropdown] = useState<string | null>(null);

  // ── Top 7 Brands sort state ───────────────────────────────────────────────
  type BrandSortCol  = "visibility" | "sov" | "sentiment" | "position";
  type BrandSortMode = "high-low" | "low-high" | "positive-trend" | "negative-trend";
  const [brandSortCol,  setBrandSortCol]  = useState<BrandSortCol>("visibility");
  const [brandSortMode, setBrandSortMode] = useState<BrandSortMode>("high-low");
  const [openBrandMenu, setOpenBrandMenu] = useState<BrandSortCol | null>(null);

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

  // When external filters are provided, prefer them over internal state
  const effectiveModels = externalFilters?.models ?? selectedModels;
  const effectiveDateRange: DateRangeValue = externalFilters?.dateRange
    ? { ...externalFilters.dateRange, preset: externalFilters.dateRange.preset as DateRangeValue["preset"] }
    : dateRange;
  const effectiveBrandIds = externalFilters !== undefined
    ? (externalFilters.brandIds ?? null)
    : selectedBrands;

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
    () => filterByDateRange(filterByEngines(chatFacts, effectiveModels), effectiveDateRange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatFacts, effectiveModels, effectiveDateRange],
  );

  const brands = useMemo(() => {
    const all = aggregateBrands(filteredChats, 50, undefined, stableBrandColors);
    const filtered = effectiveBrandIds === null
      ? all
      : all.filter((b) => effectiveBrandIds.includes(b.name));
    return filtered.slice(0, 7);
  }, [filteredChats, stableBrandColors, effectiveBrandIds]);

  const domains = useMemo(() => aggregateDomains(filteredChats, 10), [filteredChats]);
  const totalDomainCitations = useMemo(() => totalCitations(filteredChats), [filteredChats]);

  const chartData = useMemo(
    () => buildVisibilitySeries(filteredChats, brands.map((b) => b.name), resolution, effectiveDateRange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredChats, brands, resolution, effectiveDateRange],
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

  const sortedBrands = useMemo(() => {
    const list = [...brands];
    const dir = (brandSortMode === "high-low" || brandSortMode === "negative-trend") ? -1 : 1;
    list.sort((a, b) => {
      if (brandSortCol === "visibility" || brandSortCol === "sov") return dir * (b.count - a.count);
      if (brandSortCol === "sentiment") return dir * ((b.sentiment ?? 0) - (a.sentiment ?? 0));
      if (brandSortCol === "position")  return dir * ((b.position  ?? 0) - (a.position  ?? 0));
      return 0;
    });
    return list;
  }, [brands, brandSortCol, brandSortMode]);

  const ownDomainSet = useMemo(() => {
    const set = new Set<string>();
    for (const b of projectBrands) {
      if (!b.isOwn) continue;
      for (const d of b.domains ?? []) if (d) set.add(d.toLowerCase());
    }
    return set;
  }, [projectBrands]);

  const competitorDomainSet = useMemo(() => {
    const set = new Set<string>();
    for (const b of projectBrands) {
      if (b.isOwn) continue;
      for (const d of b.domains ?? []) if (d) set.add(d.toLowerCase());
    }
    return set;
  }, [projectBrands]);

  const categoryStats = useMemo(
    () => aggregateByCategory(filteredChats, (cat, dom) =>
      typeOverrides.get(dom) ?? classifyDomain(cat, dom, ownDomainSet, competitorDomainSet)
    ),
    [filteredChats, ownDomainSet, competitorDomainSet, typeOverrides],
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

          <div className="pd-brands-card" onClick={() => setOpenBrandMenu(null)}>
            <div className="pd-brands-header">
              <span className="pd-brands-title">Top 7 Brands <InfoTooltip text="Top brands across LLMs for your prompts" /></span>
            </div>
            <table className="pd-brands-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th>Brand</th>
                  {(["visibility", "sov", "sentiment", "position"] as BrandSortCol[]).map((col) => {
                    const labels: Record<BrandSortCol, string> = { visibility: "Visibility", sov: "SOV", sentiment: "Sentiment", position: "Position" };
                    const tooltips: Record<BrandSortCol, string> = {
                      visibility: "The percentage of chats mentioning the brand in the last 30 days.",
                      sov: "The brand's mentions divided by the total number of brand mentions across all chats in the last 30 days.",
                      sentiment: "The brand's sentiment score when mentioned in the last 30 days.",
                      position: "The brand's average position when mentioned in the last 30 days.",
                    };
                    const isActive = brandSortCol === col;
                    const icon = isActive
                      ? (brandSortMode === "high-low" || brandSortMode === "negative-trend" ? "↓" : "↑")
                      : "↕";
                    return (
                      <th key={col} style={{ position: "relative" }}>
                        <span
                          className={`pd-brands-th-btn ${isActive ? "pd-brands-th-active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); setOpenBrandMenu(openBrandMenu === col ? null : col); }}
                        >
                          {labels[col]} <span className="pd-th-arrow">{icon}</span>
                          <InfoTooltip text={tooltips[col]} />
                        </span>
                        {openBrandMenu === col && (
                          <div className="pd-brands-sort-menu" onClick={e => e.stopPropagation()}>
                            <div className="pd-sort-label">Sort by</div>
                            {([
                              { mode: "high-low",       icon: "↓", label: "Value  High - low" },
                              { mode: "low-high",       icon: "↑", label: "Value  Low - high" },
                              { mode: "positive-trend", icon: "↗", label: "Positive trend" },
                              { mode: "negative-trend", icon: "↘", label: "Negative trend" },
                            ] as { mode: BrandSortMode; icon: string; label: string }[]).map(opt => (
                              <div
                                key={opt.mode}
                                className={`pd-sort-option ${brandSortCol === col && brandSortMode === opt.mode ? "pd-sort-active" : ""}`}
                                onClick={() => { setBrandSortCol(col); setBrandSortMode(opt.mode); setOpenBrandMenu(null); }}
                              >
                                <span className="pd-sort-opt-icon">{opt.icon}</span>
                                {opt.label}
                                {brandSortCol === col && brandSortMode === opt.mode && <span className="pd-sort-check">✓</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedBrands.map((b, i) => {
                  const vis = totalMentions > 0 ? Math.round((b.count / totalMentions) * 100) : 0;
                  const sov = vis;
                  const sent = b.sentiment ? Math.round(b.sentiment) : 0;
                  const dotColor = sentimentDotColor(sent);
                  return (
                    <tr key={b.name}>
                      <td className="pd-rank">{i + 1}</td>
                      <td className="pd-brand-cell">
                        <DomainFavicon domain={guessBrandDomain(b.name)} size={16} />
                        {b.name}
                      </td>
                      <td><span className="pd-vis-value">{vis}%</span></td>
                      <td><span className="pd-vis-value">{sov}%</span></td>
                      <td>
                        <span className="pd-sentiment-cell">
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />
                          {sent > 0 ? sent : "—"}
                        </span>
                      </td>
                      <td>{b.position ? `#${b.position.toFixed(1)}` : "—"}</td>
                    </tr>
                  );
                })}
                {sortedBrands.length === 0 && (
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
            <Link href="/domains" className="pd-all-domains-btn">
              All domains
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7"/><path d="M7 7h10v10"/>
              </svg>
            </Link>
          </div>
        </div>

        <div className="pd-domains-grid">
          <div className="pd-domains-table-card">
            <table className="pd-domains-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th><span className="pd-th-tooltip-wrap">Retrieved <InfoTooltip text="Share of chats where at least one URL from this domain appeared as a source." /></span></th>
                  <th><span className="pd-th-tooltip-wrap">Citation rate <InfoTooltip text="Average number of inline citations when a URL from this domain is retrieved as a source." /></span></th>
                  <th><span className="pd-th-tooltip-wrap">Type <InfoTooltip text="The type of website for this domain." /></span></th>
                </tr>
              </thead>
              <tbody>
                {(selectedDomainType
                  ? domains.filter(d => (typeOverrides.get(d.domain) ?? classifyDomain(d.category, d.domain, ownDomainSet, competitorDomainSet)) === selectedDomainType)
                  : domains
                ).slice(0, 8).map((d, i) => {
                  const pct = ((d.count / maxDomainCount) * 100).toFixed(1);
                  const rate = (d.count / Math.max(totalDomainCitations, 1)).toFixed(1);
                  const defaultType = classifyDomain(d.category, d.domain, ownDomainSet, competitorDomainSet);
                  const typeLabel = typeOverrides.get(d.domain) ?? defaultType;
                  return (
                    <tr key={i}>
                      <td className="pd-domain-cell">
                        <DomainFavicon domain={d.domain} size={16} />
                        {d.domain}
                      </td>
                      <td>{pct}%</td>
                      <td>{rate}</td>
                      <td style={{ position: "relative" }}>
                        <span
                          className={`pd-type-badge pd-type-${typeLabel.toLowerCase()}`}
                          style={{ cursor: "pointer", userSelect: "none" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenTypeDropdown(openTypeDropdown === d.domain ? null : d.domain);
                          }}
                        >
                          {typeLabel}
                        </span>
                        {openTypeDropdown === d.domain && (
                          <TypeDropdown
                            domain={d.domain}
                            currentType={typeLabel}
                            defaultType={defaultType}
                            onSelect={(type) => setTypeOverrides((prev) => new Map(prev).set(d.domain, type))}
                            onReset={() => setTypeOverrides((prev) => { const m = new Map(prev); m.delete(d.domain); return m; })}
                            onClose={() => setOpenTypeDropdown(null)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {domains.length === 0 && <tr><td colSpan={4} className="pd-empty">No domains found.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="pd-domain-types-card urls-types-card">
            <div className="urls-types-header">
              <div className="urls-chart-title">Domain types</div>
              <div className="urls-types-total">
                <InfoTooltip text="Distribution of domain types in AI retrievals." />
                Total retrievals: {totalDomainCitations.toLocaleString()}
              </div>
            </div>
            <div className="urls-types-list">
              {(["Corporate", "UGC", "Other", "Reference", "You", "Competitor", "Editorial", "Institutional", "Related"] as const).map((type) => {
                const color = (DOMAIN_TYPE_COLORS as Record<string, string>)[type] || "#64748b";
                const stats = categoryStats[type] || { count: 0, topSources: [] };
                const pct = totalTypeCounts > 0 ? Math.round((stats.count / totalTypeCounts) * 100) : 0;
                return (
                  <div
                    key={type}
                    className={`urls-type-row ${selectedDomainType === type ? "active" : ""}`}
                    onClick={() => setSelectedDomainType(selectedDomainType === type ? null : type)}
                  >
                    <span className="urls-type-bar">
                      <span className="urls-type-bar-fill" style={{ width: `${Math.max(2, pct)}%`, background: color }} />
                      <span className="urls-type-bar-label">
                        <span className="urls-type-dot" style={{ background: color }} />
                        {type}
                      </span>
                    </span>
                    <span className="urls-type-pct">{pct}%</span>
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
