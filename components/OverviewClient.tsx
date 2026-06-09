"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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
import BrandColorPicker from "./BrandColorPicker";

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
  brandColorOverrides?: Record<string, string>;
  onBrandColorChange?: (brandName: string, color: string) => void;
}

export default function OverviewClient({
  chatFacts, projectName, projectBrands, externalFilters,
  initialDomainTypeOverrides, updateDomainTypeOverrideAction,
  brandColorOverrides = {}, onBrandColorChange,
}: Props) {
  const [resolution, setResolution]   = useState<Resolution>("W");
  const [chartView, setChartView]     = useState<"line" | "bar">("line");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatRecordView | null>(null);
  const [onlyOwnMentions, setOnlyOwnMentions] = useState(false);
  const [selectedDomainType, setSelectedDomainType] = useState<string | null>(null);
  const [typeOverrides, setTypeOverrides] = useState<Map<string, string>>(() =>
    new Map(Object.entries(initialDomainTypeOverrides ?? {}))
  );
  const [openTypeDropdown, setOpenTypeDropdown] = useState<string | null>(null);

  // ── Top 7 Brands indicator mode ───────────────────────────────────────────
  type IndicatorMode = "default" | "indicators-only" | "none";
  const [indicatorMode, setIndicatorMode]     = useState<IndicatorMode>("default");
  const [indicatorPanelOpen, setIndicatorPanelOpen] = useState(false);
  const indicatorPanelRef                     = useRef<HTMLDivElement>(null);

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
      if (indicatorPanelRef.current && !indicatorPanelRef.current.contains(e.target as Node))
        setIndicatorPanelOpen(false);
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

  // ── Brand color picker + hover state ─────────────────────────────────────
  const [pickerInfo, setPickerInfo] = useState<{ name: string; pos: { top: number; left: number } } | null>(null);
  const [hoveredBrand, setHoveredBrand] = useState<string | null>(null);

  function openPickerAt(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (pickerInfo?.name === name) { setPickerInfo(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const top  = window.innerHeight - rect.bottom > 300 ? rect.bottom + 8 : rect.top - 300;
    const left = Math.max(8, Math.min(rect.left - 90, window.innerWidth - 230));
    setPickerInfo({ name, pos: { top, left } });
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

  // Stable color map: palette colors merged with DB-saved colors (DB takes priority)
  const stableBrandColors = useMemo(() => {
    const all = aggregateBrands(chatFacts, 20);
    const map: Record<string, string> = {};
    for (const b of all) map[b.name] = b.color;
    return { ...map, ...brandColorOverrides }; // saved colors override palette
  }, [chatFacts, brandColorOverrides]);

  // ── Filtered derivations ──────────────────────────────────────────────
  const filteredChats = useMemo(
    () => filterByDateRange(filterByEngines(chatFacts, effectiveModels), effectiveDateRange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatFacts, effectiveModels, effectiveDateRange],
  );

  // All brands (no slice) — needed for correct SOV denominator
  const allBrands = useMemo(
    () => aggregateBrands(filteredChats, 9999, undefined, stableBrandColors),
    [filteredChats, stableBrandColors]
  );
  const totalAllBrandCount = useMemo(
    () => allBrands.reduce((s, b) => s + b.count, 0),
    [allBrands]
  );

  const brands = useMemo(() => {
    const filtered = effectiveBrandIds === null
      ? allBrands
      : allBrands.filter((b) => effectiveBrandIds.includes(b.name));
    return filtered.slice(0, 7);
  }, [allBrands, effectiveBrandIds]);

  const domains = useMemo(() => aggregateDomains(filteredChats, 10), [filteredChats]);
  const totalDomainCitations = useMemo(() => totalCitations(filteredChats), [filteredChats]);

  const chartData = useMemo(
    () => buildVisibilitySeries(filteredChats, brands.map((b) => b.name), resolution, effectiveDateRange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredChats, brands, resolution, effectiveDateRange],
  );

  // Bar chart: aggregated visibility per brand over full date range
  const barData = useMemo(() => {
    const total = filteredChats.length;
    return brands.map(b => ({
      name:   b.name,
      value:  total > 0 ? Math.round((b.count / total) * 100) : 0,
      color:  b.color,
      domain: guessBrandDomain(b.name),
    }));
  }, [brands, filteredChats]);

  // Prompts per date for tooltip footer
  const promptsPerDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of filteredChats) {
      const d = c.runDate.slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return map;
  }, [filteredChats]);

  // Dynamic "Showing data for X days" label
  const daysLabel = useMemo(() => {
    const diff = Math.round(
      (effectiveDateRange.end.getTime() - effectiveDateRange.start.getTime()) / 86400000
    );
    return `Showing data for ${diff} day${diff !== 1 ? "s" : ""}`;
  }, [effectiveDateRange]);

  // ── Previous period (for delta calculations) ──────────────────────────────
  const prevDateRange = useMemo(() => {
    const duration = effectiveDateRange.end.getTime() - effectiveDateRange.start.getTime();
    const prevEnd   = new Date(effectiveDateRange.start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return { start: prevStart, end: prevEnd };
  }, [effectiveDateRange]);

  const prevFilteredChats = useMemo(
    () => filterByDateRange(filterByEngines(chatFacts, effectiveModels), prevDateRange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatFacts, effectiveModels, prevDateRange],
  );

  const prevBrands = useMemo(
    () => aggregateBrands(prevFilteredChats, 50, undefined, stableBrandColors),
    [prevFilteredChats, stableBrandColors]
  );

  // Pre-compute prev period totals ONCE — not inside .map() per row
  const prevAllBrandCountMemo = useMemo(
    () => prevBrands.reduce((s, b) => s + b.count, 0),
    [prevBrands]
  );
  const prevTotalChatsMemo = prevFilteredChats.length;

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

  // ── Pinned own brand (Peec AI behavior) ──────────────────────────────────
  // If no own brand is in the top-7 list, find it in allBrands and pin it at bottom
  // with its REAL rank from allBrands (sorted by count descending).
  const pinnedOwnBrand = useMemo(() => {
    const ownBrandInTop7 = sortedBrands.some(b => ownBrandNames.has(b.name));
    if (ownBrandInTop7) return null; // already visible, no need to pin

    // allBrands sorted by count desc (same as aggregateBrands output)
    const allSorted = [...allBrands].sort((a, b) => b.count - a.count);
    const ownIdx    = allSorted.findIndex(b => ownBrandNames.has(b.name));
    if (ownIdx === -1) return null; // no own brand in data at all

    return { brand: allSorted[ownIdx], rank: ownIdx + 1 };
  }, [sortedBrands, allBrands, ownBrandNames]);

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
            {/* ── Chart header ──────────────────────────────── */}
            <div className="pd-chart-header">
              <div className="pd-chart-label">
                Visibility <InfoTooltip text="Brand visibility over time — % of chats mentioning each brand." />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* D/W/M only visible in line view */}
                {chartView === "line" && (
                  <div className="pd-resolution-toggle">
                    {(["D", "W", "M"] as const).map((r) => (
                      <button key={r} className={`pd-res-btn ${resolution === r ? "pd-res-active" : ""}`}
                        onClick={() => setResolution(r)}>{r}</button>
                    ))}
                  </div>
                )}
                {/* "..." menu placeholder */}
                <button className="ch-dots-btn" title="Chart options">···</button>
              </div>
            </div>

            {/* ── Chart body ────────────────────────────────── */}
            <ResponsiveContainer width="100%" height={248}>
              {chartView === "line" ? (
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="rgba(0,0,0,0.05)"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tickLine={false}
                    dy={6}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, "auto"]}
                    tickFormatter={(v) => `${v}%`}
                    width={36}
                  />
                  <Tooltip
                    wrapperStyle={{ zIndex: 100, pointerEvents: "none" }}
                    position={{ y: 8 }}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const sorted = [...payload]
                        .filter(p => (p.value as number) > 0)
                        .sort((a, b) => ((b.value as number) ?? 0) - ((a.value as number) ?? 0));
                      const pc = promptsPerDate.get(label as string) ?? 0;
                      return (
                        <div className="ch-tooltip">
                          <div className="ch-tooltip-date">{label}</div>
                          {sorted.map(p => (
                            <div key={p.dataKey as string} className="ch-tooltip-row">
                              <span className="ch-tooltip-dot" style={{ background: p.color as string }} />
                              <DomainFavicon domain={guessBrandDomain(p.dataKey as string)} size={13} />
                              <span className="ch-tooltip-name">{p.dataKey as string}</span>
                              <span className="ch-tooltip-val">{((p.value as number) ?? 0).toFixed(1)}%</span>
                            </div>
                          ))}
                          {pc > 0 && <div className="ch-tooltip-footer">{pc} new prompts created</div>}
                        </div>
                      );
                    }}
                  />
                  {brands.map((b) => {
                    const isHov = hoveredBrand === b.name;
                    const faded = hoveredBrand !== null && !isHov;
                    return (
                      <Line
                        key={b.name}
                        type="monotone"
                        dataKey={b.name}
                        stroke={b.color}
                        strokeWidth={isHov ? 2.8 : 1.8}
                        strokeOpacity={faded ? 0.1 : 1}
                        dot={{ r: isHov ? 3.5 : 2.5, fill: b.color, strokeWidth: 0, fillOpacity: faded ? 0.1 : 1 }}
                        activeDot={{ r: isHov ? 5 : 4, strokeWidth: 0, opacity: faded ? 0 : 1 }}
                        isAnimationActive={false}
                        style={{ transition: "stroke-opacity 0.15s, opacity 0.15s" }}
                      />
                    );
                  })}
                </LineChart>
              ) : (
                <BarChart
                  data={barData}
                  barCategoryGap="28%"
                  margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="rgba(0,0,0,0.05)"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tick={(props) => {
                      const { x, y, payload } = props;
                      const dom = guessBrandDomain(payload.value as string);
                      return (
                        <g transform={`translate(${Number(x)},${Number(y) + 4})`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <image
                            href={`https://www.google.com/s2/favicons?domain=${dom}&sz=32`}
                            x={-10} y={0} width={20} height={20}
                          />
                        </g>
                      );
                    }}
                    height={32}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                    width={36}
                  />
                  <Tooltip
                    wrapperStyle={{ zIndex: 100, pointerEvents: "none" }}
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as { name: string; value: number; domain: string };
                      const diff = Math.round(
                        (effectiveDateRange.end.getTime() - effectiveDateRange.start.getTime()) / 86400000
                      );
                      return (
                        <div className="ch-tooltip">
                          <div className="ch-tooltip-bar-header">
                            <span>Visibility</span>
                            <span className="ch-tooltip-days">{diff} days</span>
                          </div>
                          <div className="ch-tooltip-row">
                            <DomainFavicon domain={d.domain} size={14} />
                            <span className="ch-tooltip-name">{d.name}</span>
                            <span className="ch-tooltip-val">{d.value}%</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]} isAnimationActive={false}>
                    {barData.map((e) => {
                      const faded = hoveredBrand !== null && hoveredBrand !== e.name;
                      return <Cell key={e.name} fill={e.color} fillOpacity={faded ? 0.12 : 1} />;
                    })}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>

            {/* ── Chart footer ──────────────────────────────── */}
            <div className="pd-chart-footer">
              <span>{daysLabel}</span>
              <div className="ch-view-toggle">
                {/* Line chart icon */}
                <button
                  className={`ch-view-btn ${chartView === "line" ? "ch-view-btn--active" : ""}`}
                  onClick={() => setChartView("line")}
                  title="Line chart"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="22 12 18 8 13 13 8 8 2 14" />
                  </svg>
                </button>
                {/* Bar chart icon */}
                <button
                  className={`ch-view-btn ${chartView === "bar" ? "ch-view-btn--active" : ""}`}
                  onClick={() => setChartView("bar")}
                  title="Bar chart"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="2"  y="10" width="4" height="12" rx="1"/>
                    <rect x="9"  y="6"  width="4" height="16" rx="1"/>
                    <rect x="16" y="2"  width="4" height="20" rx="1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="pd-brands-card" onClick={() => setOpenBrandMenu(null)}>
            <div className="pd-brands-header">
              <span className="pd-brands-title">Top 7 Brands <InfoTooltip text="Top brands across LLMs for your prompts" /></span>
              {/* ⚙ ↑ ↺ icons matching Peec AI */}
              <div className="pd-brands-actions">
                {/* ⚙ Settings — opens "Change indicators" panel */}
                <div ref={indicatorPanelRef} style={{ position: "relative" }}>
                  <button
                    className={`pd-brands-action-btn ${indicatorPanelOpen ? "pd-brands-action-btn--active" : ""}`}
                    title="Change indicators"
                    onClick={() => setIndicatorPanelOpen(v => !v)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                  </button>

                  {/* Change indicators panel */}
                  {indicatorPanelOpen && (
                    <div className="pd-indicator-panel">
                      <div className="pd-indicator-title">Change indicators</div>
                      {([
                        { value: "default",         icon: "⊙", label: "Default" },
                        { value: "indicators-only", icon: "↕", label: "Indicators only" },
                        { value: "none",            icon: "T", label: "None" },
                      ] as { value: IndicatorMode; icon: string; label: string }[]).map(opt => (
                        <div
                          key={opt.value}
                          className={`pd-indicator-option ${indicatorMode === opt.value ? "pd-indicator-option--active" : ""}`}
                          onClick={() => { setIndicatorMode(opt.value); setIndicatorPanelOpen(false); }}
                        >
                          <span className="pd-indicator-icon">{opt.icon}</span>
                          <span className="pd-indicator-label">{opt.label}</span>
                          {indicatorMode === opt.value && <span className="pd-indicator-check">✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button className="pd-brands-action-btn" title="Export">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </button>
                <button className="pd-brands-action-btn" title="Refresh">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                </button>
              </div>
            </div>
            <table className="pd-brands-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th>Brand</th>
                  {(["visibility", "sov", "sentiment", "position"] as BrandSortCol[]).map((col, colIdx) => {
                    // Dynamic days count for tooltip text
                    const days = Math.round(
                      (effectiveDateRange.end.getTime() - effectiveDateRange.start.getTime()) / 86400000
                    );
                    const labels: Record<BrandSortCol, string> = {
                      visibility: "Visibility",
                      sov: "SOV",
                      sentiment: "Sentiment",
                      position: "Position",
                    };
                    const tooltipTexts: Record<BrandSortCol, string> = {
                      visibility: `The percentage of chats mentioning the brand in the last ${days} days.`,
                      sov: `The brand's mentions divided by the total number of brand mentions across all chats in the last ${days} days.`,
                      sentiment: `The brand's sentiment score when mentioned in the last ${days} days.`,
                      position: `The brand's average position when mentioned in the last ${days} days.`,
                    };
                    const isActive   = brandSortCol === col;
                    const menuOpen   = openBrandMenu === col;
                    // SOV always shows trending arrow (fixed icon in Peec AI)
                    const headerIcon = col === "sov"
                      ? "↗"
                      : isActive
                        ? (brandSortMode === "high-low" || brandSortMode === "negative-trend" ? "↓" : "↑")
                        : "↕";
                    // Right-align sort menu for last 2 columns to avoid overflow
                    const menuRight = colIdx >= 2;
                    return (
                      <th key={col} style={{ position: "relative" }}>
                        <span
                          className={`pd-brands-th-btn ${isActive || menuOpen ? "pd-brands-th-active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); setOpenBrandMenu(menuOpen ? null : col); }}
                        >
                          {labels[col]}
                          <span className={`pd-th-arrow ${col === "sov" ? "pd-th-arrow--trend" : ""}`}>
                            {headerIcon}
                          </span>
                          <InfoTooltip text={tooltipTexts[col]} />
                        </span>

                        {menuOpen && (
                          <div
                            className="pd-brands-sort-menu"
                            style={{ right: menuRight ? 0 : "auto", left: menuRight ? "auto" : 0 }}
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="pd-sort-label">Sort by</div>
                            {([
                              { mode: "high-low",       icon: "↓", label: "Value  High - low" },
                              { mode: "low-high",       icon: "↑", label: "Value  Low - high" },
                              { mode: "positive-trend", icon: "↗", label: "Positive trend" },
                              { mode: "negative-trend", icon: "↘", label: "Negative trend" },
                            ] as { mode: BrandSortMode; icon: string; label: string }[]).map(opt => {
                              const isChecked = brandSortCol === col && brandSortMode === opt.mode;
                              return (
                                <div
                                  key={opt.mode}
                                  className={`pd-sort-option ${isChecked ? "pd-sort-active" : ""}`}
                                  onClick={() => { setBrandSortCol(col); setBrandSortMode(opt.mode); setOpenBrandMenu(null); }}
                                >
                                  <span className="pd-sort-opt-icon">{opt.icon}</span>
                                  <span style={{ flex: 1 }}>{opt.label}</span>
                                  {isChecked && <span className="pd-sort-check">✓</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Show max 6 when own brand is pinned at bottom, otherwise 7 */}
                {(pinnedOwnBrand ? sortedBrands.slice(0, 6) : sortedBrands).map((b, i) => {
                  // Visibility = chats mentioning brand / total chats × 100
                  const totalChats = filteredChats.length;
                  const vis = totalChats > 0 ? Math.round((b.count / totalChats) * 100) : 0;

                  // SOV = brand mentions / ALL brands total mentions × 100
                  const sov = totalAllBrandCount > 0 ? Math.round((b.count / totalAllBrandCount) * 100) : 0;

                  const sent = b.sentiment ? Math.round(b.sentiment) : 0;
                  const dotColor = sentimentDotColor(sent);

                  // Use pre-computed totals (not re-computed per row)
                  const prevAllBrandCount = prevAllBrandCountMemo;
                  const prevTotalChats    = prevTotalChatsMemo;
                  const pb      = prevBrands.find(p => p.name === b.name);
                  const pVis    = prevTotalChats > 0 && pb ? Math.round((pb.count / prevTotalChats) * 100) : 0;
                  const pSov    = prevAllBrandCount > 0 && pb ? Math.round((pb.count / prevAllBrandCount) * 100) : 0;
                  const visDelta = vis - pVis;
                  const sovDelta = sov - pSov;
                  const sentDelta = pb && pb.sentiment ? Math.round(b.sentiment - pb.sentiment) : 0;
                  const posDelta  = pb && pb.position && b.position
                    ? parseFloat((b.position - pb.position).toFixed(1)) : 0;

                  // Render delta based on indicatorMode
                  const showValue = indicatorMode !== "indicators-only";
                  const showDelta = indicatorMode !== "none";

                  const deltaEl = (v: number, fmt: (n: number) => string) =>
                    showDelta && v !== 0 ? (
                      <span className={v > 0 ? "pd-delta-pos" : "pd-delta-neg"}>
                        {v > 0 ? "+" : ""}{fmt(v)}
                      </span>
                    ) : null;

                  return (
                    <tr
                      key={b.name}
                      onMouseEnter={() => setHoveredBrand(b.name)}
                      onMouseLeave={() => setHoveredBrand(null)}
                    >
                      {/* Rank cell — hover shows colored dot, click opens color picker */}
                      <td className="pd-rank">
                        {hoveredBrand === b.name ? (
                          <span
                            className="pd-rank-dot pd-rank-dot--clickable"
                            style={{ background: b.color }}
                            title="Change brand color"
                            onClick={e => openPickerAt(b.name, e)}
                          />
                        ) : (
                          i + 1
                        )}
                        {pickerInfo?.name === b.name && (
                          <BrandColorPicker
                            color={b.color}
                            position={pickerInfo.pos}
                            onChange={color => onBrandColorChange?.(b.name, color)}
                            onClose={() => setPickerInfo(null)}
                          />
                        )}
                      </td>
                      <td className="pd-brand-cell">
                        <DomainFavicon domain={guessBrandDomain(b.name)} size={16} />
                        {b.name}
                      </td>
                      {/* Visibility */}
                      <td>
                        <span className="pd-metric-with-delta">
                          {showValue && <span className="pd-vis-value">{vis}%</span>}
                          {deltaEl(visDelta, n => `${n}%`)}
                        </span>
                      </td>
                      {/* SOV */}
                      <td>
                        <span className="pd-metric-with-delta">
                          {showValue && <span className="pd-vis-value">{sov}%</span>}
                          {deltaEl(sovDelta, n => `${n}%`)}
                        </span>
                      </td>
                      {/* Sentiment */}
                      <td>
                        <span className="pd-sentiment-cell">
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />
                          {showValue && <span className="pd-vis-value">{sent > 0 ? sent : "—"}</span>}
                          {deltaEl(sentDelta, n => `${n > 0 ? "+" : ""}${n}`)}
                        </span>
                      </td>
                      {/* Position */}
                      <td>
                        <span className="pd-metric-with-delta">
                          {showValue && <span>{b.position ? `#${b.position.toFixed(1)}` : "—"}</span>}
                          {deltaEl(posDelta, (n: number) => `${n > 0 ? "+" : ""}${n}`)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {sortedBrands.length === 0 && (
                  <tr><td colSpan={6} className="pd-empty">No brands extracted yet</td></tr>
                )}

                {/* ── Pinned own brand (shows even if outside top 7) ── */}
                {pinnedOwnBrand && (() => {
                  const b   = pinnedOwnBrand.brand;
                  const totalChats     = filteredChats.length;
                  const vis  = totalChats > 0 ? Math.round((b.count / totalChats) * 100) : 0;
                  const sov  = totalAllBrandCount > 0 ? Math.round((b.count / totalAllBrandCount) * 100) : 0;
                  const sent = b.sentiment ? Math.round(b.sentiment) : 0;
                  const dotColor = sentimentDotColor(sent);
                  const prevAllBrandCount = prevAllBrandCountMemo;
                  const prevTotalChats    = prevTotalChatsMemo;
                  const pb       = prevBrands.find(p => p.name === b.name);
                  const pVis     = prevTotalChats > 0 && pb ? Math.round((pb.count / prevTotalChats) * 100) : 0;
                  const pSov     = prevAllBrandCount > 0 && pb ? Math.round((pb.count / prevAllBrandCount) * 100) : 0;
                  const visDelta = vis - pVis;
                  const sovDelta = sov - pSov;
                  const sentDelta = pb && pb.sentiment ? Math.round(b.sentiment - pb.sentiment) : 0;
                  const posDelta  = pb && pb.position && b.position ? parseFloat((b.position - pb.position).toFixed(1)) : 0;
                  const showValue = indicatorMode !== "indicators-only";
                  const showDelta = indicatorMode !== "none";
                  const deltaEl = (v: number, fmt: (n: number) => string) =>
                    showDelta && v !== 0 ? (
                      <span className={v > 0 ? "pd-delta-pos" : "pd-delta-neg"}>
                        {v > 0 ? "+" : ""}{fmt(v)}
                      </span>
                    ) : null;
                  return (
                    <>
                      {/* Separator line */}
                      <tr className="pd-pinned-separator">
                        <td colSpan={6} />
                      </tr>
                      {/* Pinned row with real rank */}
                      <tr
                        className="pd-pinned-row"
                        onMouseEnter={() => setHoveredBrand("__pinned__")}
                        onMouseLeave={() => setHoveredBrand(null)}
                      >
                        <td className="pd-rank">
                          {hoveredBrand === "__pinned__" ? (
                            <span
                              className="pd-rank-dot pd-rank-dot--clickable"
                              style={{ background: b.color }}
                              title="Change brand color"
                              onClick={e => openPickerAt("__pinned__", e)}
                            />
                          ) : (
                            pinnedOwnBrand.rank
                          )}
                          {pickerInfo?.name === "__pinned__" && (
                            <BrandColorPicker
                              color={b.color}
                              position={pickerInfo.pos}
                              onChange={color => onBrandColorChange?.(b.name, color)}
                              onClose={() => setPickerInfo(null)}
                            />
                          )}
                        </td>
                        <td className="pd-brand-cell">
                          <DomainFavicon domain={guessBrandDomain(b.name)} size={16} />
                          {b.name}
                        </td>
                        <td><span className="pd-metric-with-delta">
                          {showValue && <span className="pd-vis-value">{vis}%</span>}
                          {deltaEl(visDelta, n => `${n}%`)}
                        </span></td>
                        <td><span className="pd-metric-with-delta">
                          {showValue && <span className="pd-vis-value">{sov}%</span>}
                          {deltaEl(sovDelta, n => `${n}%`)}
                        </span></td>
                        <td><span className="pd-sentiment-cell">
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />
                          {showValue && <span className="pd-vis-value">{sent > 0 ? sent : "—"}</span>}
                          {deltaEl(sentDelta, n => `${n > 0 ? "+" : ""}${n}`)}
                        </span></td>
                        <td><span className="pd-metric-with-delta">
                          {showValue && <span>{b.position ? `#${b.position.toFixed(1)}` : "—"}</span>}
                          {deltaEl(posDelta, (n: number) => `${n > 0 ? "+" : ""}${n}`)}
                        </span></td>
                      </tr>
                    </>
                  );
                })()}
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
