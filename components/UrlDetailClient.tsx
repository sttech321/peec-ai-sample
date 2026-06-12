"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ExternalLink, Search, ChevronDown, Download, ArrowUpDown,
  CircleDashed, X, ChevronLeft, ChevronRight, Check, Globe,
  RotateCcw, SlidersHorizontal,
} from "lucide-react";
import { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import {
  ChatFact, Resolution, filterByDateRange, toChatRecords, ChatRecordView,
} from "../lib/chat-aggregations";
import { DOMAIN_TYPE_COLORS, classifyDomain, DomainType } from "../lib/domain-aggregations";
import { URL_TYPE_COLORS, classifyUrl, formatRelative } from "../lib/url-aggregations";
import {
  computeUrlMeta,
  buildSingleUrlSeries,
  buildUrlRetrievalsByModel,
  buildUrlPromptStats,
  getUrlBrandMentions,
} from "../lib/url-detail-aggregations";

interface ProjectBrand { name: string; isOwn: boolean; domains?: string[] | null; }

interface Props {
  domain: string;
  url: string;
  chatFacts: ChatFact[];
  allChatFacts: ChatFact[];
  ownBrand: string | null;
  ownDomains: string[];
  competitorDomains: string[];
  projectBrands: ProjectBrand[];
  initialDomainTypeOverrides?: Record<string, string>;
  initialDomainBookmarks?: string[];
}

// ── Engine colors ─────────────────────────────────────────────────────────────
const ENGINE_COLORS: Record<string, string> = {
  claude:     "#7c3aed",
  chatgpt:    "#10a37f",
  gemini:     "#4285f4",
  perplexity: "#1c1c1c",
  groq:       "#f97316",
  google:     "#ea4335",
};
function engineColor(engine: string): string {
  return ENGINE_COLORS[engine.toLowerCase()] ?? "#64748b";
}

// ── Feature options ───────────────────────────────────────────────────────────
const CHAT_FEATURES = ["Shopping", "Product Comparison", "Ads", "Map", "Web Search", "No features"];

// ── Column config ─────────────────────────────────────────────────────────────
const COL_DEFAULT = new Set(["mentions", "sources", "features", "position", "created"]);
const COL_LABELS: Record<string, string> = {
  mentions: "Mentions", sources: "Sources", features: "Features",
  position: "Position", created: "Created", citations: "Citations",
};

// ── Brand highlight in response text ─────────────────────────────────────────
function HighlightedResponse({ text, brands }: { text: string; brands: string[] }) {
  if (!brands.length) return <span className="ud-response-text">{text}</span>;
  const escaped = brands.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);
  return (
    <span className="ud-response-text">
      {parts.map((part, i) =>
        brands.some((b) => b.toLowerCase() === part.toLowerCase())
          ? <mark key={i} className="ud-brand-highlight">{part}</mark>
          : part
      )}
    </span>
  );
}

// ── Domain favicon (tiny) ────────────────────────────────────────────────────
function TinyFavicon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return (
    <span className="ud-src-fallback">{domain.charAt(0).toUpperCase()}</span>
  );
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`}
      alt={domain} width={14} height={14} className="ud-src-favicon"
      onError={() => setFailed(true)} />
  );
}

// ── Generic multi-select filter dropdown ─────────────────────────────────────
function FilterDropdown({
  allLabel, searchPlaceholder, items, selected, mode,
  onToggle, onAll, onMode,
  renderItem,
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
      <div className="ud-fdrop-modes">
        <div role="button" className={`ud-fdrop-mode ${mode === "or" ? "active" : ""}`}
          onClick={() => onMode("or")}>Or</div>
        <div role="button" className={`ud-fdrop-mode ${mode === "and" ? "active" : ""}`}
          onClick={() => onMode("and")}>And</div>
      </div>
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
        {visible.length === 0 && (
          <div className="ud-fdrop-empty">No results</div>
        )}
      </div>
    </div>
  );
}

// ── Column selector popup ─────────────────────────────────────────────────────
function ColSelector({
  visible, onToggle, onReset,
}: {
  visible: Set<string>;
  onToggle: (k: string) => void;
  onReset: () => void;
}) {
  const active = (["mentions", "sources", "features", "position", "created"] as const)
    .filter((k) => visible.has(k));
  const available = ["citations"];
  return (
    <div className="ud-col-selector">
      <div className="ud-col-section-label">Fixed columns</div>
      <div className="ud-col-item">
        <span className="ud-fdrop-cb checked" style={{ opacity: 0.45, cursor: "not-allowed" }}>
          <Check size={9} strokeWidth={3} />
        </span>
        <span className="ud-fdrop-label">Chat</span>
      </div>
      <div className="ud-col-divider" />
      <div className="ud-col-section-label">Active columns</div>
      {["mentions", "sources", "features", "position", "created"].map((k) => (
        <div key={k} className="ud-col-item" onClick={() => onToggle(k)}>
          <span className={`ud-fdrop-cb ${visible.has(k) ? "checked" : ""}`}>
            {visible.has(k) && <Check size={9} strokeWidth={3} />}
          </span>
          <span className="ud-fdrop-label">{COL_LABELS[k]}</span>
        </div>
      ))}
      <div className="ud-col-divider" />
      <div className="ud-col-section-label">Available columns</div>
      {available.map((k) => (
        <div key={k} className="ud-col-item" onClick={() => onToggle(k)}>
          <span className={`ud-fdrop-cb ${visible.has(k) ? "checked" : ""}`}>
            {visible.has(k) && <Check size={9} strokeWidth={3} />}
          </span>
          <span className="ud-fdrop-label">{COL_LABELS[k]}</span>
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
function ExportMenu({ onExport }: { onExport: (fmt: "csv" | "xlsx" | "json") => void }) {
  return (
    <div className="ud-export-menu">
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

// ── Chat detail modal ─────────────────────────────────────────────────────────
function ChatDetailModal({
  fact, record, url,
  onClose, onPrev, onNext, hasPrev, hasNext,
}: {
  fact: ChatFact;
  record: ChatRecordView;
  url: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const eColor = engineColor(fact.engine);
  const brandNames = fact.brands.map((b) => b.name);
  const SOURCES_VISIBLE = 5;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  return (
    <div className="cdm-overlay" onClick={onClose}>
      <div className="cdm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cdm-header">
          <span className="ud-engine-badge"
            style={{ background: `${eColor}18`, color: eColor, borderColor: `${eColor}33`, fontSize: 12 }}>
            {fact.engine}
          </span>
          <span className="cdm-header-query">{record.query || "—"}</span>
          <div className="cdm-header-actions">
            <a href={url} target="_blank" rel="noopener noreferrer" className="cdm-view-prompt"
              onClick={(e) => e.stopPropagation()}>
              View prompt <ExternalLink size={10} style={{ display: "inline", marginLeft: 2 }} />
            </a>
            <button className="cdm-close" onClick={onClose} title="Close (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="cdm-body">
          <div className="cdm-response">
            {fact.rawResponse
              ? <HighlightedResponse text={fact.rawResponse} brands={brandNames} />
              : <span className="cdm-no-response">No response text available.</span>}
          </div>
          <div className="cdm-details">
            <div className="cdm-details-title">Details</div>
            {fact.brands.length > 0 && (
              <div className="cdm-section">
                <div className="cdm-section-label">Brands</div>
                {fact.brands.map((b, i) => (
                  <div key={b.name + i} className="cdm-brand-row">
                    <span className="cdm-brand-dot" style={{ background: engineColor(fact.engine) }} />
                    <span className="cdm-brand-name">{b.name}</span>
                    {b.position != null && <span className="cdm-brand-pos">• {b.position}</span>}
                  </div>
                ))}
              </div>
            )}
            {record.query && (
              <div className="cdm-section">
                <div className="cdm-section-label">Fanout queries</div>
                <div className="cdm-query-row">{record.query}</div>
              </div>
            )}
            {fact.sources.length > 0 && (
              <div className="cdm-section">
                <div className="cdm-section-label">Sources</div>
                {fact.sources.slice(0, SOURCES_VISIBLE).map((s, i) => (
                  <div key={(s.url || s.domain) + i} className="cdm-source-row">
                    <TinyFavicon domain={s.domain} />
                    <div className="cdm-source-meta">
                      <div className="cdm-source-title">
                        {s.title ? (s.title.length > 40 ? s.title.slice(0, 40) + "…" : s.title) : s.domain}
                      </div>
                      <div className="cdm-source-domain">{s.domain}</div>
                    </div>
                  </div>
                ))}
                {fact.sources.length > SOURCES_VISIBLE && (
                  <button className="cdm-view-all">
                    View all ({fact.sources.length - SOURCES_VISIBLE} more)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="cdm-footer">
          <button className="cdm-nav-btn" onClick={onPrev} disabled={!hasPrev}>
            <ChevronLeft size={14} /> Previous
          </button>
          <button className="cdm-nav-btn" onClick={onNext} disabled={!hasNext}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function localPrevPeriod(range: { start: Date; end: Date }) {
  const span = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - span - 1),
    end: new Date(range.start.getTime() - 1),
  };
}

function fmtDelta(v: number, pct = false) {
  if (Math.abs(v) < 0.05) return null;
  const text = (v > 0 ? "+" : "") + (pct ? v.toFixed(1) + "%" : String(v));
  return { text, tone: (v > 0 ? "up" : "down") as "up" | "down" };
}

function MetaCol({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ud-meta-col">
      <div className="ud-meta-label">{label}</div>
      <div className="ud-meta-val">{children}</div>
    </div>
  );
}

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UrlDetailClient({
  domain, url, chatFacts, allChatFacts,
  ownBrand, ownDomains, competitorDomains,
  projectBrands,
  initialDomainTypeOverrides,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"chats" | "prompts" | "brands">("chats");
  const [resolution, setResolution] = useState<Resolution>("D");
  const [dateRange] = useState<DateRangeValue>(() => makePresetRange("14"));

  // Prompts tab state
  const [promptSearch, setPromptSearch] = useState("");
  const [promptSort, setPromptSort] = useState<"retrieved" | "citationRate">("retrieved");
  const [promptSortDir, setPromptSortDir] = useState<"asc" | "desc">("desc");

  // Chats filter state (multi-select)
  const [openMenu, setOpenMenu] = useState<"brands" | "features" | "sources" | "columns" | "export" | null>(null);
  const [chatBrandFilters, setChatBrandFilters] = useState<string[]>([]);
  const [chatBrandMode, setChatBrandMode] = useState<"or" | "and">("or");
  const [chatFeatureFilters, setChatFeatureFilters] = useState<string[]>([]);
  const [chatFeatureMode, setChatFeatureMode] = useState<"or" | "and">("or");
  const [chatSourceFilters, setChatSourceFilters] = useState<string[]>([]);
  const [chatSourceMode, setChatSourceMode] = useState<"or" | "and">("or");
  const [chatSortDir, setChatSortDir] = useState<"newest" | "oldest">("newest");
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(COL_DEFAULT));

  // Modal state
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Close any open menu on outside click
  useEffect(() => {
    if (!openMenu) return;
    function handler(e: MouseEvent) {
      const target = e.target as Element;
      if (!target.closest(".ud-filter-wrapper")) setOpenMenu(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  const ownDomainSet = useMemo(
    () => new Set(ownDomains.map((d) => d.toLowerCase())), [ownDomains]
  );
  const competitorDomainSet = useMemo(
    () => new Set(competitorDomains.map((d) => d.toLowerCase())), [competitorDomains]
  );

  const domainType: DomainType = useMemo(() => {
    const override = (initialDomainTypeOverrides ?? {})[domain] as DomainType | undefined;
    return override ?? classifyDomain(null, domain, ownDomainSet, competitorDomainSet);
  }, [domain, initialDomainTypeOverrides, ownDomainSet, competitorDomainSet]);

  const filteredCurrent = useMemo(
    () => filterByDateRange(chatFacts, dateRange), [chatFacts, dateRange]
  );

  const filteredPrevious = useMemo(() => {
    const prev = localPrevPeriod(dateRange);
    return allChatFacts.filter(
      (c) =>
        c.sources.some((s) => s.url === url) &&
        new Date(c.runDate) >= prev.start &&
        new Date(c.runDate) <= prev.end
    );
  }, [allChatFacts, url, dateRange]);

  const meta = useMemo(
    () => computeUrlMeta(filteredCurrent, filteredPrevious, url),
    [filteredCurrent, filteredPrevious, url]
  );

  const chartSeries = useMemo(
    () => buildSingleUrlSeries(filteredCurrent, filteredPrevious, url, resolution, dateRange),
    [filteredCurrent, filteredPrevious, url, resolution, dateRange]
  );

  const byModel = useMemo(
    () => buildUrlRetrievalsByModel(filteredCurrent, filteredPrevious, url),
    [filteredCurrent, filteredPrevious, url]
  );
  const engineBarData = useMemo(
    () => byModel.map((m) => ({ engine: m.engine, Current: m.current, Previous: m.previous })),
    [byModel]
  );

  const rawPromptStats = useMemo(
    () => buildUrlPromptStats(filteredCurrent, url), [filteredCurrent, url]
  );
  const promptStats = useMemo(() => {
    let rows = rawPromptStats;
    if (promptSearch.trim()) {
      const q = promptSearch.trim().toLowerCase();
      rows = rows.filter((p) => p.query.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      const av = promptSort === "retrieved" ? a.retrieved : a.citationRate;
      const bv = promptSort === "retrieved" ? b.retrieved : b.citationRate;
      return promptSortDir === "asc" ? av - bv : bv - av;
    });
  }, [rawPromptStats, promptSearch, promptSort, promptSortDir]);

  function togglePromptSort(key: typeof promptSort) {
    if (promptSort === key) setPromptSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setPromptSort(key); setPromptSortDir("desc"); }
  }

  const brandMentions = useMemo(
    () => getUrlBrandMentions(filteredCurrent, url, ownBrand),
    [filteredCurrent, url, ownBrand]
  );

  // Raw ChatFact[] for this URL
  const urlChatFacts = useMemo(
    () => filteredCurrent.filter((c) => c.sources.some((s) => s.url === url)),
    [filteredCurrent, url]
  );

  // All unique brand names + source domains for filter options
  const allBrandOptions = useMemo(() => {
    const names = Array.from(new Set(urlChatFacts.flatMap((c) => c.brands.map((b) => b.name)))).sort();
    return ["__no_brand__", ...names];
  }, [urlChatFacts]);

  const allSourceDomains = useMemo(
    () => Array.from(new Set(urlChatFacts.flatMap((c) => c.sources.map((s) => s.domain)))).sort(),
    [urlChatFacts]
  );

  // Filtered + sorted chat records
  const chatRecords = useMemo(() => {
    let facts = urlChatFacts;

    // Brand filter (multi-select)
    if (chatBrandFilters.length > 0) {
      const includeNoBrand = chatBrandFilters.includes("__no_brand__");
      const brandNames = chatBrandFilters.filter((b) => b !== "__no_brand__");
      facts = facts.filter((c) => {
        if (chatBrandMode === "or") {
          if (includeNoBrand && c.brands.length === 0) return true;
          return brandNames.some((b) => c.brands.some((cb) => cb.name === b));
        } else {
          if (includeNoBrand && brandNames.length === 0) return c.brands.length === 0;
          return brandNames.every((b) => c.brands.some((cb) => cb.name === b));
        }
      });
    }

    // Source filter (by domain, multi-select)
    if (chatSourceFilters.length > 0) {
      facts = facts.filter((c) => {
        const chatDomains = c.sources.map((s) => s.domain.toLowerCase());
        if (chatSourceMode === "or") {
          return chatSourceFilters.some((d) => chatDomains.includes(d.toLowerCase()));
        } else {
          return chatSourceFilters.every((d) => chatDomains.includes(d.toLowerCase()));
        }
      });
    }

    // Feature filter — we don't have feature data; only "No features" matches
    if (chatFeatureFilters.length > 0 && !chatFeatureFilters.includes("No features")) {
      facts = [];
    }

    const sorted = [...facts].sort((a, b) => {
      const diff = new Date(b.runDate).getTime() - new Date(a.runDate).getTime();
      return chatSortDir === "newest" ? diff : -diff;
    });
    return toChatRecords(sorted).slice(0, 100);
  }, [urlChatFacts, chatBrandFilters, chatBrandMode, chatSourceFilters, chatSourceMode, chatFeatureFilters, chatSortDir]);

  // Modal helpers
  const selectedIndex = useMemo(
    () => chatRecords.findIndex((c) => c.id === selectedChatId),
    [chatRecords, selectedChatId]
  );
  const selectedRecord = selectedIndex >= 0 ? chatRecords[selectedIndex] : null;
  const selectedFact = useMemo(
    () => selectedRecord ? urlChatFacts.find((c) => c.id === selectedRecord.id) ?? null : null,
    [selectedRecord, urlChatFacts]
  );

  const openModal = useCallback((id: string) => setSelectedChatId(id), []);
  const closeModal = useCallback(() => setSelectedChatId(null), []);
  const goPrev = useCallback(() => {
    if (selectedIndex > 0) setSelectedChatId(chatRecords[selectedIndex - 1].id);
  }, [selectedIndex, chatRecords]);
  const goNext = useCallback(() => {
    if (selectedIndex < chatRecords.length - 1) setSelectedChatId(chatRecords[selectedIndex + 1].id);
  }, [selectedIndex, chatRecords]);

  // Export
  function exportAs(fmt: "csv" | "xlsx" | "json") {
    setOpenMenu(null);
    const rows = chatRecords.map((c) => ({
      engine: c.engine,
      query: c.query ?? "",
      mentions: c.brandsFound.length,
      sources: c.sourcesFound.length,
      position: Math.round(c.avgPosition) || 0,
      created: new Date(c.runDate).toLocaleDateString(),
    }));
    let content: string;
    let filename: string;
    let type: string;
    if (fmt === "json") {
      content = JSON.stringify(rows, null, 2);
      filename = `chats-${domain}.json`;
      type = "application/json";
    } else {
      // CSV (used for both CSV and XLSX — real XLSX needs a library)
      const header = ["Engine", "Query", "Mentions", "Sources", "Position", "Created"];
      const lines = [header, ...rows.map((r) => [r.engine, r.query, String(r.mentions), String(r.sources), String(r.position), r.created])];
      content = lines.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
      filename = `chats-${domain}.${fmt}`;
      type = "text/csv";
    }
    const a = document.createElement("a");
    a.href = `data:${type};charset=utf-8,` + encodeURIComponent(content);
    a.download = filename;
    a.click();
  }

  // Filter label helpers
  const brandLabel = chatBrandFilters.length === 0
    ? "All Brands"
    : `${chatBrandFilters.length} Brand${chatBrandFilters.length !== 1 ? "s" : ""}`;
  const featureLabel = chatFeatureFilters.length === 0
    ? "All Features"
    : `${chatFeatureFilters.length} Feature${chatFeatureFilters.length !== 1 ? "s" : ""}`;
  const sourceLabel = chatSourceFilters.length === 0
    ? "All Sources"
    : `${chatSourceFilters.length} Source${chatSourceFilters.length !== 1 ? "s" : ""}`;

  // Brand lookup for own-brand badge
  const ownBrandSet = useMemo(
    () => new Set(projectBrands.filter((b) => b.isOwn).map((b) => b.name)),
    [projectBrands]
  );

  const urlTitle = useMemo(() => {
    for (const c of chatFacts) {
      const src = c.sources.find((s) => s.url === url);
      if (src?.title) return src.title;
    }
    return null;
  }, [chatFacts, url]);

  const urlType = classifyUrl(url, urlTitle);
  const dtColor = (DOMAIN_TYPE_COLORS as Record<string, string>)[domainType] ?? "#64748b";
  const utColor = (URL_TYPE_COLORS as Record<string, string>)[urlType] ?? "#94a3b8";
  const displayUrl = url.replace(/^https?:\/\//, "");
  const retD = fmtDelta(meta.retrievalsDelta);
  const citD = fmtDelta(meta.citationRateDelta * 100, true);

  return (
    <div className="ins-page">

      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <div className="urls-breadcrumb">
        <span style={{ cursor: "pointer", color: "#64748b" }} onClick={() => router.push("/domains")}>
          Sources
        </span>
        <span className="urls-breadcrumb-sep">›</span>
        <span style={{ cursor: "pointer", color: "#64748b" }} onClick={() => router.push("/domains")}>
          Domains
        </span>
        <span className="urls-breadcrumb-sep">›</span>
        <span style={{ cursor: "pointer", color: "#64748b" }}
          onClick={() => router.push("/domains/" + encodeURIComponent(domain))}>
          {domain}
        </span>
        <span className="urls-breadcrumb-sep">›</span>
        <span style={{ cursor: "pointer", color: "#64748b" }}
          onClick={() => router.push("/domains/" + encodeURIComponent(domain))}>
          URLs
        </span>
        <span className="urls-breadcrumb-sep">›</span>
        <strong style={{
          color: "#0f172a", maxWidth: 260,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block",
        }}>
          {urlTitle || "Item"}
        </strong>
      </div>

      {/* ── URL Header ─────────────────────────────────────────────────── */}
      <div className="ud-header">
        <div className="ud-header-main">
          <h1 className="ud-title">{urlTitle || displayUrl}</h1>
          <div className="ud-url-row">
            <span className="ud-url-text">{displayUrl}</span>
            <a href={url} target="_blank" rel="noopener noreferrer" className="ud-view-page"
              onClick={(e) => e.stopPropagation()}>
              View page content <ExternalLink size={10} style={{ display: "inline", marginLeft: 2 }} />
            </a>
          </div>
        </div>
      </div>

      {/* ── Compact Meta Bar ───────────────────────────────────────────── */}
      <div className="ud-meta-bar">
        <MetaCol label="URL type">
          <span className="urls-pill" style={{ color: utColor, background: `${utColor}1A`, fontSize: 11 }}>
            {urlType}
          </span>
        </MetaCol>
        <MetaCol label="Domain type">
          <span className="urls-pill" style={{ color: dtColor, background: `${dtColor}1A`, fontSize: 11 }}>
            {domainType}
          </span>
        </MetaCol>
        <MetaCol label="Retrievals">
          <span className="ud-meta-num">{meta.retrievals}</span>
          {retD && <span className={`urls-num-delta tone-${retD.tone}`}>{retD.text}</span>}
        </MetaCol>
        <MetaCol label="Citation rate">
          <span className="ud-meta-num">{(meta.citationRate * 100).toFixed(1)}</span>
          {citD && <span className={`urls-num-delta tone-${citD.tone}`}>{citD.text}</span>}
        </MetaCol>
        <MetaCol label="No. of prompts">
          <span className="ud-meta-num">{meta.promptCount}</span>
        </MetaCol>
        <MetaCol label="First Seen">
          <span className="ud-meta-date">
            {meta.firstSeen ? new Date(meta.firstSeen).toLocaleDateString() : "—"}
          </span>
        </MetaCol>
        <MetaCol label="Last Seen">
          <span className="ud-meta-date">
            {meta.lastSeen ? formatRelative(meta.lastSeen) : "—"}
          </span>
        </MetaCol>
      </div>

      {/* ── Charts Row ─────────────────────────────────────────────────── */}
      <div className="ud-overview">
        <div className="ins-chart-card ud-chart-card">
          <div className="ins-chart-header">
            <div className="urls-chart-title">Retrievals</div>
            <div className="pd-resolution-toggle">
              {(["D", "W", "M"] as const).map((r) => (
                <button key={r} className={`pd-res-btn ${resolution === r ? "pd-res-active" : ""}`}
                  onClick={() => setResolution(r)}>{r}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" horizontal vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={{ stroke: "#e5e7eb" }} tickLine={false} dy={6} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip wrapperStyle={{ zIndex: 100 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="ch-tooltip">
                      <div className="ch-tooltip-date">{label}</div>
                      {payload.map((p) => (
                        <div key={String(p.dataKey)} className="ch-tooltip-row">
                          <span className="ch-tooltip-dot" style={{ background: p.color as string }} />
                          <span className="ch-tooltip-name">
                            {p.dataKey === "current" ? "Current Period" : "Previous Period"}
                          </span>
                          <span className="ch-tooltip-val">{String(p.value)}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="current" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="ud-chart-legend">
            <span className="ud-legend-chip">
              <span className="ud-legend-dot" style={{ background: "#f97316" }} /> Current Period
            </span>
            <span className="ud-legend-chip">
              <span className="ud-legend-dot ud-legend-dot--dashed" /> Previous Period
            </span>
          </div>
        </div>

        <div className="ins-chart-card ud-chart-card">
          <div className="ins-chart-header">
            <div className="urls-chart-title">Retrievals by model</div>
          </div>
          {engineBarData.length === 0 ? (
            <div className="urls-empty" style={{ padding: 40 }}>No engine data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={engineBarData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" horizontal vertical={false} />
                  <XAxis dataKey="engine" tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip wrapperStyle={{ zIndex: 100 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="ch-tooltip">
                          <div className="ch-tooltip-date">{label}</div>
                          {payload.map((p) => (
                            <div key={String(p.dataKey)} className="ch-tooltip-row">
                              <span className="ch-tooltip-dot" style={{ background: p.color as string }} />
                              <span className="ch-tooltip-name">
                                {p.dataKey === "Current" ? "Current Period" : "Previous Period"}
                              </span>
                              <span className="ch-tooltip-val">{String(p.value)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="Current" fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Previous" fill="#cbd5e1" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
              <div className="ud-chart-legend">
                <span className="ud-legend-chip">
                  <span className="ud-legend-dot" style={{ background: "#f97316" }} /> Current Period
                </span>
                <span className="ud-legend-chip">
                  <span className="ud-legend-dot" style={{ background: "#cbd5e1" }} /> Previous Period
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="dd-tabs">
        {(["chats", "prompts", "brands"] as const).map((t) => (
          <button key={t}
            className={`dd-tab ${tab === t ? "dd-tab--active" : ""}`}
            onClick={() => setTab(t)}>
            {t === "chats" ? "Chats" : t === "prompts" ? "Prompts" : "Brands mentioned"}
          </button>
        ))}
      </div>

      {/* ════ Prompts Tab ════════════════════════════════════════════════ */}
      {tab === "prompts" && (
        <div>
          <h2 className="urls-section-title">Prompts</h2>
          <p className="urls-section-subtitle">No. of times this URL was retrieved per prompt</p>
          <div className="ud-prompts-bar">
            <div className="urls-search">
              <Search size={14} className="urls-search-icon" />
              <input type="text" placeholder="Search prompts" value={promptSearch}
                onChange={(e) => setPromptSearch(e.target.value)} />
            </div>
          </div>
          <div className="urls-table-wrap">
            <table className="urls-table">
              <thead>
                <tr>
                  <th style={{ width: 36, color: "#94a3b8" }}>#</th>
                  <th>Prompts</th>
                  <th>Topic</th>
                  <th className="urls-th-num" style={{ cursor: "pointer" }}
                    onClick={() => togglePromptSort("retrieved")}>
                    Retrieved <ArrowUpDown size={10} style={{ marginLeft: 4, opacity: 0.5 }} />
                  </th>
                  <th className="urls-th-num" style={{ cursor: "pointer" }}
                    onClick={() => togglePromptSort("citationRate")}>
                    Citation rate <ArrowUpDown size={10} style={{ marginLeft: 4, opacity: 0.5 }} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {promptStats.length === 0 && (
                  <tr><td colSpan={5} className="urls-empty">No prompt data.</td></tr>
                )}
                {promptStats.map((p, i) => (
                  <tr key={p.query}>
                    <td style={{ color: "#94a3b8", fontWeight: 500 }}>{i + 1}</td>
                    <td style={{ fontWeight: 500, color: "#0f172a", maxWidth: 420 }}>{p.query}</td>
                    <td><span className="ud-no-topic">No Topic</span></td>
                    <td className="urls-td-num">
                      <span className="urls-num-primary">{p.retrieved}</span>
                    </td>
                    <td className="urls-td-num">
                      <span className="urls-num-primary">{p.citationRate.toFixed(1)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════ Brands Mentioned Tab ═══════════════════════════════════════ */}
      {tab === "brands" && (
        <div>
          <h2 className="urls-section-title">
            Brands mentioned{urlTitle ? ` in ${urlTitle}` : ""}
          </h2>
          <p className="urls-section-subtitle">
            Frequency and position of brand appearances in this URL
          </p>
          {brandMentions.length === 0 ? (
            <div className="ud-brands-empty">
              <CircleDashed size={36} strokeWidth={1.2} className="ud-brands-empty-icon" />
              <div className="ud-brands-empty-title">No brands mentioned</div>
              <div className="ud-brands-empty-sub">
                None of your tracked brands were found in this URL&apos;s content.
              </div>
            </div>
          ) : (
            <div className="urls-table-wrap">
              <table className="urls-table">
                <thead>
                  <tr>
                    <th style={{ width: 36, color: "#94a3b8" }}>#</th>
                    <th>Brand</th>
                    <th className="urls-th-num">Mentions</th>
                    <th className="urls-th-num">Avg position</th>
                  </tr>
                </thead>
                <tbody>
                  {brandMentions.map((b, i) => (
                    <tr key={b.brand}>
                      <td style={{ color: "#94a3b8", fontWeight: 500 }}>{i + 1}</td>
                      <td>
                        <span style={{ fontWeight: b.isOwn ? 700 : 500, color: "#0f172a" }}>
                          {b.brand}
                        </span>
                        {b.isOwn && (
                          <span className="urls-pill"
                            style={{ marginLeft: 8, color: "#7c4a1e", background: "#fff7ed", fontSize: 10 }}>
                            You
                          </span>
                        )}
                      </td>
                      <td className="urls-td-num">
                        <span className="urls-num-primary">{b.count}</span>
                      </td>
                      <td className="urls-td-num">
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════ Chats Tab ══════════════════════════════════════════════════ */}
      {tab === "chats" && (
        <div>
          {/* ── Header + filter bar ──────────────────────────────────── */}
          <div className="ud-chats-header">
            <div>
              <h2 className="urls-section-title" style={{ margin: 0 }}>All Chats</h2>
              <p className="urls-section-subtitle" style={{ margin: "2px 0 0" }}>
                All chats for this URL
              </p>
            </div>

            <div className="ud-chats-filters">

              {/* ── All Brands ─────────────────────────────────────── */}
              <div className="ud-filter-wrapper">
                <button
                  className={`pd-filter-chip ${chatBrandFilters.length > 0 ? "active" : ""}`}
                  onClick={() => setOpenMenu((m) => m === "brands" ? null : "brands")}>
                  {brandLabel} <ChevronDown size={11} />
                </button>
                {openMenu === "brands" && (
                  <FilterDropdown
                    allLabel="All Brands"
                    searchPlaceholder="Search brands..."
                    items={allBrandOptions}
                    selected={chatBrandFilters}
                    mode={chatBrandMode}
                    onToggle={(v) => setChatBrandFilters((f) => toggle(f, v))}
                    onAll={() => setChatBrandFilters([])}
                    onMode={setChatBrandMode}
                    renderItem={(item) =>
                      item === "__no_brand__" ? (
                        <span className="ud-fdrop-label">No brand mentioned</span>
                      ) : (
                        <span className="ud-fdrop-label">
                          {item}
                          {ownBrandSet.has(item) && <span className="ud-badge-you">You</span>}
                        </span>
                      )
                    }
                  />
                )}
              </div>

              {/* ── All Features ───────────────────────────────────── */}
              <div className="ud-filter-wrapper">
                <button
                  className={`pd-filter-chip ${chatFeatureFilters.length > 0 ? "active" : ""}`}
                  onClick={() => setOpenMenu((m) => m === "features" ? null : "features")}>
                  {featureLabel} <ChevronDown size={11} />
                </button>
                {openMenu === "features" && (
                  <FilterDropdown
                    allLabel="All Features"
                    items={CHAT_FEATURES}
                    selected={chatFeatureFilters}
                    mode={chatFeatureMode}
                    onToggle={(v) => setChatFeatureFilters((f) => toggle(f, v))}
                    onAll={() => setChatFeatureFilters([])}
                    onMode={setChatFeatureMode}
                  />
                )}
              </div>

              {/* ── All Sources ────────────────────────────────────── */}
              <div className="ud-filter-wrapper">
                <button
                  className={`pd-filter-chip ${chatSourceFilters.length > 0 ? "active" : ""}`}
                  onClick={() => setOpenMenu((m) => m === "sources" ? null : "sources")}>
                  {sourceLabel} <ChevronDown size={11} />
                </button>
                {openMenu === "sources" && (
                  <FilterDropdown
                    allLabel="All Sources"
                    searchPlaceholder="Search sources..."
                    items={allSourceDomains}
                    selected={chatSourceFilters}
                    mode={chatSourceMode}
                    onToggle={(v) => setChatSourceFilters((f) => toggle(f, v))}
                    onAll={() => setChatSourceFilters([])}
                    onMode={setChatSourceMode}
                  />
                )}
              </div>

              {/* ── Column selector ────────────────────────────────── */}
              <div className="ud-filter-wrapper">
                <button className="ud-icon-btn" title="Columns"
                  onClick={() => setOpenMenu((m) => m === "columns" ? null : "columns")}>
                  <SlidersHorizontal size={14} />
                </button>
                {openMenu === "columns" && (
                  <ColSelector
                    visible={visibleCols}
                    onToggle={(k) => setVisibleCols((s) => {
                      const next = new Set(s);
                      if (next.has(k)) next.delete(k); else next.add(k);
                      return next;
                    })}
                    onReset={() => setVisibleCols(new Set(COL_DEFAULT))}
                  />
                )}
              </div>

              {/* ── Export ─────────────────────────────────────────── */}
              <div className="ud-filter-wrapper">
                <button className="ud-icon-btn" title="Export"
                  onClick={() => setOpenMenu((m) => m === "export" ? null : "export")}>
                  <Download size={14} />
                </button>
                {openMenu === "export" && <ExportMenu onExport={exportAs} />}
              </div>

              {/* ── Sort (newest/oldest) ────────────────────────────── */}
              <button className="ud-icon-btn"
                title={chatSortDir === "newest" ? "Newest first" : "Oldest first"}
                onClick={() => setChatSortDir((d) => d === "newest" ? "oldest" : "newest")}>
                <ArrowUpDown size={14} />
              </button>
            </div>
          </div>

          {/* ── Chats table ──────────────────────────────────────────── */}
          <div className="urls-table-wrap">
            <table className="urls-table ud-chats-table">
              <thead>
                <tr>
                  <th className="ud-th-chat">Chat</th>
                  {visibleCols.has("mentions") && <th className="urls-th-num">Mentions</th>}
                  {visibleCols.has("sources") && <th className="urls-th-num">Sources</th>}
                  {visibleCols.has("features") && <th className="urls-th-num">Features</th>}
                  {visibleCols.has("citations") && <th className="urls-th-num">Citations</th>}
                  {visibleCols.has("position") && <th className="urls-th-num">Position</th>}
                  {visibleCols.has("created") && <th className="urls-th-num">Created</th>}
                </tr>
              </thead>
              <tbody>
                {chatRecords.length === 0 && (
                  <tr><td colSpan={7} className="urls-empty">No chats in this period.</td></tr>
                )}
                {chatRecords.map((c) => {
                  const eColor = engineColor(c.engine);
                  const pos = Math.round(c.avgPosition);
                  const ICON_MAX = 3;
                  const visibleSources = c.sourcesFound.slice(0, ICON_MAX);
                  const extraSources = c.sourcesFound.length - ICON_MAX;
                  return (
                    <tr key={c.id} className="ud-chat-tr"
                      onClick={() => openModal(c.id)}
                      title="Click to view full chat">
                      {/* Chat column */}
                      <td className="ud-td-chat">
                        <div className="ud-chat-top">
                          <span className="ud-engine-badge"
                            style={{ background: `${eColor}18`, color: eColor, borderColor: `${eColor}33` }}>
                            {c.engine}
                          </span>
                          <span className="ud-chat-query">{c.query || "—"}</span>
                        </div>
                        {c.rawResponse && (
                          <p className="ud-chat-snippet">{c.rawResponse.slice(0, 180)}…</p>
                        )}
                      </td>

                      {/* Mentions */}
                      {visibleCols.has("mentions") && (
                        <td className="urls-td-num">
                          <span className="ud-chat-count">{c.brandsFound.length}</span>
                        </td>
                      )}

                      {/* Sources: favicon icons + overflow */}
                      {visibleCols.has("sources") && (
                        <td className="urls-td-num">
                          <div className="ud-src-icons">
                            {visibleSources.map((s, i) => (
                              <TinyFavicon key={s.domain + i} domain={s.domain} />
                            ))}
                            {extraSources > 0 && (
                              <span className="ud-src-overflow">+{extraSources}</span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Features */}
                      {visibleCols.has("features") && (
                        <td className="urls-td-num">
                          <Globe size={14} className="ud-globe-icon" />
                        </td>
                      )}

                      {/* Citations (same as sources count) */}
                      {visibleCols.has("citations") && (
                        <td className="urls-td-num">
                          <span className="ud-chat-count">{c.sourcesFound.length}</span>
                        </td>
                      )}

                      {/* Position */}
                      {visibleCols.has("position") && (
                        <td className="urls-td-num">
                          {pos > 0
                            ? <span className="ud-position-badge">{pos}</span>
                            : <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>}
                        </td>
                      )}

                      {/* Created */}
                      {visibleCols.has("created") && (
                        <td className="urls-td-num">
                          <span className="ud-chat-date">{formatRelative(c.runDate)}</span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Chat count footer */}
          {chatRecords.length > 0 && (
            <div className="ud-chat-count-footer">
              {chatRecords.length} chat{chatRecords.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* ════ Chat Detail Modal ═══════════════════════════════════════════ */}
      {selectedFact && selectedRecord && (
        <ChatDetailModal
          fact={selectedFact}
          record={selectedRecord}
          url={url}
          onClose={closeModal}
          onPrev={goPrev}
          onNext={goNext}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex < chatRecords.length - 1}
        />
      )}
    </div>
  );
}
