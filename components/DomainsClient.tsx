"use client";

import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import EngineIcon from "./EngineIcon";
import DomainFavicon from "./DomainFavicon";
import DateRangeDropdown, { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import BrandsDropdown from "./BrandsDropdown";
import { ChatFact, Resolution, filterByEngines, filterByDateRange } from "../lib/chat-aggregations";
import {
  aggregateDomainsFull,
  buildDomainShareSeries,
  buildDomainCountSeries,
  classifyDomain,
  DOMAIN_TYPES,
  DOMAIN_TYPE_COLORS,
  DomainType,
  totalCitations,
} from "../lib/domain-aggregations";
import TypeDropdown from "./TypeDropdown";

interface ProjectBrand {
  name: string;
  isOwn: boolean;
}

interface Props {
  chatFacts: ChatFact[];
  projectName: string;
  projectBrands: ProjectBrand[];
  ownDomains: string[];
  competitorDomains: string[];
  externalDateRange?: DateRangeValue;
  externalModels?: string[];
}

const PAGE_SIZE = 20;
const LINE_COLORS = ["#7c4a1e", "#f97316", "#a855f7", "#ef4444", "#475569"];

function previousPeriod(range: DateRangeValue): { start: Date; end: Date } {
  const span = range.end.getTime() - range.start.getTime();
  return {
    end: new Date(range.start.getTime() - 1),
    start: new Date(range.start.getTime() - 1 - span),
  };
}

function formatDeltaPct(diff: number): { text: string; tone: "up" | "down" | "flat" } {
  if (!isFinite(diff) || Math.abs(diff) < 0.05) return { text: "0.0%", tone: "flat" };
  const sign = diff > 0 ? "+" : "";
  return {
    text: `${sign}${diff.toFixed(1)}%`,
    tone: diff > 0 ? "up" : "down",
  };
}

function formatDeltaRate(diff: number): { text: string; tone: "up" | "down" | "flat" } {
  if (!isFinite(diff) || Math.abs(diff) < 0.05) return { text: "0.0", tone: "flat" };
  const sign = diff > 0 ? "+" : "";
  return {
    text: `${sign}${diff.toFixed(1)}`,
    tone: diff > 0 ? "up" : "down",
  };
}

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function shortDomainLabel(domain: string): string {
  // Display the second-level label like "thriveagency" from "thriveagency.com"
  const parts = domain.split(".");
  if (parts.length < 2) return domain;
  return parts[parts.length - 2];
}

type SortKey = "rank" | "domain" | "retrieved" | "retrievalRate" | "citationRate";

export default function DomainsClient({
  chatFacts,
  projectName,
  projectBrands,
  ownDomains,
  competitorDomains,
  externalDateRange,
  externalModels,
}: Props) {
  const [resolution, setResolution] = useState<Resolution>("W");
  const [internalDateRange, setInternalDateRange] = useState<DateRangeValue>(() => makePresetRange("30"));
  // Legend hover + hidden domains
  const [hoveredDomain, setHoveredDomain] = useState<string | null>(null);
  const [hiddenDomains, setHiddenDomains] = useState<Set<string>>(new Set());
  // Use external filter (from PageFilterBar) if provided, otherwise internal
  const dateRange = externalDateRange ?? internalDateRange;
  const [selectedBrands, setSelectedBrands] = useState<string[] | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [domainTypeFilter, setDomainTypeFilter] = useState<DomainType | null>(null);
  const [domainTypeOpen, setDomainTypeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("retrieved");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [moverTab, setMoverTab] = useState<"top" | "trending" | "losing" | "new">("top");
  const [gapAnalysis, setGapAnalysis] = useState(false);
  const [typeOverrides, setTypeOverrides] = useState<Map<string, string>>(new Map());
  const [openTypeDropdown, setOpenTypeDropdown] = useState<string | null>(null);

  const allEngines = useMemo(() => {
    const set = new Set<string>();
    for (const c of chatFacts) set.add(c.engine);
    return Array.from(set);
  }, [chatFacts]);
  const [internalModels, setInternalModels] = useState<string[]>(allEngines);
  // Use external models filter if provided, otherwise internal
  const selectedModels = externalModels?.length ? externalModels : internalModels;

  const toggleModel = (m: string) => {
    setInternalModels((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  };

  const ownDomainSet = useMemo(() => new Set(ownDomains), [ownDomains]);
  const competitorDomainSet = useMemo(() => new Set(competitorDomains), [competitorDomains]);

  const filteredCurrent = useMemo(
    () => filterByDateRange(filterByEngines(chatFacts, selectedModels), dateRange),
    [chatFacts, selectedModels, dateRange],
  );
  const filteredPrevious = useMemo(() => {
    if (dateRange.preset === "all") return [];
    return filterByDateRange(
      filterByEngines(chatFacts, selectedModels),
      previousPeriod(dateRange),
    );
  }, [chatFacts, selectedModels, dateRange]);

  // ── Aggregate
  const allDomains = useMemo(
    () => aggregateDomainsFull(filteredCurrent, filteredPrevious),
    [filteredCurrent, filteredPrevious],
  );

  const domainTypeFor = useMemo(() => {
    const map = new Map<string, DomainType>();
    for (const d of allDomains) {
      const override = typeOverrides.get(d.domain) as DomainType | undefined;
      map.set(d.domain, override ?? classifyDomain(d.category, d.domain, ownDomainSet, competitorDomainSet));
    }
    return map;
  }, [allDomains, ownDomainSet, competitorDomainSet, typeOverrides]);

  const totalCit = totalCitations(allDomains);
  const typeBreakdown = useMemo(() => {
    const totals: Partial<Record<string, number>> = {};
    let grand = 0;
    for (const d of allDomains) {
      const t = domainTypeFor.get(d.domain) ?? "Other";
      totals[t] = (totals[t] ?? 0) + d.citations;
      grand += d.citations;
    }
    return DOMAIN_TYPES
      .map((type) => ({
        type,
        citations: totals[type] ?? 0,
        share: grand > 0 ? ((totals[type] ?? 0) / grand) * 100 : 0,
      }))
      .filter((r) => r.citations > 0);
  }, [allDomains, domainTypeFor]);

  // ── Brand-selection narrows table (filter to chats that contain selected brands)
  // We can't easily re-filter aggregateDomainsFull post-hoc by brand without recomputing,
  // so when brands are selected, recompute over chats that contain a selected brand.
  const brandFilteredCurrent = useMemo(() => {
    if (selectedBrands === null) return filteredCurrent;
    const brandSet = new Set(selectedBrands);
    return filteredCurrent.filter((c) => c.brands.some((b) => brandSet.has(b.name)));
  }, [filteredCurrent, selectedBrands]);

  const brandFilteredPrevious = useMemo(() => {
    if (selectedBrands === null) return filteredPrevious;
    const brandSet = new Set(selectedBrands);
    return filteredPrevious.filter((c) => c.brands.some((b) => brandSet.has(b.name)));
  }, [filteredPrevious, selectedBrands]);

  const brandScopedDomains = useMemo(
    () =>
      selectedBrands === null
        ? allDomains
        : aggregateDomainsFull(brandFilteredCurrent, brandFilteredPrevious),
    [allDomains, selectedBrands, brandFilteredCurrent, brandFilteredPrevious],
  );

  // ── Top 5 fuel the chart (excluding user-hidden domains)
  const allTopDomains  = useMemo(() => brandScopedDomains.slice(0, 5), [brandScopedDomains]);
  const topDomains     = useMemo(
    () => allTopDomains.filter(d => !hiddenDomains.has(d.domain)),
    [allTopDomains, hiddenDomains],
  );

  // ── Domain Movers
  const moversData = useMemo(() => {
    switch (moverTab) {
      case "top":
        return brandScopedDomains.slice(0, 5);
      case "trending":
        return brandScopedDomains
          .filter((d) => d.citations > d.citationsPrev)
          .sort((a, b) => (b.citations - b.citationsPrev) - (a.citations - a.citationsPrev))
          .slice(0, 5);
      case "losing":
        return brandScopedDomains
          .filter((d) => d.citations < d.citationsPrev)
          .sort((a, b) => (a.citations - a.citationsPrev) - (b.citations - b.citationsPrev))
          .slice(0, 5);
      case "new":
        return brandScopedDomains
          .filter((d) => d.citationsPrev === 0 && d.citations > 0)
          .slice(0, 5);
    }
  }, [brandScopedDomains, moverTab]);

  const moversMax = useMemo(
    () => Math.max(1, ...moversData.map((d) => d.citations)),
    [moversData],
  );
  // Count-based series (Peec AI: "Source retrievals over time" shows raw counts)
  const chartData = useMemo(
    () =>
      buildDomainCountSeries(
        brandFilteredCurrent,
        topDomains.map((d) => d.domain),
        resolution,
        dateRange,
      ),
    [brandFilteredCurrent, topDomains, resolution, dateRange],
  );

  // ── Table rows
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = brandScopedDomains;
    const effectiveDomainTypeFilter = gapAnalysis ? "Competitor" : domainTypeFilter;
    if (effectiveDomainTypeFilter) {
      rows = rows.filter((d) => domainTypeFor.get(d.domain) === effectiveDomainTypeFilter);
    }
    if (q) {
      rows = rows.filter((d) => d.domain.toLowerCase().includes(q));
    }
    // Sort
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case "domain":
          av = a.domain;
          bv = b.domain;
          break;
        case "retrieved":
          av = a.retrievedShare;
          bv = b.retrievedShare;
          break;
        case "retrievalRate":
          av = a.retrievalRate;
          bv = b.retrievalRate;
          break;
        case "citationRate":
          av = a.citationRate;
          bv = b.citationRate;
          break;
        case "rank":
        default:
          av = a.citations;
          bv = b.citations;
          break;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return sorted;
  }, [brandScopedDomains, search, domainTypeFilter, gapAnalysis, domainTypeFor, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => tableRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [tableRows, safePage],
  );

  const pageButtons = useMemo(() => {
    const out: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) out.push(i);
      return out;
    }
    out.push(1, 2, 3, 4, 5);
    out.push("...");
    out.push(totalPages);
    return out;
  }, [totalPages]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="ins-page">
      {/* Breadcrumb */}
      <div className="urls-breadcrumb">
        <span>Sources</span>
        <ChevronRight size={12} />
        <strong>Domains</strong>
      </div>

      <h2 className="urls-section-title">Overview</h2>
      <p className="urls-section-subtitle">
        How often each domain appears in AI generated discussions
      </p>

      <div className="urls-overview">
        <div className="ins-chart-card urls-chart-card">
          {/* ── Chart header — matching Peec AI style ── */}
          <div className="ins-chart-header">
            <div className="urls-chart-title">Source retrievals over time</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="pd-resolution-toggle">
                {(["D", "W", "M"] as const).map((r) => (
                  <button
                    key={r}
                    className={`pd-res-btn ${resolution === r ? "pd-res-active" : ""}`}
                    onClick={() => setResolution(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <button className="ch-dots-btn" title="Chart options">···</button>
            </div>
          </div>

          {/* ── Line chart — raw counts, matching Peec AI ── */}
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" horizontal vertical={false} />
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
                width={42}
                domain={[0, "auto"]}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`}
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
                  return (
                    <div className="ch-tooltip">
                      <div className="ch-tooltip-date">{label}</div>
                      {sorted.map(p => (
                        <div key={p.dataKey as string} className="ch-tooltip-row">
                          <span className="ch-tooltip-dot" style={{ background: p.color as string }} />
                          <DomainFavicon domain={p.dataKey as string} size={13} />
                          <span className="ch-tooltip-name">{shortDomainLabel(p.dataKey as string)}</span>
                          <span className="ch-tooltip-val">{(p.value as number).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {topDomains.map((d, i) => {
                const color   = LINE_COLORS[i % LINE_COLORS.length];
                const isHover = hoveredDomain === d.domain;
                const faded   = hoveredDomain !== null && !isHover;
                return (
                  <Line
                    key={d.domain}
                    type="monotone"
                    dataKey={d.domain}
                    stroke={color}
                    strokeWidth={isHover ? 2.5 : 1.8}
                    strokeOpacity={faded ? 0.12 : 1}
                    dot={{ r: isHover ? 3 : 2.5, fill: color, strokeWidth: 0, fillOpacity: faded ? 0.12 : 1 }}
                    activeDot={{ r: 5, strokeWidth: 0, opacity: faded ? 0.12 : 1 }}
                    opacity={faded ? 0.12 : 1}
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>

          {/* ── Legend ── */}
          <div className="urls-legend">
            {allTopDomains.length === 0 && (
              <span className="urls-legend-empty">No domains retrieved in this window.</span>
            )}
            {allTopDomains.map((d, i) => {
              const color   = LINE_COLORS[i % LINE_COLORS.length];
              const hidden  = hiddenDomains.has(d.domain);
              const isHover = hoveredDomain === d.domain;
              return (
                <span
                  key={d.domain}
                  className={`urls-legend-chip ${isHover ? "urls-legend-chip--active" : ""} ${hidden ? "urls-legend-chip--hidden" : ""}`}
                  style={isHover ? { borderColor: color } : undefined}
                  onMouseEnter={() => setHoveredDomain(d.domain)}
                  onMouseLeave={() => setHoveredDomain(null)}
                  title={d.domain}
                >
                  <span className="urls-legend-dot" style={{ background: hidden ? "#cbd5e1" : color }} />
                  <span className="urls-legend-label">{shortDomainLabel(d.domain)}</span>
                  {/* Full domain tooltip on hover */}
                  {isHover && (
                    <span className="urls-legend-full-domain">{d.domain}</span>
                  )}
                  {/* × button to toggle domain visibility */}
                  {isHover && (
                    <button
                      className="urls-legend-remove"
                      onClick={e => {
                        e.stopPropagation();
                        setHiddenDomains(prev => {
                          const next = new Set(prev);
                          if (next.has(d.domain)) next.delete(d.domain);
                          else next.add(d.domain);
                          return next;
                        });
                      }}
                      title={hidden ? "Show domain" : "Hide domain"}
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        <div className="ins-chart-card urls-types-card">
          <div className="urls-types-header">
            <div className="urls-chart-title">Domain types</div>
            <div className="urls-types-total">
              Total retrievals: {totalCit.toLocaleString()}
            </div>
          </div>
          <div className="urls-types-list">
            {typeBreakdown.map((row) => (
              <div
                key={row.type}
                className={`urls-type-row ${domainTypeFilter === row.type ? "active" : ""}`}
                onClick={() => {
                  setDomainTypeFilter(domainTypeFilter === row.type ? null : row.type);
                  setPage(1);
                }}
              >
                <span
                  className="urls-type-bar"
                  style={{
                    background: `${DOMAIN_TYPE_COLORS[row.type]}33`,
                    borderColor: DOMAIN_TYPE_COLORS[row.type],
                  }}
                >
                  <span
                    className="urls-type-bar-fill"
                    style={{
                      width: `${Math.max(2, row.share)}%`,
                      background: DOMAIN_TYPE_COLORS[row.type],
                    }}
                  />
                  <span className="urls-type-bar-label">
                    <span
                      className="urls-type-dot"
                      style={{ background: DOMAIN_TYPE_COLORS[row.type] }}
                    />
                    {row.type}
                  </span>
                </span>
                <span className="urls-type-pct">{Math.round(row.share)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Domain Movers */}
      <h2 className="urls-section-title">Domain Movers</h2>
      <p className="urls-section-subtitle">
        Domains with the most significant changes in AI citations
      </p>
      <div className="movers-card">
        <div className="movers-tabs">
          {(["top", "trending", "losing", "new"] as const).map((tab) => (
            <button
              key={tab}
              className={`movers-tab ${moverTab === tab ? "movers-tab--active" : ""}`}
              onClick={() => setMoverTab(tab)}
            >
              {tab === "top" ? "Top" : tab === "trending" ? "Trending" : tab === "losing" ? "Losing" : "New"}
            </button>
          ))}
        </div>
        <div className="movers-list">
          {moversData.length === 0 && (
            <div className="movers-empty">No domains in this category for the selected period.</div>
          )}
          {moversData.map((d, i) => {
            const delta = d.citations - d.citationsPrev;
            const barWidth = (d.citations / moversMax) * 100;
            return (
              <div key={d.domain} className="movers-row">
                <span className="movers-rank">{i + 1}</span>
                <img src={faviconUrl(d.domain)} alt="" width={14} height={14} className="urls-favicon" />
                <span className="movers-domain">{d.domain}</span>
                <div className="movers-bar-wrap">
                  <div className="movers-bar-fill" style={{ width: `${barWidth}%` }} />
                </div>
                <span className="movers-count">{d.citations}</span>
                {(moverTab === "trending" || moverTab === "losing") && delta !== 0 && (
                  <span className={`movers-delta urls-num-delta tone-${delta > 0 ? "up" : "down"}`}>
                    {delta > 0 ? "+" : ""}{delta}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="urls-section-title">Domains</h2>
      <p className="urls-section-subtitle">
        Detailed breakdown of domain visibility across AI responses
      </p>

      <div className="urls-controls">
        <div className="urls-search">
          <Search size={14} className="urls-search-icon" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="urls-controls-right">
          <button
            className={`gap-analysis-toggle ${gapAnalysis ? "gap-analysis-toggle--active" : ""}`}
            onClick={() => {
              setGapAnalysis((g) => !g);
              setPage(1);
            }}
          >
            <span className="gap-analysis-dot" />
            Gap Analysis
          </button>
          <div className="ins-filter-wrapper">
            <button
              className="pd-filter-chip"
              onClick={() => setDomainTypeOpen((o) => !o)}
            >
              {domainTypeFilter ?? "All Domain Types"} <ChevronDown size={11} />
            </button>
            {domainTypeOpen && (
              <div className="ins-popover">
                <div className="ins-popover-list">
                  <button
                    className="ins-popover-row"
                    onClick={() => {
                      setDomainTypeFilter(null);
                      setDomainTypeOpen(false);
                    }}
                  >
                    All Domain Types
                  </button>
                  {DOMAIN_TYPES.map((d) => (
                    <button
                      key={d}
                      className={`ins-popover-row ${domainTypeFilter === d ? "active" : ""}`}
                      onClick={() => {
                        setDomainTypeFilter(d);
                        setDomainTypeOpen(false);
                        setPage(1);
                      }}
                    >
                      <span
                        className="urls-type-dot"
                        style={{ background: DOMAIN_TYPE_COLORS[d] }}
                      />
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="urls-table-wrap">
        <table className="urls-table domains-table">
          <thead>
            <tr>
              <th className="domains-th-rank">#</th>
              <th
                className="domains-th-source"
                onClick={() => toggleSort("domain")}
              >
                Source <ChevronDown size={10} className="domains-sort-arrow" />
              </th>
              <th>Domain Type</th>
              <th
                className="urls-th-num"
                onClick={() => toggleSort("retrieved")}
              >
                Retrieved <ChevronDown size={10} className="domains-sort-arrow" />
              </th>
              <th
                className="urls-th-num"
                onClick={() => toggleSort("retrievalRate")}
              >
                Retrieval rate <ChevronDown size={10} className="domains-sort-arrow" />
              </th>
              <th
                className="urls-th-num"
                onClick={() => toggleSort("citationRate")}
              >
                Citation rate <ChevronDown size={10} className="domains-sort-arrow" />
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={6} className="urls-empty">
                  No domains match your filters.
                </td>
              </tr>
            )}
            {pageRows.map((d, i) => {
              const rank = (safePage - 1) * PAGE_SIZE + i + 1;
              const dt = domainTypeFor.get(d.domain) ?? "Other";
              const retrievedDelta = formatDeltaPct(d.retrievedShare - d.retrievedSharePrev);
              const retrievalDelta = formatDeltaRate(d.retrievalRate - d.retrievalRatePrev);
              const citationDelta = formatDeltaRate(d.citationRate - d.citationRatePrev);
              return (
                <tr key={d.domain}>
                  <td className="domains-td-rank">{rank}</td>
                  <td className="domains-td-source">
                    <img
                      src={faviconUrl(d.domain)}
                      alt=""
                      width={16}
                      height={16}
                      className="urls-favicon"
                    />
                    <span className="domains-source-name">{d.domain}</span>
                  </td>
                  <td style={{ position: "relative" }}>
                    <span
                      className="urls-pill"
                      style={{
                        color: (DOMAIN_TYPE_COLORS as Record<string, string>)[dt] ?? "#64748b",
                        background: `${(DOMAIN_TYPE_COLORS as Record<string, string>)[dt] ?? "#64748b"}1A`,
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenTypeDropdown(openTypeDropdown === d.domain ? null : d.domain);
                      }}
                    >
                      {dt}
                    </span>
                    {openTypeDropdown === d.domain && (
                      <TypeDropdown
                        domain={d.domain}
                        currentType={dt}
                        defaultType={classifyDomain(d.category, d.domain, ownDomainSet, competitorDomainSet)}
                        onSelect={(type) => setTypeOverrides((prev) => new Map(prev).set(d.domain, type))}
                        onReset={() => setTypeOverrides((prev) => { const m = new Map(prev); m.delete(d.domain); return m; })}
                        onClose={() => setOpenTypeDropdown(null)}
                      />
                    )}
                  </td>
                  <td className="urls-td-num">
                    <span className="urls-num-primary">{d.retrievedShare.toFixed(1)}%</span>
                    {retrievedDelta.tone !== "flat" && (
                      <span className={`urls-num-delta tone-${retrievedDelta.tone}`}>
                        {retrievedDelta.text}
                      </span>
                    )}
                  </td>
                  <td className="urls-td-num">
                    <span className="urls-num-primary">{d.retrievalRate.toFixed(1)}</span>
                    {retrievalDelta.tone !== "flat" && (
                      <span className={`urls-num-delta tone-${retrievalDelta.tone}`}>
                        {retrievalDelta.text}
                      </span>
                    )}
                  </td>
                  <td className="urls-td-num">
                    <span className="urls-num-primary">{d.citationRate.toFixed(1)}</span>
                    {citationDelta.tone !== "flat" && (
                      <span className={`urls-num-delta tone-${citationDelta.tone}`}>
                        {citationDelta.text}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="urls-pagination">
        <div className="urls-pagination-controls">
          <button
            className="urls-page-btn"
            disabled={safePage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={14} />
          </button>
          {pageButtons.map((p, i) =>
            p === "..." ? (
              <span key={`e${i}`} className="urls-page-ellipsis">…</span>
            ) : (
              <button
                key={p}
                className={`urls-page-btn ${safePage === p ? "active" : ""}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ),
          )}
          <button
            className="urls-page-btn"
            disabled={safePage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="urls-pagination-total">
          {tableRows.length.toLocaleString()} items
        </div>
      </div>
    </div>
  );
}
