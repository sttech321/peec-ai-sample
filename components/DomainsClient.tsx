"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Bookmark, ChevronDown, ChevronLeft, ChevronRight, Search,
  Check, SlidersHorizontal, Upload, Settings, RotateCcw,
  MoreHorizontal, Download, ImageIcon, Copy,
} from "lucide-react";
import DomainFavicon from "./DomainFavicon";
import DateRangeDropdown, { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import { ChatFact, Resolution, filterByEngines, filterByDateRange } from "../lib/chat-aggregations";
import {
  aggregateDomainsFull,
  buildDomainCountSeries,
  classifyDomain,
  DOMAIN_TYPES,
  DOMAIN_TYPE_COLORS,
  DomainType,
  totalCitations,
  normalizeChatFacts,
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
  externalTagNames?: string[] | null;
  externalTopicNames?: string[] | null;
  chatTopicMap?: Record<string, string>;
  chatTagsMap?: Record<string, string[]>;
  initialDomainTypeOverrides?: Record<string, string>;
  updateDomainTypeOverrideAction?: (domain: string, type: string | null) => Promise<{ ok: boolean; error?: string }>;
  initialDomainBookmarks?: string[];
  updateDomainBookmarkAction?: (domain: string, bookmarked: boolean) => Promise<{ ok: boolean; error?: string }>;
}

const PAGE_SIZE = 20;
const LINE_COLORS = ["#7c4a1e", "#f97316", "#a855f7", "#ef4444", "#475569"];

// ── Column config ─────────────────────────────────────────────────────────────
const DOM_COL_DEFAULT = new Set(["domainType", "retrieved", "retrievalRate", "citationRate"]);
const DOM_COL_LABELS: Record<string, string> = {
  domainType: "Domain type", retrieved: "Retrieved",
  retrievalRate: "Retrieval rate", citationRate: "Citation rate", retrievals: "Retrievals",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  return { text: `${sign}${diff.toFixed(1)}%`, tone: diff > 0 ? "up" : "down" };
}

function formatDeltaRate(diff: number): { text: string; tone: "up" | "down" | "flat" } {
  if (!isFinite(diff) || Math.abs(diff) < 0.05) return { text: "0.0", tone: "flat" };
  const sign = diff > 0 ? "+" : "";
  return { text: `${sign}${diff.toFixed(1)}`, tone: diff > 0 ? "up" : "down" };
}

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function shortDomainLabel(domain: string, mode: "domain" | "host" = "domain"): string {
  const parts = domain.split(".");
  if (parts.length < 2) return domain;
  // Host mode: drop only TLD → www.cslplasma.com → www.cslplasma
  if (mode === "host") return parts.slice(0, -1).join(".");
  // Domain mode: just the registrable name → cslplasma.com → cslplasma
  return parts[parts.length - 2];
}

function toggleArr<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

type SortKey = "rank" | "domain" | "retrieved" | "retrievalRate" | "citationRate";
type IndicatorMode = "default" | "indicatorsOnly" | "none";

// ── Filter dropdown (same visual as URL page; uses ud-fdrop* CSS) ─────────────
function DomFilterDropdown({
  allLabel,
  searchPlaceholder,
  items,
  selected,
  mode,
  onToggle,
  onAll,
  onMode,
  renderItem,
  noModeToggle,
}: {
  allLabel: string;
  searchPlaceholder?: string;
  items: string[];
  selected: string[];
  mode: "or" | "and";
  onToggle: (v: string) => void;
  onAll: () => void;
  onMode: (m: "or" | "and") => void;
  renderItem?: (v: string) => React.ReactNode;
  noModeToggle?: boolean;
}) {
  const [search, setSearch] = useState("");
  const visible = search.trim()
    ? items.filter((i) => i.toLowerCase().includes(search.toLowerCase()))
    : items;
  const allActive = selected.length === 0;

  return (
    <div className="ud-fdrop">
      {searchPlaceholder && (
        <div className="ud-fdrop-search">
          <Search size={12} style={{ color: "#94a3b8", flexShrink: 0 }} />
          <input
            autoFocus
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}
      <div className="ud-fdrop-all" onClick={onAll}>
        <span>{allLabel}</span>
        {allActive && <Check size={13} className="ud-fdrop-check-mark" />}
      </div>
      {!noModeToggle && (
        <div className="ud-fdrop-modes">
          <div role="button" className={`ud-fdrop-mode ${mode === "or" ? "active" : ""}`}
            onClick={() => onMode("or")}>Or</div>
          <div role="button" className={`ud-fdrop-mode ${mode === "and" ? "active" : ""}`}
            onClick={() => onMode("and")}>And</div>
        </div>
      )}
      <div className="ud-fdrop-list">
        {visible.map((item) => {
          const checked = selected.includes(item);
          return (
            <div key={item} className="ud-fdrop-item" onClick={() => onToggle(item)}>
              <span className={`ud-fdrop-cb ${checked ? "checked" : ""}`}>
                {checked && <Check size={9} strokeWidth={3} />}
              </span>
              {renderItem ? renderItem(item) : <span className="ud-fdrop-label">{item}</span>}
            </div>
          );
        })}
        {visible.length === 0 && <div className="ud-fdrop-empty">No results</div>}
      </div>
    </div>
  );
}

// ── Column selector popup ─────────────────────────────────────────────────────
function DomColSelector({
  visible, onToggle, onReset, entityLabel,
}: {
  visible: Set<string>;
  onToggle: (k: string) => void;
  onReset: () => void;
  entityLabel: string;
}) {
  const ACTIVE_COLS = ["domainType", "retrieved", "retrievalRate", "citationRate"];
  const AVAIL_COLS = ["retrievals"];
  const colLabel = (k: string) =>
    k === "domainType" ? `${entityLabel} type` : DOM_COL_LABELS[k];
  return (
    <div className="ud-col-selector dom-col-selector">
      <div className="ud-col-section-label">Fixed columns</div>
      {["#", "Source"].map((k) => (
        <div key={k} className="ud-col-item">
          <span className="ud-fdrop-cb checked" style={{ opacity: 0.45, cursor: "not-allowed" }}>
            <Check size={9} strokeWidth={3} />
          </span>
          <span className="ud-fdrop-label">{k}</span>
        </div>
      ))}
      <div className="ud-col-divider" />
      <div className="ud-col-section-label">Active columns</div>
      {ACTIVE_COLS.map((k) => (
        <div key={k} className="ud-col-item" onClick={() => onToggle(k)}>
          <span className={`ud-fdrop-cb ${visible.has(k) ? "checked" : ""}`}>
            {visible.has(k) && <Check size={9} strokeWidth={3} />}
          </span>
          <span className="ud-fdrop-label">{colLabel(k)}</span>
        </div>
      ))}
      <div className="ud-col-divider" />
      <div className="ud-col-section-label">Available columns</div>
      {AVAIL_COLS.map((k) => (
        <div key={k} className="ud-col-item" onClick={() => onToggle(k)}>
          <span className={`ud-fdrop-cb ${visible.has(k) ? "checked" : ""}`}>
            {visible.has(k) && <Check size={9} strokeWidth={3} />}
          </span>
          <span className="ud-fdrop-label">{colLabel(k)}</span>
        </div>
      ))}
      <div className="ud-col-divider" />
      <div role="button" className="ud-col-reset" onClick={onReset}>
        <RotateCcw size={12} /> Reset to default
      </div>
    </div>
  );
}

// ── Export popup ──────────────────────────────────────────────────────────────
function DomExportMenu({ onExport }: { onExport: (fmt: "csv" | "xlsx" | "json") => void }) {
  return (
    <div className="ud-export-menu dom-export-menu">
      <div className="ud-export-label">Export format</div>
      {(["CSV", "XLSX", "JSON"] as const).map((fmt) => (
        <div key={fmt} role="button" className="ud-export-item"
          onClick={() => onExport(fmt.toLowerCase() as "csv" | "xlsx" | "json")}>
          {fmt}
        </div>
      ))}
    </div>
  );
}

// ── Indicators popup ──────────────────────────────────────────────────────────
function DomIndicatorsMenu({
  value, onChange,
}: {
  value: IndicatorMode;
  onChange: (v: IndicatorMode) => void;
}) {
  const opts: { key: IndicatorMode; label: string }[] = [
    { key: "default", label: "Default" },
    { key: "indicatorsOnly", label: "Indicators only" },
    { key: "none", label: "None" },
  ];
  return (
    <div className="dom-indicators-menu">
      <div className="ud-export-label">Change indicators</div>
      {opts.map((o) => (
        <div key={o.key} role="button" className="dom-indicator-item"
          onClick={() => onChange(o.key)}>
          <span>{o.label}</span>
          {value === o.key && <Check size={13} style={{ color: "#2563eb" }} />}
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DomainsClient({
  chatFacts,
  projectName,
  projectBrands,
  ownDomains,
  competitorDomains,
  externalDateRange,
  externalModels,
  externalTagNames,
  externalTopicNames,
  chatTopicMap = {},
  chatTagsMap = {},
  initialDomainTypeOverrides,
  updateDomainTypeOverrideAction,
  initialDomainBookmarks,
  updateDomainBookmarkAction,
}: Props) {
  const router = useRouter();
  const [resolution, setResolution] = useState<Resolution>("W");
  const [domainGrouping, setDomainGrouping] = useState<"domain" | "host">("domain");
  const [internalDateRange, setInternalDateRange] = useState<DateRangeValue>(() => makePresetRange("30"));
  const [hoveredDomain, setHoveredDomain] = useState<string | null>(null);
  const [hiddenDomains, setHiddenDomains] = useState<Set<string>>(new Set());
  const dateRange = externalDateRange ?? internalDateRange;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("retrieved");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [moverTab, setMoverTab] = useState<"top" | "trending" | "losing" | "new">("top");
  const [gapAnalysis, setGapAnalysis] = useState(false);
  const [typeOverrides, setTypeOverrides] = useState<Map<string, string>>(() =>
    new Map(Object.entries(initialDomainTypeOverrides ?? {}))
  );
  const [openTypeDropdown, setOpenTypeDropdown] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(
    () => new Set(initialDomainBookmarks ?? [])
  );
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);

  // ── NEW: Domains table filter state ─────────────────────────────────────────
  const [domMenuOpen, setDomMenuOpen] = useState<
    "brands" | "types" | "columns" | "export" | "indicators" | null
  >(null);
  const [domBrandFilters, setDomBrandFilters] = useState<string[]>([]);
  const [domBrandMode, setDomBrandMode] = useState<"or" | "and">("or");
  const [domTypeFilters, setDomTypeFilters] = useState<DomainType[]>([]);
  const [domCols, setDomCols] = useState<Set<string>>(new Set(DOM_COL_DEFAULT));
  const [domIndicators, setDomIndicators] = useState<IndicatorMode>("default");

  // ── Chart export menu ────────────────────────────────────────────────────────
  const [chartMenuOpen, setChartMenuOpen] = useState(false);
  const chartCardRef = useRef<HTMLDivElement>(null);
  const chartMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!domMenuOpen) return;
    function handler(e: MouseEvent) {
      const target = e.target as Element;
      if (!target.closest(".ud-filter-wrapper")) setDomMenuOpen(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [domMenuOpen]);

  useEffect(() => {
    if (!chartMenuOpen) return;
    function handler(e: MouseEvent) {
      if (chartMenuRef.current && !chartMenuRef.current.contains(e.target as Node))
        setChartMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [chartMenuOpen]);

  const allEngines = useMemo(() => {
    const set = new Set<string>();
    for (const c of chatFacts) set.add(c.engine);
    return Array.from(set);
  }, [chatFacts]);
  const [internalModels, setInternalModels] = useState<string[]>(allEngines);
  const selectedModels = externalModels?.length ? externalModels : internalModels;

  async function handleTypeOverride(domain: string, type: string) {
    setTypeOverrides(prev => new Map(prev).set(domain, type));
    await updateDomainTypeOverrideAction?.(domain, type);
  }

  async function handleTypeReset(domain: string) {
    setTypeOverrides(prev => { const m = new Map(prev); m.delete(domain); return m; });
    await updateDomainTypeOverrideAction?.(domain, null);
  }

  async function handleBookmark(domain: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = !bookmarks.has(domain);
    setBookmarks(prev => {
      const s = new Set(prev);
      if (next) s.add(domain); else s.delete(domain);
      return s;
    });
    await updateDomainBookmarkAction?.(domain, next);
  }

  const ownDomainSet = useMemo(() => new Set(ownDomains), [ownDomains]);
  const competitorDomainSet = useMemo(() => new Set(competitorDomains), [competitorDomains]);
  const ownBrandNames = useMemo(
    () => new Set(projectBrands.filter((b) => b.isOwn).map((b) => b.name)),
    [projectBrands]
  );

  const applyTagTopicFilter = (facts: ChatFact[]) => {
    let f = facts;
    if (externalTagNames && externalTagNames.length > 0) {
      f = f.filter((c) => { const t = chatTagsMap[c.id]; return t && t.some((tag) => externalTagNames.includes(tag)); });
    }
    if (externalTopicNames && externalTopicNames.length > 0) {
      f = f.filter((c) => { const topic = chatTopicMap[c.id]; return topic !== undefined && externalTopicNames.includes(topic); });
    }
    return f;
  };

  const filteredCurrent = useMemo(
    () => applyTagTopicFilter(filterByDateRange(filterByEngines(chatFacts, selectedModels), dateRange)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatFacts, selectedModels, dateRange, externalTagNames, externalTopicNames, chatTagsMap, chatTopicMap],
  );
  const filteredPrevious = useMemo(() => {
    if (dateRange.preset === "all") return [];
    return applyTagTopicFilter(filterByDateRange(
      filterByEngines(chatFacts, selectedModels),
      previousPeriod(dateRange),
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatFacts, selectedModels, dateRange, externalTagNames, externalTopicNames, chatTagsMap, chatTopicMap]);

  // Normalize domain keys based on active tab (domain = strip www., host = as-is)
  const normalizedCurrent = useMemo(
    () => normalizeChatFacts(filteredCurrent, domainGrouping),
    [filteredCurrent, domainGrouping],
  );
  const normalizedPrevious = useMemo(
    () => normalizeChatFacts(filteredPrevious, domainGrouping),
    [filteredPrevious, domainGrouping],
  );

  const allDomains = useMemo(
    () => aggregateDomainsFull(normalizedCurrent, normalizedPrevious),
    [normalizedCurrent, normalizedPrevious],
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

  // ── Brand filter (updated to support Or/And + new domBrandFilters state) ────
  const brandFilteredCurrent = useMemo(() => {
    if (domBrandFilters.length === 0) return normalizedCurrent;
    if (domBrandMode === "or") {
      const brandSet = new Set(domBrandFilters);
      return normalizedCurrent.filter((c) => c.brands.some((b) => brandSet.has(b.name)));
    } else {
      return normalizedCurrent.filter((c) =>
        domBrandFilters.every((name) => c.brands.some((b) => b.name === name))
      );
    }
  }, [normalizedCurrent, domBrandFilters, domBrandMode]);

  const brandFilteredPrevious = useMemo(() => {
    if (domBrandFilters.length === 0) return normalizedPrevious;
    if (domBrandMode === "or") {
      const brandSet = new Set(domBrandFilters);
      return normalizedPrevious.filter((c) => c.brands.some((b) => brandSet.has(b.name)));
    } else {
      return normalizedPrevious.filter((c) =>
        domBrandFilters.every((name) => c.brands.some((b) => b.name === name))
      );
    }
  }, [normalizedPrevious, domBrandFilters, domBrandMode]);

  const brandScopedDomains = useMemo(
    () =>
      domBrandFilters.length === 0
        ? allDomains
        : aggregateDomainsFull(brandFilteredCurrent, brandFilteredPrevious),
    [allDomains, domBrandFilters, brandFilteredCurrent, brandFilteredPrevious],
  );

  const allTopDomains = useMemo(() => brandScopedDomains.slice(0, 5), [brandScopedDomains]);
  const topDomains = useMemo(
    () => allTopDomains.filter(d => !hiddenDomains.has(d.domain)),
    [allTopDomains, hiddenDomains],
  );

  const moversData = useMemo(() => {
    switch (moverTab) {
      case "top":
        return brandScopedDomains.slice(0, 8);
      case "trending":
        return brandScopedDomains
          .filter((d) => d.citations > d.citationsPrev)
          .sort((a, b) => (b.citations - b.citationsPrev) - (a.citations - a.citationsPrev))
          .slice(0, 8);
      case "losing":
        return brandScopedDomains
          .filter((d) => d.citations < d.citationsPrev)
          .sort((a, b) => (a.citations - a.citationsPrev) - (b.citations - b.citationsPrev))
          .slice(0, 8);
      case "new":
        return brandScopedDomains
          .filter((d) => d.citationsPrev === 0 && d.citations > 0)
          .slice(0, 8);
    }
  }, [brandScopedDomains, moverTab]);

  const moversMax = useMemo(
    () => Math.max(1, ...moversData.map((d) => d.citations)),
    [moversData],
  );

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

  // ── Table rows (updated for multi-type filter) ────────────────────────────
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = brandScopedDomains;
    if (showBookmarkedOnly) rows = rows.filter((d) => bookmarks.has(d.domain));

    // Domain type filter: gapAnalysis forces "Competitor", else use multi-select
    const effectiveTypeFilters = gapAnalysis
      ? (["Competitor"] as DomainType[])
      : domTypeFilters;
    if (effectiveTypeFilters.length > 0) {
      rows = rows.filter((d) => effectiveTypeFilters.includes(domainTypeFor.get(d.domain) ?? "Other" as DomainType));
    }

    if (q) rows = rows.filter((d) => d.domain.toLowerCase().includes(q));

    const sorted = [...rows];
    sorted.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case "domain": av = a.domain; bv = b.domain; break;
        case "retrieved": av = a.retrievedShare; bv = b.retrievedShare; break;
        case "retrievalRate": av = a.retrievalRate; bv = b.retrievalRate; break;
        case "citationRate": av = a.citationRate; bv = b.citationRate; break;
        case "rank": default: av = a.citations; bv = b.citations; break;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return sorted;
  }, [brandScopedDomains, search, domTypeFilters, gapAnalysis, domainTypeFor, sortKey, sortDir, showBookmarkedOnly, bookmarks]);

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
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  function exportAs(fmt: "csv" | "xlsx" | "json") {
    setDomMenuOpen(null);
    const rows = pageRows.map((d) => ({
      source: d.domain,
      domainType: domainTypeFor.get(d.domain) ?? "Other",
      retrieved: d.retrievedShare.toFixed(1) + "%",
      retrievalRate: d.retrievalRate.toFixed(1),
      citationRate: d.citationRate.toFixed(1),
      retrievals: d.citations,
    }));
    let content: string;
    let filename: string;
    let type: string;
    if (fmt === "json") {
      content = JSON.stringify(rows, null, 2);
      filename = "domains.json";
      type = "application/json";
    } else {
      const headers = ["Source", "Domain Type", "Retrieved", "Retrieval rate", "Citation rate", "Retrievals"];
      const lines = [
        headers,
        ...rows.map((r) => [r.source, r.domainType, r.retrieved, r.retrievalRate, r.citationRate, String(r.retrievals)]),
      ];
      content = lines.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      filename = `domains.${fmt}`;
      type = "text/csv";
    }
    const a = document.createElement("a");
    a.href = `data:${type};charset=utf-8,` + encodeURIComponent(content);
    a.download = filename;
    a.click();
  }

  // ── Chart export functions ────────────────────────────────────────────────
  function exportChartCSV() {
    setChartMenuOpen(false);
    if (!chartData.length) return;
    const domains = topDomains.map((d) => d.domain);
    const headers = ["Date", ...domains];
    const rows = chartData.map((point) => [
      String(point.date),
      ...domains.map((d) => String(point[d] ?? 0)),
    ]);
    const content = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(content);
    a.download = `source-retrievals-${domainGrouping}.csv`;
    a.click();
  }

  async function saveChartAsImage() {
    setChartMenuOpen(false);
    const card = chartCardRef.current;
    if (!card) return;
    card.setAttribute("data-exporting", "true");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(card, { backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false });
      const a = document.createElement("a");
      a.download = `source-retrievals-${domainGrouping}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } finally { card.removeAttribute("data-exporting"); }
  }

  async function copyChartToClipboard() {
    setChartMenuOpen(false);
    const card = chartCardRef.current;
    if (!card) return;
    card.setAttribute("data-exporting", "true");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(card, { backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); }
        catch { const a = document.createElement("a"); a.download = `source-retrievals-${domainGrouping}.png`; a.href = canvas.toDataURL("image/png"); a.click(); }
      }, "image/png");
    } finally { card.removeAttribute("data-exporting"); }
  }

  // Dynamic label based on active tab
  const entityLabel = domainGrouping === "domain" ? "Domain" : "Host";

  // Filter label helpers
  const brandLabel = domBrandFilters.length === 0
    ? "All Brands"
    : `${domBrandFilters.length} Brand${domBrandFilters.length !== 1 ? "s" : ""}`;
  const typeLabel = domTypeFilters.length === 0
    ? `All ${entityLabel} types`
    : `${domTypeFilters.length} Type${domTypeFilters.length !== 1 ? "s" : ""}`;

  // All brand names from projectBrands
  const allBrandNames = useMemo(
    () => projectBrands.map((b) => b.name).sort(),
    [projectBrands]
  );

  // ── Delta display helper ────────────────────────────────────────────────────
  function showDelta(delta: { text: string; tone: "up" | "down" | "flat" }) {
    if (domIndicators === "none") return null;
    if (delta.tone === "flat") return null;
    return <span className={`urls-num-delta tone-${delta.tone}`}>{delta.text}</span>;
  }

  function showPrimary(val: string) {
    if (domIndicators === "indicatorsOnly") return null;
    return <span className="urls-num-primary">{val}</span>;
  }

  return (
    <div className="ins-page">
      {/* Breadcrumb */}
      <div className="urls-breadcrumb">
        <span>Sources</span>
        <ChevronRight size={12} />
        <strong>{entityLabel}s</strong>
      </div>

      {/* ── Domains / Hosts tab toggle ── */}
      <div className="dom-tabs">
        <button
          className={`dom-tab ${domainGrouping === "domain" ? "dom-tab--active" : ""}`}
          onClick={() => {
            setDomainGrouping("domain");
            setPage(1);
            setHiddenDomains(new Set());
          }}
        >
          Domains
        </button>
        <button
          className={`dom-tab ${domainGrouping === "host" ? "dom-tab--active" : ""}`}
          onClick={() => {
            setDomainGrouping("host");
            setPage(1);
            setHiddenDomains(new Set());
          }}
        >
          Hosts
        </button>
      </div>

      <h2 className="urls-section-title">Overview</h2>
      <p className="urls-section-subtitle">
        How often each {entityLabel.toLowerCase()} appears in AI generated discussions
      </p>

      {/* ── Chart + Domain Types overview ── */}
      <div className="urls-overview">
        <div className="ins-chart-card urls-chart-card" ref={chartCardRef}>
          <div className="ins-chart-header">
            <div className="urls-chart-title">Source retrievals over time</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="pd-resolution-toggle">
                {(["D", "W", "M"] as const).map((r) => (
                  <button
                    key={r}
                    className={`pd-res-btn ${resolution === r ? "pd-res-active" : ""}`}
                    onClick={() => setResolution(r)}
                  >{r}</button>
                ))}
              </div>
              <div className="ch-chart-menu-wrap" ref={chartMenuRef}>
                <button
                  className="ch-dots-btn"
                  title="Export options"
                  onClick={() => setChartMenuOpen((o) => !o)}
                >
                  <MoreHorizontal size={15} />
                </button>
                {chartMenuOpen && (
                  <div className="ch-chart-menu">
                    <button className="ch-chart-menu-item" onClick={exportChartCSV}>
                      <Download size={13} /> Export CSV
                    </button>
                    <button className="ch-chart-menu-item" onClick={saveChartAsImage}>
                      <ImageIcon size={13} /> Save as image
                    </button>
                    <button className="ch-chart-menu-item" onClick={copyChartToClipboard}>
                      <Copy size={13} /> Copy to clipboard
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" horizontal vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={{ stroke: "#e5e7eb" }} tickLine={false} dy={6} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                width={42} domain={[0, "auto"]}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`} />
              <Tooltip
                wrapperStyle={{ zIndex: 100, pointerEvents: "none" }}
                position={{ y: 8 }}
                cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const sorted = [...payload]
                    .filter(p => (p.value as number) > 0)
                    .sort((a, b) => ((b.value as number) ?? 0) - ((a.value as number) ?? 0));
                  const pc = (payload[0]?.payload?._chatCount as number) ?? 0;
                  return (
                    <div className="ch-tooltip">
                      <div className="ch-tooltip-date">{label}</div>
                      {sorted.map(p => (
                        <div key={p.dataKey as string} className="ch-tooltip-row">
                          <span className="ch-tooltip-dot" style={{ background: p.color as string }} />
                          <DomainFavicon domain={p.dataKey as string} size={13} />
                          <span className="ch-tooltip-name" style={{ maxWidth: 180 }}>{p.dataKey as string}</span>
                          <span className="ch-tooltip-val">{(p.value as number).toLocaleString()}</span>
                        </div>
                      ))}
                      {pc > 0 && <div className="ch-tooltip-footer">{pc} new prompts created</div>}
                    </div>
                  );
                }}
              />
              {topDomains.map((d, i) => {
                const color = LINE_COLORS[i % LINE_COLORS.length];
                const isHover = hoveredDomain === d.domain;
                const faded = hoveredDomain !== null && !isHover;
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

          <div className="urls-legend">
            {allTopDomains.length === 0 && (
              <span className="urls-legend-empty">No domains retrieved in this window.</span>
            )}
            {allTopDomains.map((d, i) => {
              const color = LINE_COLORS[i % LINE_COLORS.length];
              const hidden = hiddenDomains.has(d.domain);
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
                  <span className="urls-legend-label">{shortDomainLabel(d.domain, domainGrouping)}</span>
                  {isHover && <span className="urls-legend-full-domain">{d.domain}</span>}
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
                    >×</button>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        <div className="ins-chart-card urls-types-card">
          <div className="urls-types-header">
            <div className="urls-chart-title">{entityLabel} types</div>
            <div className="urls-types-total">Total retrievals: {totalCit.toLocaleString()}</div>
          </div>
          <div className="urls-types-list">
            {typeBreakdown.map((row) => (
              <div
                key={row.type}
                className={`urls-type-row ${domTypeFilters.includes(row.type) ? "active" : ""}`}
                onClick={() => {
                  setDomTypeFilters((prev) =>
                    prev.includes(row.type) ? prev.filter(t => t !== row.type) : [...prev, row.type]
                  );
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
                    <span className="urls-type-dot" style={{ background: DOMAIN_TYPE_COLORS[row.type] }} />
                    {row.type}
                  </span>
                </span>
                <span className="urls-type-pct">{Math.round(row.share)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Domain / Host Movers ── */}
      <h2 className="urls-section-title">{entityLabel} Movers</h2>
      <p className="urls-section-subtitle">
        {entityLabel}s with the most significant changes in AI citations
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
            <div className="movers-empty">No {entityLabel.toLowerCase()}s in this category for the selected period.</div>
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

      {/* ── Domains / Hosts table section ────────────────────────────────── */}
      <h2 className="urls-section-title">{entityLabel}s</h2>
      <p className="urls-section-subtitle">
        Detailed breakdown of {entityLabel.toLowerCase()} visibility across AI responses
      </p>

      {/* ── Filter bar ── */}
      <div className="dom-section-controls">
        {/* Left: search + bookmark */}
        <div className="dom-left-controls">
          <div className="urls-search">
            <Search size={14} className="urls-search-icon" />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          {bookmarks.size > 0 && (
            <button
              className={`domains-bookmark-filter ${showBookmarkedOnly ? "domains-bookmark-filter--active" : ""}`}
              onClick={() => { setShowBookmarkedOnly(v => !v); setPage(1); }}
            >
              <Bookmark size={12} fill={showBookmarkedOnly ? "#f97316" : "none"}
                color={showBookmarkedOnly ? "#f97316" : "#64748b"} />
              Bookmarked
            </button>
          )}
        </div>

        {/* Right: Gap Analysis + filter chips */}
        <div className="dom-right-controls">
          {/* Gap Analysis toggle */}
          <button
            className={`gap-analysis-toggle ${gapAnalysis ? "gap-analysis-toggle--active" : ""}`}
            onClick={() => { setGapAnalysis((g) => !g); setPage(1); }}
          >
            <span className="gap-analysis-dot" />
            Gap Analysis
          </button>

          {/* All Brands */}
          <div className="ud-filter-wrapper">
            <button
              className={`pd-filter-chip ${domBrandFilters.length > 0 ? "active" : ""}`}
              onClick={() => setDomMenuOpen((m) => m === "brands" ? null : "brands")}>
              {brandLabel} <ChevronDown size={11} />
            </button>
            {domMenuOpen === "brands" && (
              <DomFilterDropdown
                allLabel="All Brands"
                searchPlaceholder="Search brands..."
                items={allBrandNames}
                selected={domBrandFilters}
                mode={domBrandMode}
                onToggle={(v) => { setDomBrandFilters((f) => toggleArr(f, v)); setPage(1); }}
                onAll={() => { setDomBrandFilters([]); setPage(1); }}
                onMode={setDomBrandMode}
                renderItem={(item) => (
                  <span className="ud-fdrop-label">
                    {item}
                    {ownBrandNames.has(item) && <span className="ud-badge-you">You</span>}
                  </span>
                )}
              />
            )}
          </div>

          {/* All Domain types */}
          <div className="ud-filter-wrapper">
            <button
              className={`pd-filter-chip ${domTypeFilters.length > 0 ? "active" : ""}`}
              onClick={() => setDomMenuOpen((m) => m === "types" ? null : "types")}>
              {typeLabel} <ChevronDown size={11} />
            </button>
            {domMenuOpen === "types" && (
              <DomFilterDropdown
                allLabel={`All ${entityLabel} types`}
                searchPlaceholder="Search or create type"
                items={DOMAIN_TYPES as unknown as string[]}
                selected={domTypeFilters as unknown as string[]}
                mode="or"
                noModeToggle
                onToggle={(v) => {
                  setDomTypeFilters((f) => toggleArr(f, v as DomainType));
                  setPage(1);
                }}
                onAll={() => { setDomTypeFilters([]); setPage(1); }}
                onMode={() => {}}
                renderItem={(item) => {
                  const color = (DOMAIN_TYPE_COLORS as Record<string, string>)[item] ?? "#64748b";
                  return (
                    <span className="ud-fdrop-label">
                      <span className="dom-type-pill"
                        style={{ color, background: `${color}1A`, borderColor: `${color}33` }}>
                        {item}
                      </span>
                    </span>
                  );
                }}
              />
            )}
          </div>

          {/* Column selector */}
          <div className="ud-filter-wrapper">
            <button className="ud-icon-btn" title="Columns"
              onClick={() => setDomMenuOpen((m) => m === "columns" ? null : "columns")}>
              <SlidersHorizontal size={14} />
            </button>
            {domMenuOpen === "columns" && (
              <DomColSelector
                visible={domCols}
                entityLabel={entityLabel}
                onToggle={(k) => setDomCols((s) => {
                  const next = new Set(s);
                  if (next.has(k)) next.delete(k); else next.add(k);
                  return next;
                })}
                onReset={() => setDomCols(new Set(DOM_COL_DEFAULT))}
              />
            )}
          </div>

          {/* Export */}
          <div className="ud-filter-wrapper">
            <button className="ud-icon-btn" title="Export"
              onClick={() => setDomMenuOpen((m) => m === "export" ? null : "export")}>
              <Upload size={14} />
            </button>
            {domMenuOpen === "export" && <DomExportMenu onExport={exportAs} />}
          </div>

          {/* Indicators */}
          <div className="ud-filter-wrapper">
            <button
              className={`ud-icon-btn ${domIndicators !== "default" ? "ud-icon-btn--active" : ""}`}
              title="Change indicators"
              onClick={() => setDomMenuOpen((m) => m === "indicators" ? null : "indicators")}>
              <Settings size={14} />
            </button>
            {domMenuOpen === "indicators" && (
              <DomIndicatorsMenu value={domIndicators} onChange={(v) => { setDomIndicators(v); setDomMenuOpen(null); }} />
            )}
          </div>
        </div>
      </div>

      {/* ── Domains table ── */}
      <div className="urls-table-wrap">
        <table className="urls-table domains-table">
          <thead>
            <tr>
              <th className="domains-th-bm" />
              <th className="domains-th-rank">#</th>
              <th className="domains-th-source" onClick={() => toggleSort("domain")}>
                Source <ChevronDown size={10} className="domains-sort-arrow" />
              </th>
              {domCols.has("domainType") && <th>{entityLabel} type</th>}
              {domCols.has("retrieved") && (
                <th className="urls-th-num" onClick={() => toggleSort("retrieved")}>
                  Retrieved <ChevronDown size={10} className="domains-sort-arrow" />
                </th>
              )}
              {domCols.has("retrievalRate") && (
                <th className="urls-th-num" onClick={() => toggleSort("retrievalRate")}>
                  Retrieval rate <ChevronDown size={10} className="domains-sort-arrow" />
                </th>
              )}
              {domCols.has("citationRate") && (
                <th className="urls-th-num" onClick={() => toggleSort("citationRate")}>
                  Citation rate <ChevronDown size={10} className="domains-sort-arrow" />
                </th>
              )}
              {domCols.has("retrievals") && (
                <th className="urls-th-num">Retrievals</th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="urls-empty">No {entityLabel.toLowerCase()}s match your filters.</td>
              </tr>
            )}
            {pageRows.map((d, i) => {
              const rank = (safePage - 1) * PAGE_SIZE + i + 1;
              const dt = domainTypeFor.get(d.domain) ?? "Other";
              const retrievedDelta = formatDeltaPct(d.retrievedShare - d.retrievedSharePrev);
              const retrievalDelta = formatDeltaRate(d.retrievalRate - d.retrievalRatePrev);
              const citationDelta = formatDeltaRate(d.citationRate - d.citationRatePrev);
              const isBookmarked = bookmarks.has(d.domain);
              return (
                <tr
                  key={d.domain}
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push("/domains/" + encodeURIComponent(d.domain))}
                >
                  <td className="domains-td-bm" onClick={(e) => handleBookmark(d.domain, e)}>
                    <Bookmark
                      size={13}
                      fill={isBookmarked ? "#f97316" : "none"}
                      color={isBookmarked ? "#f97316" : "#cbd5e1"}
                    />
                  </td>
                  <td className="domains-td-rank">{rank}</td>
                  <td className="domains-td-source">
                    <img src={faviconUrl(d.domain)} alt="" width={16} height={16} className="urls-favicon" />
                    <span className="domains-source-name">{d.domain}</span>
                  </td>
                  {domCols.has("domainType") && (
                    <td style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
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
                          onSelect={(type) => handleTypeOverride(d.domain, type)}
                          onReset={() => handleTypeReset(d.domain)}
                          onClose={() => setOpenTypeDropdown(null)}
                        />
                      )}
                    </td>
                  )}
                  {domCols.has("retrieved") && (
                    <td className="urls-td-num">
                      {showPrimary(d.retrievedShare.toFixed(1) + "%")}
                      {showDelta(retrievedDelta)}
                    </td>
                  )}
                  {domCols.has("retrievalRate") && (
                    <td className="urls-td-num">
                      {showPrimary(d.retrievalRate.toFixed(1))}
                      {showDelta(retrievalDelta)}
                    </td>
                  )}
                  {domCols.has("citationRate") && (
                    <td className="urls-td-num">
                      {showPrimary(d.citationRate.toFixed(1))}
                      {showDelta(citationDelta)}
                    </td>
                  )}
                  {domCols.has("retrievals") && (
                    <td className="urls-td-num">
                      <span className="urls-num-primary">{d.citations.toLocaleString()}</span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
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
