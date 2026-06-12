"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Bookmark, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import DomainFavicon from "./DomainFavicon";
import TypeDropdown from "./TypeDropdown";
import { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import { ChatFact, Resolution, filterByDateRange, toChatRecords } from "../lib/chat-aggregations";
import {
  DOMAIN_TYPE_COLORS, classifyDomain, DomainType, buildDomainCountSeries,
} from "../lib/domain-aggregations";
import { URL_TYPE_COLORS, formatRelative } from "../lib/url-aggregations";
import { aggregateUrlsForDomain, UrlRowStat } from "../lib/url-detail-aggregations";

interface ProjectBrand { name: string; isOwn: boolean; domains?: string[] | null; }

interface Props {
  domain: string;
  projectName: string;
  chatFacts: ChatFact[];
  allChatFacts: ChatFact[];
  projectBrands: ProjectBrand[];
  ownBrand: string | null;
  ownDomains: string[];
  competitorDomains: string[];
  initialDomainTypeOverrides?: Record<string, string>;
  updateDomainTypeOverrideAction?: (domain: string, type: string | null) => Promise<{ ok: boolean }>;
  initialDomainBookmarks?: string[];
  updateDomainBookmarkAction?: (domain: string, bookmarked: boolean) => Promise<{ ok: boolean }>;
}

const PAGE_SIZE = 20;
const CHART_COLOR = "#f97316";

function localPrevPeriod(range: { start: Date; end: Date }) {
  const span = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - span - 1),
    end: new Date(range.start.getTime() - 1),
  };
}

function fmtDelta(v: number) {
  if (Math.abs(v) < 0.05) return null;
  return { text: (v > 0 ? "+" : "") + v.toFixed(1), tone: v > 0 ? "up" : "down" };
}

export default function DomainDetailClient({
  domain, chatFacts, allChatFacts,
  ownBrand, ownDomains, competitorDomains,
  initialDomainTypeOverrides, updateDomainTypeOverrideAction,
  initialDomainBookmarks, updateDomainBookmarkAction,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"urls" | "chats">("urls");
  const [resolution, setResolution] = useState<Resolution>("D");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => makePresetRange("14"));
  const [moverTab, setMoverTab] = useState<"top" | "new" | "trending" | "losing">("top");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<"retrievals" | "citationRate" | "url">("retrievals");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [urlTypeFilter, setUrlTypeFilter] = useState<string | null>(null);
  const [urlTypeMenuOpen, setUrlTypeMenuOpen] = useState(false);
  const [typeOverrides, setTypeOverrides] = useState<Map<string, string>>(
    () => new Map(Object.entries(initialDomainTypeOverrides ?? {}))
  );
  const [openTypeDropdown, setOpenTypeDropdown] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(
    () => new Set(initialDomainBookmarks ?? [])
  );

  const ownDomainSet = useMemo(
    () => new Set(ownDomains.map((d) => d.toLowerCase())),
    [ownDomains]
  );
  const competitorDomainSet = useMemo(
    () => new Set(competitorDomains.map((d) => d.toLowerCase())),
    [competitorDomains]
  );

  const domainType: DomainType = useMemo(() => {
    const override = typeOverrides.get(domain) as DomainType | undefined;
    return override ?? classifyDomain(null, domain, ownDomainSet, competitorDomainSet);
  }, [domain, typeOverrides, ownDomainSet, competitorDomainSet]);

  const isBookmarked = bookmarks.has(domain);

  async function handleBookmark(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !isBookmarked;
    setBookmarks((prev) => {
      const s = new Set(prev);
      if (next) s.add(domain); else s.delete(domain);
      return s;
    });
    await updateDomainBookmarkAction?.(domain, next);
  }

  const filteredCurrent = useMemo(
    () => filterByDateRange(chatFacts, dateRange),
    [chatFacts, dateRange]
  );

  const filteredPrevious = useMemo(() => {
    const prev = localPrevPeriod(dateRange);
    return allChatFacts.filter(
      (c) =>
        c.sources.some((s) => s.domain.toLowerCase() === domain.toLowerCase()) &&
        new Date(c.runDate) >= prev.start &&
        new Date(c.runDate) <= prev.end
    );
  }, [allChatFacts, domain, dateRange]);

  const urlRows = useMemo(
    () => aggregateUrlsForDomain(filteredCurrent, filteredPrevious, domain, ownBrand),
    [filteredCurrent, filteredPrevious, domain, ownBrand]
  );

  const chartData = useMemo(
    () => buildDomainCountSeries(filteredCurrent, [domain], resolution, dateRange),
    [filteredCurrent, domain, resolution, dateRange]
  );

  const urlTypeStats = useMemo(() => {
    const totals: Record<string, number> = {};
    let grand = 0;
    for (const u of urlRows) {
      totals[u.urlType] = (totals[u.urlType] || 0) + u.retrievals;
      grand += u.retrievals;
    }
    return Object.entries(totals)
      .map(([type, n]) => ({ type, n, share: grand > 0 ? (n / grand) * 100 : 0 }))
      .sort((a, b) => b.n - a.n)
      .filter((r) => r.n > 0);
  }, [urlRows]);

  const moversData = useMemo<UrlRowStat[]>(() => {
    switch (moverTab) {
      case "top": return urlRows.slice(0, 8);
      case "trending":
        return [...urlRows]
          .filter((u) => u.retrievalsDelta > 0)
          .sort((a, b) => b.retrievalsDelta - a.retrievalsDelta)
          .slice(0, 8);
      case "losing":
        return [...urlRows]
          .filter((u) => u.retrievalsDelta < 0)
          .sort((a, b) => a.retrievalsDelta - b.retrievalsDelta)
          .slice(0, 8);
      case "new":
        return [...urlRows]
          .filter((u) => u.retrievalsDelta === u.retrievals)
          .slice(0, 8);
    }
  }, [urlRows, moverTab]);
  const moversMax = Math.max(1, ...moversData.map((u) => u.retrievals));

  const tableRows = useMemo(() => {
    let rows = urlRows;
    if (urlTypeFilter) rows = rows.filter((u) => u.urlType === urlTypeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((u) => (u.url || u.title || "").toLowerCase().includes(q));
    }
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sortKey === "url") {
        const av = a.url || "", bv = b.url || "";
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const av = sortKey === "citationRate" ? a.citationRate : a.retrievals;
      const bv = sortKey === "citationRate" ? b.citationRate : b.retrievals;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return sorted;
  }, [urlRows, urlTypeFilter, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = tableRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const chatRecords = useMemo(() => toChatRecords(filteredCurrent).slice(0, 50), [filteredCurrent]);

  const dtColor = (DOMAIN_TYPE_COLORS as Record<string, string>)[domainType] ?? "#64748b";
  const totalRetrievals = urlRows.reduce((s, u) => s + u.retrievals, 0);

  return (
    <div className="ins-page">

      {/* Breadcrumb */}
      <div className="urls-breadcrumb">
        <span style={{ cursor: "pointer", color: "#64748b" }} onClick={() => router.push("/domains")}>
          Sources
        </span>
        <span className="urls-breadcrumb-sep">›</span>
        <span style={{ cursor: "pointer", color: "#64748b" }} onClick={() => router.push("/domains")}>
          Domains
        </span>
        <span className="urls-breadcrumb-sep">›</span>
        <strong style={{ color: "#0f172a" }}>{domain}</strong>
        <button className="dd-bookmark-btn" onClick={handleBookmark}
          title={isBookmarked ? "Remove bookmark" : "Bookmark"}>
          <Bookmark size={14}
            fill={isBookmarked ? "#f97316" : "none"}
            color={isBookmarked ? "#f97316" : "#94a3b8"} />
        </button>
      </div>

      {/* Domain header */}
      <div className="dd-header">
        <DomainFavicon domain={domain} size={28} />
        <h1 className="dd-title">{domain}</h1>
        <span className="urls-pill" style={{ color: dtColor, background: `${dtColor}1A` }}>
          {domainType}
        </span>
      </div>

      {/* Tabs */}
      <div className="dd-tabs">
        {(["urls", "chats"] as const).map((t) => (
          <button key={t}
            className={`dd-tab ${tab === t ? "dd-tab--active" : ""}`}
            onClick={() => setTab(t)}>
            {t === "urls" ? "URLs" : "Chats"}
          </button>
        ))}
      </div>

      {/* ═══ URLs tab ═══════════════════════════════════════════════════ */}
      {tab === "urls" && (
        <>
          <h2 className="urls-section-title">Overview</h2>
          <p className="urls-section-subtitle">How often this domain appears in AI answers</p>

          <div className="urls-overview">
            {/* Chart */}
            <div className="ins-chart-card urls-chart-card">
              <div className="ins-chart-header">
                <div className="urls-chart-title">Source retrievals over time</div>
                <div className="pd-resolution-toggle">
                  {(["D", "W", "M"] as const).map((r) => (
                    <button key={r}
                      className={`pd-res-btn ${resolution === r ? "pd-res-active" : ""}`}
                      onClick={() => setResolution(r)}>{r}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)"
                    horizontal vertical={false} />
                  <XAxis dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={{ stroke: "#e5e7eb" }} tickLine={false} dy={6} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    wrapperStyle={{ zIndex: 100 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="ch-tooltip">
                          <div className="ch-tooltip-date">{label}</div>
                          {payload.map((p) => (
                            <div key={String(p.dataKey)} className="ch-tooltip-row">
                              <span className="ch-tooltip-dot" style={{ background: p.color as string }} />
                              <span className="ch-tooltip-name">{String(p.dataKey)}</span>
                              <span className="ch-tooltip-val">{String(p.value)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Line type="monotone" dataKey={domain}
                    stroke={CHART_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="dd-chart-legend">
                <span className="dd-legend-chip">
                  <span className="dd-legend-dot" style={{ background: CHART_COLOR }} />
                  {domain}
                </span>
              </div>
            </div>

            {/* URL Types panel */}
            <div className="ins-chart-card urls-types-card">
              <div className="urls-types-header">
                <div className="urls-chart-title">URL types</div>
                <div className="urls-types-total">Total: {totalRetrievals}</div>
              </div>
              <div className="urls-types-list">
                {urlTypeStats.length === 0 && (
                  <div className="urls-empty" style={{ padding: 16 }}>No data</div>
                )}
                {urlTypeStats.map((row) => {
                  const color = (URL_TYPE_COLORS as Record<string, string>)[row.type] ?? "#94a3b8";
                  const isActive = urlTypeFilter === row.type;
                  return (
                    <div key={row.type}
                      className={`urls-type-row ${isActive ? "active" : ""}`}
                      onClick={() => { setUrlTypeFilter(isActive ? null : row.type); setPage(1); }}>
                      <span className="urls-type-bar"
                        style={{ background: `${color}22`, borderColor: `${color}55` }}>
                        <span className="urls-type-bar-fill"
                          style={{ width: `${Math.max(2, row.share)}%`, background: color }} />
                        <span className="urls-type-bar-label">
                          <span className="urls-type-dot" style={{ background: color }} />
                          {row.type}
                        </span>
                      </span>
                      <span className="urls-type-pct">{Math.round(row.share)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* URL Movers */}
          <h2 className="urls-section-title">URL Movers</h2>
          <p className="urls-section-subtitle">Performance changes per URL</p>
          <div className="movers-card">
            <div className="movers-tabs">
              {(["top", "new", "trending", "losing"] as const).map((t) => (
                <button key={t}
                  className={`movers-tab ${moverTab === t ? "movers-tab--active" : ""}`}
                  onClick={() => setMoverTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="movers-list">
              {moversData.length === 0 && (
                <div className="movers-empty">No URLs in this category.</div>
              )}
              {moversData.map((u, i) => {
                const barW = (u.retrievals / moversMax) * 100;
                const label = u.title || (() => {
                  if (!u.url) return u.urlType;
                  try { return new URL(u.url).pathname || u.url; } catch { return u.url; }
                })();
                return (
                  <div key={u.url || i} className="movers-row"
                    style={{ cursor: u.url ? "pointer" : "default" }}
                    onClick={() => u.url && router.push(
                      "/domains/" + encodeURIComponent(domain) + "/url?u=" + encodeURIComponent(u.url)
                    )}>
                    <span className="movers-rank">{i + 1}</span>
                    <span className="movers-domain"
                      style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {label}
                    </span>
                    <div className="movers-bar-wrap">
                      <div className="movers-bar-fill" style={{ width: `${barW}%` }} />
                    </div>
                    <span className="movers-count">{u.retrievals}</span>
                    {(moverTab === "trending" || moverTab === "losing") && u.retrievalsDelta !== 0 && (
                      <span className={`movers-delta urls-num-delta tone-${u.retrievalsDelta > 0 ? "up" : "down"}`}>
                        {u.retrievalsDelta > 0 ? "+" : ""}{u.retrievalsDelta}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* URLs Table */}
          <h2 className="urls-section-title">URLs</h2>
          <p className="urls-section-subtitle">Every page AI used for this domain</p>

          <div className="urls-controls">
            <div className="urls-search">
              <Search size={14} className="urls-search-icon" />
              <input type="text" placeholder="Search URL or title"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <div className="urls-controls-right">
              <div className="ins-filter-wrapper">
                <button className="pd-filter-chip"
                  onClick={() => setUrlTypeMenuOpen((o) => !o)}>
                  {urlTypeFilter ?? "All URL types"} <ChevronDown size={11} />
                </button>
                {urlTypeMenuOpen && (
                  <div className="ins-popover">
                    <div className="ins-popover-list">
                      <button className="ins-popover-row"
                        onClick={() => { setUrlTypeFilter(null); setUrlTypeMenuOpen(false); }}>
                        All URL types
                      </button>
                      {["Listicle", "Category Page", "Product Page", "Homepage",
                        "Article", "Profile", "Discussion", "Other"].map((t) => (
                        <button key={t}
                          className={`ins-popover-row ${urlTypeFilter === t ? "active" : ""}`}
                          onClick={() => { setUrlTypeFilter(t); setUrlTypeMenuOpen(false); setPage(1); }}>
                          <span className="urls-type-dot"
                            style={{ background: (URL_TYPE_COLORS as Record<string, string>)[t] ?? "#94a3b8" }} />
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="urls-table-wrap">
            <table className="urls-table dd-urls-table">
              <thead>
                <tr>
                  <th style={{ width: 36, color: "#94a3b8" }}>#</th>
                  <th style={{ cursor: "pointer" }} onClick={() => toggleSort("url")}>
                    URL <ChevronDown size={10} style={{ opacity: 0.5 }} />
                  </th>
                  <th>URL type</th>
                  <th>Domain type</th>
                  <th>{ownBrand ?? "Brand"} mentioned</th>
                  <th className="urls-th-num" style={{ cursor: "pointer" }}
                    onClick={() => toggleSort("retrievals")}>
                    Retrievals <ChevronDown size={10} style={{ opacity: 0.5 }} />
                  </th>
                  <th className="urls-th-num" style={{ cursor: "pointer" }}
                    onClick={() => toggleSort("citationRate")}>
                    Citation rate <ChevronDown size={10} style={{ opacity: 0.5 }} />
                  </th>
                  <th className="urls-th-num">Updated</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="urls-empty">No URLs match your filters.</td>
                  </tr>
                )}
                {pageRows.map((u, i) => {
                  const rank = (safePage - 1) * PAGE_SIZE + i + 1;
                  const uColor = (URL_TYPE_COLORS as Record<string, string>)[u.urlType] ?? "#94a3b8";
                  const dtOverride = typeOverrides.get(domain) as DomainType | undefined;
                  const dt = dtOverride ?? classifyDomain(u.category, domain, ownDomainSet, competitorDomainSet);
                  const dColor = (DOMAIN_TYPE_COLORS as Record<string, string>)[dt] ?? "#64748b";
                  const retD = fmtDelta(u.retrievalsDelta);
                  const citD = fmtDelta(u.citationRateDelta);
                  const displayTitle = u.title || (() => {
                    if (!u.url) return "—";
                    try { const p = new URL(u.url); return p.pathname || u.url; } catch { return u.url; }
                  })();
                  const dropKey = u.url || `row-${i}`;
                  return (
                    <tr key={dropKey}
                      style={{ cursor: u.url ? "pointer" : "default" }}
                      onClick={() => u.url && router.push(
                        "/domains/" + encodeURIComponent(domain) + "/url?u=" + encodeURIComponent(u.url)
                      )}>
                      <td style={{ color: "#94a3b8", fontWeight: 500, width: 36 }}>{rank}</td>
                      <td className="dd-td-url">
                        <div className="dd-url-title">{displayTitle}</div>
                        {u.url && (
                          <div className="dd-url-sub">
                            {u.url.replace(/^https?:\/\//, "").slice(0, 80)}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="urls-pill"
                          style={{ color: uColor, background: `${uColor}1A` }}>
                          {u.urlType}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
                        <span className="urls-pill"
                          style={{ color: dColor, background: `${dColor}1A`, cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenTypeDropdown(openTypeDropdown === dropKey ? null : dropKey);
                          }}>
                          {dt}
                        </span>
                        {openTypeDropdown === dropKey && (
                          <TypeDropdown
                            domain={domain}
                            currentType={dt}
                            defaultType={classifyDomain(u.category, domain, ownDomainSet, competitorDomainSet)}
                            onSelect={(type) => {
                              setTypeOverrides((prev) => new Map(prev).set(domain, type));
                              updateDomainTypeOverrideAction?.(domain, type);
                            }}
                            onReset={() => {
                              setTypeOverrides((prev) => {
                                const m = new Map(prev);
                                m.delete(domain);
                                return m;
                              });
                              updateDomainTypeOverrideAction?.(domain, null);
                            }}
                            onClose={() => setOpenTypeDropdown(null)}
                          />
                        )}
                      </td>
                      <td>
                        <span className={`dd-mentioned ${u.ownMentioned ? "dd-mentioned--yes" : "dd-mentioned--no"}`}>
                          {u.ownMentioned ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="urls-td-num">
                        <span className="urls-num-primary">{u.retrievals}</span>
                        {retD && (
                          <span className={`urls-num-delta tone-${retD.tone}`}>{retD.text}</span>
                        )}
                      </td>
                      <td className="urls-td-num">
                        <span className="urls-num-primary">{u.citationRate.toFixed(1)}%</span>
                        {citD && (
                          <span className={`urls-num-delta tone-${citD.tone}`}>{citD.text}</span>
                        )}
                      </td>
                      <td className="urls-td-num" style={{ color: "#94a3b8", fontSize: 11 }}>
                        {formatRelative(u.lastSeen)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="urls-pagination">
            <div className="urls-pagination-controls">
              <button className="urls-page-btn" disabled={safePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                <button key={p}
                  className={`urls-page-btn ${safePage === p ? "active" : ""}`}
                  onClick={() => setPage(p)}>{p}
                </button>
              ))}
              <button className="urls-page-btn" disabled={safePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="urls-pagination-total">{tableRows.length} URLs</div>
          </div>
        </>
      )}

      {/* ═══ Chats tab ══════════════════════════════════════════════════ */}
      {tab === "chats" && (
        <div className="dd-chats-list">
          <h2 className="urls-section-title" style={{ marginTop: 16 }}>Chats</h2>
          <p className="urls-section-subtitle">All chats where {domain} was retrieved</p>
          {chatRecords.length === 0 && (
            <div className="urls-empty" style={{ padding: 24 }}>No chats in this period.</div>
          )}
          {chatRecords.map((c) => (
            <div key={c.id} className="dd-chat-row">
              <div className="dd-chat-header">
                <span className="dd-chat-engine">{c.engine}</span>
                <span className="dd-chat-query">{c.query || "—"}</span>
                <span className="dd-chat-date">
                  {new Date(c.runDate).toLocaleDateString()}
                </span>
              </div>
              {c.rawResponse && (
                <p className="dd-chat-snippet">{c.rawResponse.slice(0, 200)}…</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
