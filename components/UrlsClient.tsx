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
  aggregateUrls,
  buildUrlRetrievalSeries,
  classifyDomain,
  countByUrlType,
  displayUrl,
  DOMAIN_TYPE_COLORS,
  DomainType,
  formatRelative,
  totalRetrievals,
  URL_TYPE_COLORS,
  UrlType,
} from "../lib/url-aggregations";

interface ProjectBrand {
  name: string;
  isOwn: boolean;
}

interface Props {
  chatFacts: ChatFact[];
  projectName: string;
  projectBrands: ProjectBrand[];
  ownBrandName: string | null;
  ownDomains: string[];
  competitorDomains: string[];
}

const PAGE_SIZE = 15;
const LINE_COLORS = ["#ef4444", "#f97316", "#94a3b8", "#0ea5e9", "#f59e0b"];

function previousPeriod(range: DateRangeValue): { start: Date; end: Date } {
  const span = range.end.getTime() - range.start.getTime();
  return {
    end: new Date(range.start.getTime() - 1),
    start: new Date(range.start.getTime() - 1 - span),
  };
}

function formatDelta(diff: number, withSign = true): { text: string; tone: "up" | "down" | "flat" } {
  if (!isFinite(diff) || Math.round(diff) === 0) return { text: "0", tone: "flat" };
  const sign = withSign && diff > 0 ? "+" : "";
  return {
    text: `${sign}${Math.round(diff)}`,
    tone: diff > 0 ? "up" : "down",
  };
}

function formatDeltaRate(diff: number): { text: string; tone: "up" | "down" | "flat" } {
  if (!isFinite(diff) || Math.abs(diff) < 0.05) return { text: "0", tone: "flat" };
  const sign = diff > 0 ? "+" : "";
  return {
    text: `${sign}${diff.toFixed(1)}`,
    tone: diff > 0 ? "up" : "down",
  };
}

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

export default function UrlsClient({
  chatFacts,
  projectName,
  projectBrands,
  ownBrandName,
  ownDomains,
  competitorDomains,
}: Props) {
  const [resolution, setResolution] = useState<Resolution>("W");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => makePresetRange("30"));
  const [selectedBrands, setSelectedBrands] = useState<string[] | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [urlTypeFilter, setUrlTypeFilter] = useState<UrlType | null>(null);
  const [urlTypeOpen, setUrlTypeOpen] = useState(false);
  const [domainTypeFilter, setDomainTypeFilter] = useState<DomainType | null>(null);
  const [domainTypeOpen, setDomainTypeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

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

  
  const yourBrand = useMemo(() => {
    if (ownBrandName) return ownBrandName;
    const explicit = projectBrands.find((b) => b.isOwn);
    if (explicit) return explicit.name;
    const match = projectBrands.find(
      (b) => b.name.toLowerCase() === projectName.toLowerCase(),
    );
    return match?.name ?? null;
  }, [ownBrandName, projectBrands, projectName]);

  const ownDomainSet = useMemo(() => new Set(ownDomains), [ownDomains]);
  const competitorDomainSet = useMemo(
    () => new Set(competitorDomains),
    [competitorDomains],
  );

  // ── Filtered chat windows
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

  // ── URL aggregates (full unfiltered list; row filters applied after)
  const allUrls = useMemo(
    () =>
      aggregateUrls(filteredCurrent, filteredPrevious, {
        ownBrand: yourBrand,
        ownDomains: ownDomainSet,
      }),
    [filteredCurrent, filteredPrevious, yourBrand, ownDomainSet],
  );

  // Cached domain-type per URL (so we don't recompute per render)
  const domainTypeFor = useMemo(() => {
    const map = new Map<string, DomainType>();
    for (const u of allUrls) {
      const key = u.url || `${u.domain}__noURL__${u.title ?? ""}`;
      map.set(key, classifyDomain(u.category, u.domain, ownDomainSet, competitorDomainSet));
    }
    return map;
  }, [allUrls, ownDomainSet, competitorDomainSet]);

  const totalCurrent = totalRetrievals(allUrls);
  const urlTypeBreakdown = useMemo(() => countByUrlType(allUrls), [allUrls]);

  // ── Filter by brand selection on rows
  const brandSelectionApplied = useMemo(() => {
    if (selectedBrands === null) return allUrls;
    const brandSet = new Set(selectedBrands);
    return allUrls.filter((u) =>
      u.brandMentions.some((b) => brandSet.has(b)),
    );
  }, [allUrls, selectedBrands]);

  // ── Top 5 URLs feed the retrieval line chart
  const topUrls = useMemo(() => brandSelectionApplied.slice(0, 5), [brandSelectionApplied]);
  const topUrlKeys = useMemo(
    () =>
      topUrls.map((u) =>
        u.url || `${u.domain}__noURL__${u.title ?? ""}`,
      ),
    [topUrls],
  );
  const chartData = useMemo(
    () =>
      buildUrlRetrievalSeries(filteredCurrent, topUrlKeys, resolution, dateRange),
    [filteredCurrent, topUrlKeys, resolution, dateRange],
  );

  // ── Table rows: search + type/domain filter applied
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return brandSelectionApplied.filter((u) => {
      if (urlTypeFilter && u.urlType !== urlTypeFilter) return false;
      const key = u.url || `${u.domain}__noURL__${u.title ?? ""}`;
      const dt = domainTypeFor.get(key);
      if (domainTypeFilter && dt !== domainTypeFilter) return false;
      if (!q) return true;
      return (
        u.url.toLowerCase().includes(q) ||
        u.domain.toLowerCase().includes(q) ||
        (u.title ?? "").toLowerCase().includes(q)
      );
    });
  }, [brandSelectionApplied, search, urlTypeFilter, domainTypeFilter, domainTypeFor]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => tableRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [tableRows, safePage],
  );

  // Page numbers (with ellipsis for large pagination)
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

  // ── Render
  return (
    <div className="ins-page">
      {/* Breadcrumb */}
      <div className="urls-breadcrumb">
        <span>Sources</span>
        <ChevronRight size={12} />
        <strong>URLs</strong>
      </div>

      {/* Filter bar */}
      <div className="ins-filters">
        <BrandsDropdown
          projectBrands={projectBrands}
          projectName={projectName}
          value={selectedBrands}
          onChange={setSelectedBrands}
        />
        <DateRangeDropdown value={dateRange} onChange={setDateRange} />

        <div className="ins-filter-wrapper">
          <button className="pd-filter-chip">
            <span className="ins-chip-icon">🏷</span>
            All Tags <ChevronDown size={11} />
          </button>
        </div>

        <div className="ins-filter-wrapper">
          <button
            className="pd-filter-chip"
            onClick={() => setModelDropdownOpen((o) => !o)}
          >
            <span className="ins-chip-icon">●</span>
            {selectedModels.length === allEngines.length
              ? "All Models"
              : `${selectedModels.length} Models`} <ChevronDown size={11} />
          </button>
          {modelDropdownOpen && (
            <div className="ins-popover">
              <div className="ins-popover-label">Active models</div>
              <div className="ins-popover-list">
                {allEngines.map((m) => (
                  <label key={m} className="ins-popover-row">
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(m)}
                      onChange={() => toggleModel(m)}
                    />
                    <EngineIcon engine={m} size={14} />
                    <span>{m}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overview heading */}
      <h2 className="urls-section-title">Overview</h2>
      <p className="urls-section-subtitle">
        Which pages AI uses when mentioning this brand
      </p>

      {/* Two-column: chart + URL types */}
      <div className="urls-overview">
        <div className="ins-chart-card urls-chart-card">
          <div className="ins-chart-header">
            <div>
              <div className="urls-chart-title">Source Retrieval by URL</div>
            </div>
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
                formatter={(value: any, name: any) => {
                  const u = topUrls.find((url) =>
                    (url.url || `${url.domain}__noURL__${url.title ?? ""}`) === name,
                  );
                  const label = u ? displayUrl(u.url, u.domain) : name;
                  return [value, label];
                }}
              />
              {topUrls.map((u, i) => {
                const key = u.url || `${u.domain}__noURL__${u.title ?? ""}`;
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>

          <div className="urls-legend">
            {topUrls.length === 0 && (
              <span className="urls-legend-empty">
                No URLs retrieved in this window.
              </span>
            )}
            {topUrls.map((u, i) => (
              <span key={i} className="urls-legend-chip">
                <span
                  className="urls-legend-dot"
                  style={{ background: LINE_COLORS[i % LINE_COLORS.length] }}
                />
                {u.domain}
              </span>
            ))}
          </div>
        </div>

        <div className="ins-chart-card urls-types-card">
          <div className="urls-types-header">
            <div className="urls-chart-title">URL types</div>
            <div className="urls-types-total">
              Total retrievals: {totalCurrent.toLocaleString()}
            </div>
          </div>
          <div className="urls-types-list">
            {urlTypeBreakdown.map((row) => (
              <div
                key={row.type}
                className={`urls-type-row ${urlTypeFilter === row.type ? "active" : ""}`}
                onClick={() =>
                  setUrlTypeFilter(urlTypeFilter === row.type ? null : row.type)
                }
              >
                <span
                  className="urls-type-bar"
                  style={{
                    background: `${URL_TYPE_COLORS[row.type]}33`,
                    borderColor: URL_TYPE_COLORS[row.type],
                  }}
                >
                  <span
                    className="urls-type-bar-fill"
                    style={{
                      width: `${Math.max(2, row.share)}%`,
                      background: URL_TYPE_COLORS[row.type],
                    }}
                  />
                  <span className="urls-type-bar-label">
                    <span
                      className="urls-type-dot"
                      style={{ background: URL_TYPE_COLORS[row.type] }}
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

      {/* URLs table heading */}
      <div className="urls-table-header">
        <div>
          <h2 className="urls-section-title">URLs</h2>
          <p className="urls-section-subtitle">Every page AI used for this brand</p>
        </div>
      </div>

      {/* Table controls */}
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
              onClick={() => setUrlTypeOpen((o) => !o)}
            >
              {urlTypeFilter ?? "All URL Types"} <ChevronDown size={11} />
            </button>
            {urlTypeOpen && (
              <div className="ins-popover">
                <div className="ins-popover-list">
                  <button
                    className="ins-popover-row"
                    onClick={() => {
                      setUrlTypeFilter(null);
                      setUrlTypeOpen(false);
                    }}
                  >
                    All URL Types
                  </button>
                  {urlTypeBreakdown.map((b) => (
                    <button
                      key={b.type}
                      className={`ins-popover-row ${urlTypeFilter === b.type ? "active" : ""}`}
                      onClick={() => {
                        setUrlTypeFilter(b.type);
                        setUrlTypeOpen(false);
                        setPage(1);
                      }}
                    >
                      <span
                        className="urls-type-dot"
                        style={{ background: URL_TYPE_COLORS[b.type] }}
                      />
                      {b.type}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
                  {(["You", "Competitor", "Corporate", "Editorial", "Reference", "UGC", "Institutional", "Other"] as DomainType[]).map((d) => (
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

      {/* Table */}
      <div className="urls-table-wrap">
        <table className="urls-table">
          <thead>
            <tr>
              <th className="urls-th-url">URL</th>
              <th>URL Type</th>
              <th>Domain Type</th>
              <th>{yourBrand ? `${yourBrand} mentioned` : "Brand mentioned"}</th>
              <th>Mentions</th>
              <th className="urls-th-num">Retrievals</th>
              <th className="urls-th-num">Citation rate</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="urls-empty">
                  No URLs match your filters.
                </td>
              </tr>
            )}
            {pageRows.map((u) => {
              const key = u.url || `${u.domain}__noURL__${u.title ?? ""}`;
              const dt = domainTypeFor.get(key) ?? "Other";
              const retrDelta = formatDelta(u.retrievals - u.retrievalsPrev);
              const rateDelta = formatDeltaRate(u.citationRate - u.citationRatePrev);
              const extraEngines = u.engines.length > 3 ? u.engines.length - 3 : 0;
              return (
                <tr key={key}>
                  <td className="urls-td-url">
                    <img
                      src={faviconUrl(u.domain)}
                      alt=""
                      width={16}
                      height={16}
                      className="urls-favicon"
                    />
                    <div className="urls-td-url-meta">
                      <div className="urls-td-title">
                        {u.title || displayUrl(u.url, u.domain)}
                      </div>
                      {u.url && (
                        <a
                          href={u.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="urls-td-link"
                        >
                          {displayUrl(u.url, u.domain)}
                        </a>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className="urls-pill"
                      style={{
                        color: URL_TYPE_COLORS[u.urlType],
                        background: `${URL_TYPE_COLORS[u.urlType]}1A`,
                      }}
                    >
                      {u.urlType}
                    </span>
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
                  <td>
                    <span
                      className={`urls-yesno ${u.ownMentioned ? "yes" : "no"}`}
                    >
                      {u.ownMentioned ? "✓ Yes" : "✕ No"}
                    </span>
                  </td>
                  <td>
                    <div className="urls-mentions">
                      {u.engines.slice(0, 3).map((e) => (
                        <EngineIcon key={e} engine={e} size={16} />
                      ))}
                      {extraEngines > 0 && (
                        <span className="urls-mentions-more">+{extraEngines}</span>
                      )}
                    </div>
                  </td>
                  <td className="urls-td-num">
                    <span className="urls-num-primary">{u.retrievals}</span>
                    {retrDelta.tone !== "flat" && (
                      <span className={`urls-num-delta tone-${retrDelta.tone}`}>
                        {retrDelta.text}
                      </span>
                    )}
                  </td>
                  <td className="urls-td-num">
                    <span className="urls-num-primary">{u.citationRate.toFixed(1)}</span>
                    {rateDelta.tone !== "flat" && (
                      <span className={`urls-num-delta tone-${rateDelta.tone}`}>
                        {rateDelta.text}
                      </span>
                    )}
                  </td>
                  <td className="urls-td-updated">{formatRelative(u.lastSeen)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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
