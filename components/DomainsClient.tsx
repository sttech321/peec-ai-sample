"use client";

import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import EngineIcon from "./EngineIcon";
import DateRangeDropdown, { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import BrandsDropdown from "./BrandsDropdown";
import { ChatFact, Resolution, filterByEngines, filterByDateRange } from "../lib/chat-aggregations";
import {
  aggregateDomainsFull,
  buildDomainShareSeries,
  classifyDomain,
  countByDomainType,
  DOMAIN_TYPES,
  DOMAIN_TYPE_COLORS,
  DomainType,
  totalCitations,
} from "../lib/domain-aggregations";

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
}: Props) {
  const [resolution, setResolution] = useState<Resolution>("W");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => makePresetRange("30"));
  const [selectedBrands, setSelectedBrands] = useState<string[] | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [domainTypeFilter, setDomainTypeFilter] = useState<DomainType | null>(null);
  const [domainTypeOpen, setDomainTypeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("retrieved");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const allEngines = useMemo(() => {
    const set = new Set<string>();
    for (const c of chatFacts) set.add(c.engine);
    return Array.from(set);
  }, [chatFacts]);
  const [selectedModels, setSelectedModels] = useState<string[]>(allEngines);

  const toggleModel = (m: string) => {
    setSelectedModels((prev) =>
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
      map.set(
        d.domain,
        classifyDomain(d.category, d.domain, ownDomainSet, competitorDomainSet),
      );
    }
    return map;
  }, [allDomains, ownDomainSet, competitorDomainSet]);

  const totalCit = totalCitations(allDomains);
  const typeBreakdown = useMemo(
    () =>
      countByDomainType(allDomains, {
        ownDomains: ownDomainSet,
        competitorDomains: competitorDomainSet,
      }),
    [allDomains, ownDomainSet, competitorDomainSet],
  );

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

  // ── Top 5 fuel the chart
  const topDomains = useMemo(() => brandScopedDomains.slice(0, 5), [brandScopedDomains]);
  const chartData = useMemo(
    () =>
      buildDomainShareSeries(
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
    if (domainTypeFilter) {
      rows = rows.filter((d) => domainTypeFor.get(d.domain) === domainTypeFilter);
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
  }, [brandScopedDomains, search, domainTypeFilter, domainTypeFor, sortKey, sortDir]);

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
          <div className="ins-chart-header">
            <div className="urls-chart-title">Source Retrieved by Domain</div>
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
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 50]}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 8,
                  color: "#f1f5f9",
                  fontSize: 11,
                }}
                labelStyle={{ color: "#cbd5e1", marginBottom: 6 }}
                formatter={(value: any, name: any) => [`${Number(value).toFixed(1)}%`, name]}
              />
              {topDomains.map((d, i) => (
                <Line
                  key={d.domain}
                  type="monotone"
                  dataKey={d.domain}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <div className="urls-legend">
            {topDomains.length === 0 && (
              <span className="urls-legend-empty">No domains retrieved in this window.</span>
            )}
            {topDomains.map((d, i) => (
              <span key={d.domain} className="urls-legend-chip">
                <span
                  className="urls-legend-dot"
                  style={{ background: LINE_COLORS[i % LINE_COLORS.length] }}
                />
                {shortDomainLabel(d.domain)}
              </span>
            ))}
          </div>
        </div>

        <div className="ins-chart-card urls-types-card">
          <div className="urls-types-header">
            <div className="urls-chart-title">Domain types</div>
            <div className="urls-types-total">
              Total citations: {totalCit.toLocaleString()}
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
                  <td>
                    <span
                      className="urls-pill"
                      style={{
                        color: DOMAIN_TYPE_COLORS[dt],
                        background: `${DOMAIN_TYPE_COLORS[dt]}1A`,
                      }}
                    >
                      {dt}
                    </span>
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
