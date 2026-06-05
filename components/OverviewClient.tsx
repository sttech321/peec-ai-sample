"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
import ChatFilterDropdown from "./ChatFilterDropdown";

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
  initialDomainTypeOverrides?: Record<string, string>;
  updateDomainTypeOverrideAction?: (domain: string, type: string | null) => Promise<{ ok: boolean; error?: string }>;
}

export default function OverviewClient({ chatFacts, projectName, projectBrands, externalFilters, initialDomainTypeOverrides, updateDomainTypeOverrideAction }: Props) {
  const [resolution, setResolution] = useState<Resolution>("W");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatRecordView | null>(null);
  const [onlyOwnMentions, setOnlyOwnMentions] = useState(false);
  const [selectedDomainType, setSelectedDomainType] = useState<string | null>(null);
  const [typeOverrides, setTypeOverrides] = useState<Map<string, string>>(() =>
    new Map(Object.entries(initialDomainTypeOverrides ?? {}))
  );
  const [openTypeDropdown, setOpenTypeDropdown] = useState<string | null>(null);

  // ── All Chats section state ───────────────────────────────────────────────
  const CHAT_PAGE_SIZE = 10;
  const [chatPage, setChatPage]                   = useState(1);
  const [chatBrandFilters, setChatBrandFilters]   = useState<Set<string>>(new Set());
  const [chatSourceFilters, setChatSourceFilters] = useState<Set<string>>(new Set());
  const [chatFeatureFilters, setChatFeatureFilters] = useState<Set<string>>(new Set());
  const [colSettingsOpen, setColSettingsOpen]     = useState(false);
  const colSettingsRef                            = useRef<HTMLDivElement>(null);

  const DEFAULT_COLS = { mentions: true, sources: true, features: true, position: true, created: true, citations: false };
  const [visibleCols, setVisibleCols] = useState({ ...DEFAULT_COLS });

  function toggleCol(col: keyof typeof visibleCols) {
    setVisibleCols(prev => ({ ...prev, [col]: !prev[col] }));
  }

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (colSettingsRef.current && !colSettingsRef.current.contains(e.target as Node))
        setColSettingsOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function handleTypeOverride(domain: string, type: string) {
    setTypeOverrides(prev => new Map(prev).set(domain, type));
    await updateDomainTypeOverrideAction?.(domain, type);
  }

  async function handleTypeReset(domain: string) {
    setTypeOverrides(prev => { const m = new Map(prev); m.delete(domain); return m; });
    await updateDomainTypeOverrideAction?.(domain, null);
  }

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
    return records; // no hard cap — pagination handles display
  }, [filteredChats]);

  const filteredChatRows = useMemo(() => {
    let list = recentChats;
    if (onlyOwnMentions && ownBrandNames.size > 0)
      list = list.filter((c) => c.brandsFound.some((n) => ownBrandNames.has(n)));
    if (chatBrandFilters.size > 0)
      list = list.filter((c) => c.brandsFound.some(b => chatBrandFilters.has(b)));
    if (chatSourceFilters.size > 0)
      list = list.filter((c) => c.sourcesFound.some(s => chatSourceFilters.has(s.domain)));
    return list;
  }, [recentChats, onlyOwnMentions, ownBrandNames, chatBrandFilters, chatSourceFilters]);

  const chatTotalPages   = Math.max(1, Math.ceil(filteredChatRows.length / CHAT_PAGE_SIZE));
  const visibleRecentChats = useMemo(() => {
    const start = (chatPage - 1) * CHAT_PAGE_SIZE;
    return filteredChatRows.slice(start, start + CHAT_PAGE_SIZE);
  }, [filteredChatRows, chatPage, CHAT_PAGE_SIZE]);

  // Unique brands + sources for section filter dropdowns
  const allChatBrands  = useMemo(() => [...new Set(recentChats.flatMap(c => c.brandsFound))].sort(), [recentChats]);
  const allChatSources = useMemo(() => [...new Set(recentChats.flatMap(c => c.sourcesFound.map(s => s.domain)))].sort(), [recentChats]);

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
                            onSelect={(type) => handleTypeOverride(d.domain, type)}
                            onReset={() => handleTypeReset(d.domain)}
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

      {/* ── All Chats ────────────────────────────────────────────────── */}
      <div className="pd-section ac-section">
        {/* Header row */}
        <div className="ac-header">
          <div>
            <h2 className="pd-section-title">All Chats</h2>
            <p className="pd-section-subtitle">All chats for your prompts</p>
          </div>
          <div className="ac-filters">
            {/* All Brands — multi-select searchable */}
            <ChatFilterDropdown
              label="All Brands"
              items={allChatBrands}
              selected={chatBrandFilters}
              onChange={(v) => { setChatBrandFilters(v); setChatPage(1); }}
              searchable
            />

            {/* All Features — multi-select with Or/And toggle */}
            <ChatFilterDropdown
              label="All Features"
              items={["Shopping", "Product Comparison", "Ads", "Map", "Web Search", "No features"]}
              selected={chatFeatureFilters}
              onChange={(v) => { setChatFeatureFilters(v); setChatPage(1); }}
              featuresMode
            />

            {/* All Sources — multi-select searchable */}
            <ChatFilterDropdown
              label="All Sources"
              items={allChatSources}
              selected={chatSourceFilters}
              onChange={(v) => { setChatSourceFilters(v); setChatPage(1); }}
              searchable
            />

            {/* Column settings icon */}
            <div ref={colSettingsRef} style={{ position: "relative" }}>
              <button
                className={`ac-col-btn ${colSettingsOpen ? "ac-col-btn--active" : ""}`}
                onClick={() => setColSettingsOpen(v => !v)}
                title="Column settings"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                </svg>
              </button>

              {colSettingsOpen && (
                <div className="ac-col-panel">
                  {/* Fixed columns */}
                  <div className="ac-col-group-label">Fixed columns</div>
                  <div className="ac-col-row ac-col-row--fixed">
                    <span className="ac-col-dot" />
                    <span className="ac-col-name">Chat</span>
                  </div>

                  {/* Active columns */}
                  <div className="ac-col-group-label">Active columns</div>
                  {(["mentions","sources","features","position","created"] as const).map(col => (
                    <div key={col} className="ac-col-row" onClick={() => toggleCol(col)}>
                      <span className={`ac-col-checkbox ${visibleCols[col] ? "ac-col-checkbox--on" : ""}`}>
                        {visibleCols[col] && <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>}
                      </span>
                      <span className="ac-col-name" style={{ textTransform: "capitalize" }}>{col}</span>
                    </div>
                  ))}

                  {/* Available columns */}
                  <div className="ac-col-group-label">Available columns</div>
                  <div className="ac-col-row" onClick={() => toggleCol("citations")}>
                    <span className={`ac-col-checkbox ${visibleCols.citations ? "ac-col-checkbox--on" : ""}`}>
                      {visibleCols.citations && <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>}
                    </span>
                    <span className="ac-col-name">Citations</span>
                  </div>

                  {/* Reset */}
                  <div className="ac-col-separator" />
                  <button className="ac-col-reset" onClick={() => setVisibleCols({ ...DEFAULT_COLS })}>
                    Reset to default
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Count row */}
        <div className="ac-count-row">
          <span className="ac-count">
            {filteredChatRows.length === 0 ? "0 chats" : (
              <>
                <strong>{(chatPage - 1) * CHAT_PAGE_SIZE + 1}</strong>
                {" to "}
                <strong>{Math.min(chatPage * CHAT_PAGE_SIZE, filteredChatRows.length)}</strong>
                {" of "}
                <strong>{filteredChatRows.length.toLocaleString()}</strong>
                {" chats"}
              </>
            )}
          </span>
        </div>

        {/* Table */}
        {filteredChatRows.length === 0 ? (
          <div className="pd-empty-chats">🔍 No chats match your filters.</div>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th className="ac-th-chat">Chat</th>
                  {visibleCols.mentions   && <th className="ac-th-mentions">Mentions</th>}
                  {visibleCols.sources    && <th className="ac-th-sources">Sources</th>}
                  {visibleCols.features   && <th className="ac-th-sources">Features</th>}
                  {visibleCols.citations  && <th className="ac-th-mentions">Citations</th>}
                  {visibleCols.position   && <th className="ac-th-position">Position</th>}
                  {visibleCols.created    && <th className="ac-th-created">Created</th>}
                </tr>
              </thead>
              <tbody>
                {visibleRecentChats.map((chat) => {
                  const snippet = chat.rawResponse ? chat.rawResponse.slice(0, 180) : "No response content.";
                  const timeAgo = formatTimeAgo(chat.runDate);
                  const extra   = chat.brandsFound.length - 4;
                  return (
                    <tr key={chat.id} className="ac-row" onClick={() => setSelectedChat(chat)}>

                      {/* Chat — always visible */}
                      <td className="ac-td-chat">
                        <div className="ac-chat-engine">
                          <EngineIcon engine={chat.engine} />
                        </div>
                        <div className="ac-chat-text">
                          <div className="ac-chat-query">{chat.query || "—"}</div>
                          <div className="ac-chat-snippet">{snippet}</div>
                        </div>
                      </td>

                      {/* Mentions */}
                      {visibleCols.mentions && (
                        <td className="ac-td-mentions">
                          <div className="ac-icons-row">
                            {chat.brandsFound.slice(0, 4).map((b) => (
                              <DomainFavicon key={b} domain={guessBrandDomain(b)} size={18} />
                            ))}
                            {extra > 0 && <span className="ac-more">+{extra}</span>}
                          </div>
                        </td>
                      )}

                      {/* Sources */}
                      {visibleCols.sources && (
                        <td className="ac-td-sources">
                          <div className="ac-icons-row">
                            {chat.sourcesFound.slice(0, 4).map((s, i) => (
                              <DomainFavicon key={i} domain={s.domain} size={18} />
                            ))}
                            {chat.sourcesFound.length > 4 && (
                              <span className="ac-more">+{chat.sourcesFound.length - 4}</span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Features (placeholder) */}
                      {visibleCols.features && (
                        <td className="ac-td-sources">
                          <span className="ac-more" style={{ color: "#9ca3af" }}>—</span>
                        </td>
                      )}

                      {/* Citations (placeholder) */}
                      {visibleCols.citations && (
                        <td className="ac-td-mentions">
                          <span className="ac-more" style={{ color: "#9ca3af" }}>—</span>
                        </td>
                      )}

                      {/* Position */}
                      {visibleCols.position && (
                        <td className="ac-td-position">
                          {chat.avgPosition > 0 ? chat.avgPosition.toFixed(1) : "—"}
                        </td>
                      )}

                      {/* Created */}
                      {visibleCols.created && (
                        <td className="ac-td-created">{timeAgo}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {chatTotalPages > 1 && (
          <div className="ac-pagination">
            <span className="ac-page-count">
              {(chatPage - 1) * CHAT_PAGE_SIZE + 1}–{Math.min(chatPage * CHAT_PAGE_SIZE, filteredChatRows.length)} of {filteredChatRows.length.toLocaleString()}
            </span>
            <div className="ac-page-buttons">
              <button className="ac-page-btn" disabled={chatPage === 1} onClick={() => setChatPage(1)}>«</button>
              <button className="ac-page-btn" disabled={chatPage === 1} onClick={() => setChatPage(p => p - 1)}>‹</button>
              {Array.from({ length: Math.min(5, chatTotalPages) }, (_, i) => {
                let p = i + 1;
                if (chatTotalPages > 5) {
                  if (chatPage <= 3) p = i + 1;
                  else if (chatPage >= chatTotalPages - 2) p = chatTotalPages - 4 + i;
                  else p = chatPage - 2 + i;
                }
                return (
                  <button
                    key={p}
                    className={`ac-page-btn ${chatPage === p ? "ac-page-btn--active" : ""}`}
                    onClick={() => setChatPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              {chatTotalPages > 5 && chatPage < chatTotalPages - 2 && <span className="ac-page-ellipsis">…</span>}
              {chatTotalPages > 5 && (
                <button
                  className={`ac-page-btn ${chatPage === chatTotalPages ? "ac-page-btn--active" : ""}`}
                  onClick={() => setChatPage(chatTotalPages)}
                >
                  {chatTotalPages}
                </button>
              )}
              <button className="ac-page-btn" disabled={chatPage === chatTotalPages} onClick={() => setChatPage(p => p + 1)}>›</button>
              <button className="ac-page-btn" disabled={chatPage === chatTotalPages} onClick={() => setChatPage(chatTotalPages)}>»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
