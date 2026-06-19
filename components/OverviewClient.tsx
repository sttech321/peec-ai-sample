"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { utils as xlsxUtils, writeFile as xlsxWriteFile } from "xlsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Settings, ChevronDown, Copy, Download, ImageIcon, MoreHorizontal,
} from "lucide-react";
import {
  HiMiniChevronUp, HiMiniChevronDown,
  HiOutlineChevronDown, HiOutlineChevronUp,
  HiOutlineArrowTrendingUp, HiOutlineArrowTrendingDown,
} from "react-icons/hi2";
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
  tagNames?: string[] | null;
  topicNames?: string[] | null;
}

interface Props {
  chatFacts: ChatFact[];
  projectName: string;
  projectBrands: ProjectBrand[];
  externalFilters?: OverviewExternalFilters;
  chatTopicMap?: Record<string, string>;
  chatTagsMap?: Record<string, string[]>;
  initialDomainTypeOverrides?: Record<string, string>;
  updateDomainTypeOverrideAction?: (domain: string, type: string | null) => Promise<{ ok: boolean; error?: string }>;
  brandColorOverrides?: Record<string, string>;
  onBrandColorChange?: (brandName: string, color: string) => void;
}

function SortIcon({ sortDir }: { sortDir: "asc" | "desc" | null }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", lineHeight: 1, gap: "1px" }}>
      <HiMiniChevronUp  size={8} style={{ opacity: sortDir === "asc"  ? 1 : sortDir === "desc" ? 0.22 : 0.38 }} />
      <HiMiniChevronDown size={8} style={{ opacity: sortDir === "desc" ? 1 : sortDir === "asc"  ? 0.22 : 0.38 }} />
    </span>
  );
}

export default function OverviewClient({
  chatFacts, projectName, projectBrands, externalFilters,
  chatTopicMap = {}, chatTagsMap = {},
  initialDomainTypeOverrides, updateDomainTypeOverrideAction,
  brandColorOverrides = {}, onBrandColorChange,
}: Props) {
  const router = useRouter();
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
  const [chatExportOpen, setChatExportOpen]       = useState(false);
  const chatExportRef                             = useRef<HTMLDivElement>(null);

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
  // Default: Visibility High-Low (highest value brands first)
  const [brandSortCol,  setBrandSortCol]  = useState<BrandSortCol>("visibility");
  const [brandSortMode, setBrandSortMode] = useState<BrandSortMode>("high-low");
  const [openBrandMenu,  setOpenBrandMenu]  = useState<BrandSortCol | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node))
        setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportMenuOpen]);

  // Chart download menu
  const [chartMenuOpen, setChartMenuOpen] = useState(false);
  const chartCardRef = useRef<HTMLDivElement>(null);
  const chartMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!chartMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (chartMenuRef.current && !chartMenuRef.current.contains(e.target as Node))
        setChartMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [chartMenuOpen]);

  const ownBrandNames = useMemo(
    () => new Set(projectBrands.filter((b) => b.isOwn).map((b) => b.name)),
    [projectBrands],
  );

  const brandDomainMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of projectBrands) {
      if (b.domains && b.domains.length > 0 && b.domains[0]) {
        m.set(b.name, b.domains[0]);
      }
    }
    return m;
  }, [projectBrands]);

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

  // Reset Top 7 sort to "Visibility High-Low" whenever primary filters change
  // so the user always sees the highest-value brands first after any filter update
  useEffect(() => {
    setBrandSortCol("visibility");
    setBrandSortMode("high-low");
    setOpenBrandMenu(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDateRange.start.getTime(), effectiveDateRange.end.getTime(), effectiveModels.join(","), effectiveBrandIds?.join(",")]);

  // Stable color map: palette colors merged with DB-saved colors (DB takes priority)
  const stableBrandColors = useMemo(() => {
    const all = aggregateBrands(chatFacts, 20);
    const map: Record<string, string> = {};
    for (const b of all) map[b.name] = b.color;
    return { ...map, ...brandColorOverrides }; // saved colors override palette
  }, [chatFacts, brandColorOverrides]);

  const effectiveTagNames  = externalFilters?.tagNames  ?? null;
  const effectiveTopicNames = externalFilters?.topicNames ?? null;

  // ── Filtered derivations ──────────────────────────────────────────────
  const filteredChats = useMemo(() => {
    let facts = filterByDateRange(filterByEngines(chatFacts, effectiveModels), effectiveDateRange);
    if (effectiveTagNames && effectiveTagNames.length > 0) {
      facts = facts.filter((c) => {
        const t = chatTagsMap[c.id];
        return t && t.some((tag) => effectiveTagNames.includes(tag));
      });
    }
    if (effectiveTopicNames && effectiveTopicNames.length > 0) {
      facts = facts.filter((c) => {
        const topic = chatTopicMap[c.id];
        return topic !== undefined && effectiveTopicNames.includes(topic);
      });
    }
    return facts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatFacts, effectiveModels, effectiveDateRange, effectiveTagNames, effectiveTopicNames, chatTopicMap, chatTagsMap]);

  // ── Current period (date-filtered) — SOV denominator + display metrics ─────────
  const allBrands = useMemo(
    () => aggregateBrands(filteredChats, 9999, undefined, stableBrandColors),
    [filteredChats, stableBrandColors]
  );
  const totalAllBrandCount = useMemo(
    () => allBrands.reduce((s, b) => s + b.count, 0),
    [allBrands]
  );
  // Quick lookup for display metrics in table rows
  const currentPeriodMap = useMemo(() => {
    const m = new Map<string, typeof allBrands[0]>();
    for (const b of allBrands) m.set(b.name, b);
    return m;
  }, [allBrands]);

  // ── 6-month pool — NO date filter, engine filter only ───────────────────────
  // Used for stable TOP 7 selection & sorting (brands don't disappear in short windows)
  const allBrandsFullPeriod = useMemo(
    () => aggregateBrands(filterByEngines(chatFacts, effectiveModels), 9999, undefined, stableBrandColors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatFacts, effectiveModels, stableBrandColors]
  );
  // Filtered pool (by brand selector if active)
  const brands = useMemo(() => {
    return effectiveBrandIds === null
      ? allBrandsFullPeriod
      : allBrandsFullPeriod.filter((b) => effectiveBrandIds.includes(b.name));
  }, [allBrandsFullPeriod, effectiveBrandIds]);

  const domains = useMemo(() => aggregateDomains(filteredChats, 10), [filteredChats]);
  const totalDomainCitations = useMemo(() => totalCitations(filteredChats), [filteredChats]);

  // chartData and barData defined after chartBrands (further below)

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

  // ── Step 1: TOP 7 POOL — always the 7 most visible brands (Visibility High-Low)
  // Pool never changes with sort direction; sort only affects display ORDER
  const top7Pool = useMemo(() => {
    const byVisDesc = [...brands].sort((a, b) => {
      const ca = currentPeriodMap.get(a.name);
      const cb = currentPeriodMap.get(b.name);
      return (cb?.count ?? 0) - (ca?.count ?? 0);  // always descending (highest first)
    });
    return byVisDesc.slice(0, 7);
  }, [brands, currentPeriodMap]);

  // ── Step 2: SORTED BRANDS — reorder the same top 7 by user's selected column/direction
  const sortedBrands = useMemo(() => {
    const list = [...top7Pool];
    // dir = 1 for HIGH-LOW (descending: highest first)
    // dir = -1 for LOW-HIGH (ascending: lowest first)
    const dir = (brandSortMode === "high-low" || brandSortMode === "negative-trend") ? 1 : -1;
    list.sort((a, b) => {
      const ca = currentPeriodMap.get(a.name);
      const cb = currentPeriodMap.get(b.name);
      if (brandSortCol === "visibility" || brandSortCol === "sov") {
        return dir * ((cb?.count ?? 0) - (ca?.count ?? 0));
      }
      if (brandSortCol === "sentiment") {
        return dir * ((cb?.sentiment ?? 0) - (ca?.sentiment ?? 0));
      }
      if (brandSortCol === "position") {
        const posA = ca?.position && ca.position > 0 ? ca.position : 999;
        const posB = cb?.position && cb.position > 0 ? cb.position : 999;
        return -dir * (posB - posA);
      }
      return 0;
    });
    return list;
  }, [top7Pool, brandSortCol, brandSortMode, currentPeriodMap]);

  // chartBrands = sortedBrands (same 7 pool, user-selected order)
  const chartBrands = useMemo(() => sortedBrands, [sortedBrands]);
  // chartData and barData defined AFTER pinnedOwnBrand (further below)

  // ── Pinned own brand (Peec AI behavior) ──────────────────────────────────
  // ALWAYS shown when own brand not in top 7 — even with 0% visibility
  const pinnedOwnBrand = useMemo(() => {
    // Already in top 7 → no need to pin
    const ownBrandInTop7 = chartBrands.some(b => ownBrandNames.has(b.name));
    if (ownBrandInTop7) return null;

    // Find own brand from projectBrands (always available, even with 0 mentions)
    const ownProjectBrand = projectBrands.find(b => b.isOwn);
    if (!ownProjectBrand) return null;

    const ownName = ownProjectBrand.name;

    // Rank = position in current period Visibility High-Low
    // If 0 mentions → rank = last position + 1 (below all mentioned brands)
    const currentByVisDesc = [...allBrands].sort((a, b) => b.count - a.count);
    const ownIdx = currentByVisDesc.findIndex(b => b.name === ownName);
    const rank = ownIdx === -1
      ? currentByVisDesc.length + 1   // 0 mentions → rank at bottom
      : ownIdx + 1;

    // Build BrandAgg-compatible object for display
    // Use 6-month data if available, else fallback to zeros
    const brand6m = brands.find(b => b.name === ownName);
    const stableColor = stableBrandColors[ownName] ?? "#6366f1";
    const brandForDisplay = brand6m ?? {
      name:      ownName,
      count:     0,
      sentiment: 0,
      position:  0,
      color:     stableColor,
    };

    return { brand: brandForDisplay, rank };
  }, [chartBrands, ownBrandNames, projectBrands, allBrands, brands, stableBrandColors]);

  // Chart shows exactly what table shows:
  // - Own brand in top 7 → show all 7 (chartBrands)
  // - Own brand pinned → show top 6 + own brand = 7 chart lines (Apache etc. replaced by own brand)
  const chartBrandsForDisplay = useMemo(() => {
    if (!pinnedOwnBrand) return chartBrands;
    return [...chartBrands.slice(0, 6), pinnedOwnBrand.brand];
  }, [chartBrands, pinnedOwnBrand]);

  const chartData = useMemo(
    () => {
      const series = buildVisibilitySeries(filteredChats, chartBrandsForDisplay.map((b) => b.name), resolution, effectiveDateRange);
      // Ensure own brand (possibly 0 mentions) has 0 values at each point so its line renders
      if (pinnedOwnBrand) {
        const ownName = pinnedOwnBrand.brand.name;
        return series.map(point => ({
          ...point,
          [ownName]: (point as Record<string, unknown>)[ownName] ?? 0,
        }));
      }
      return series;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredChats, chartBrandsForDisplay, pinnedOwnBrand, resolution, effectiveDateRange],
  );

  const barData = useMemo(() => {
    const total = filteredChats.length;
    return chartBrandsForDisplay.map(b => {
      const cb = currentPeriodMap.get(b.name);
      return {
        name:   b.name,
        value:  cb && total > 0 ? Math.round((cb.count / total) * 100) : 0,
        color:  b.color,
        domain: guessBrandDomain(b.name),
      };
    });
  }, [chartBrandsForDisplay, currentPeriodMap, filteredChats]);


  // ── Chart export ─────────────────────────────────────────────────────────
  const chartExportDateLabel = `${effectiveDateRange.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${effectiveDateRange.end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const chartExportDaysLabel = effectiveDateRange.preset === "all"
    ? "All time"
    : `${Math.round((effectiveDateRange.end.getTime() - effectiveDateRange.start.getTime()) / 86400000)} days`;
  const chartExportResLabel = resolution === "D" ? "Daily" : resolution === "W" ? "Weekly" : "Monthly";

  function exportChartCsv() {
    setChartMenuOpen(false);
    const dates = chartData.map((d) => String(d.date));
    const rows = chartBrandsForDisplay.map((b) => [
      b.name,
      ...chartData.map((d) => {
        const v = (d as Record<string, unknown>)[b.name];
        return v !== undefined && isFinite(Number(v)) ? `${Number(v).toFixed(2)}%` : "";
      }),
    ]);
    const csv = [["brand", ...dates], ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const today = new Date().toISOString().split("T")[0];
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `visibility_export_from-${today}.csv`;
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
      a.download = "visibility.png";
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
        catch { const a = document.createElement("a"); a.download = "visibility.png"; a.href = canvas.toDataURL("image/png"); a.click(); }
      }, "image/png");
    } finally { card.removeAttribute("data-exporting"); }
  }

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

  // ── Export data builder ─────────────────────────────────────────────────────
  const buildExportRows = useCallback(() => {
    const total     = filteredChats.length;
    const prevTotal = prevFilteredChats.length;
    const allByVisDesc = [...brands].sort((a, b) => {
      const ca = currentPeriodMap.get(a.name);
      const cb = currentPeriodMap.get(b.name);
      return (cb?.count ?? 0) - (ca?.count ?? 0);
    });
    return allByVisDesc.map((b, idx) => {
      const cb        = currentPeriodMap.get(b.name);
      const pb        = prevBrands.find(p => p.name === b.name);
      const vis       = cb && total > 0      ? cb.count / total      : 0;
      const pVis      = pb && prevTotal > 0  ? pb.count / prevTotal  : 0;
      const sov       = cb && totalAllBrandCount > 0 ? cb.count / totalAllBrandCount : 0;
      const prevSovD  = prevBrands.reduce((s, p) => s + p.count, 0);
      const pSov      = pb && prevSovD > 0   ? pb.count / prevSovD   : 0;
      return {
        rank:                  idx + 1,
        brand_id:              `brand_${b.name.toLowerCase().replace(/\s+/g, "_").slice(0, 20)}`,
        brand:                 b.name,
        domain:                b.name ? guessBrandDomain(b.name) : "",
        days_to_process:       0,
        is_processing:         false,
        visibility:            parseFloat(vis.toFixed(4)),
        visibility_delta:      parseFloat((vis - pVis).toFixed(4)),
        share_of_voice:        parseFloat(sov.toFixed(4)),
        share_of_voice_delta:  parseFloat((sov - pSov).toFixed(4)),
        sentiment:             cb?.sentiment ? Math.round(cb.sentiment) : "",
        sentiment_delta:       pb?.sentiment && cb?.sentiment ? Math.round(cb.sentiment - pb.sentiment) : "",
        position:              cb?.position  ? parseFloat(cb.position.toFixed(2)) : "",
        position_delta:        pb?.position  && cb?.position ? parseFloat((cb.position - pb.position).toFixed(2)) : "",
      };
    });
  }, [brands, filteredChats, prevFilteredChats, currentPeriodMap, prevBrands, totalAllBrandCount]);

  const handleExport = useCallback((format: "csv" | "xlsx" | "json") => {
    const rows = buildExportRows();
    const date = new Date().toISOString().slice(0, 10);
    const fname = `top-brandsexportfrom-${date}`;

    if (format === "json") {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${fname}.json`; a.click();
    } else if (format === "csv") {
      const cols = Object.keys(rows[0] ?? {});
      const lines = [cols.join(","), ...rows.map(r => cols.map(c => {
        const v = String((r as Record<string, unknown>)[c] ?? "");
        return v.includes(",") ? `"${v}"` : v;
      }).join(","))];
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${fname}.csv`; a.click();
    } else {
      const ws = xlsxUtils.json_to_sheet(rows);
      const wb = xlsxUtils.book_new();
      xlsxUtils.book_append_sheet(wb, ws, "Top Brands");
      xlsxWriteFile(wb, `${fname}.xlsx`);
    }
    setExportMenuOpen(false);
  }, [buildExportRows]);

  // ── All Chats export ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatExportOpen) return;
    const handler = (e: MouseEvent) => {
      if (chatExportRef.current && !chatExportRef.current.contains(e.target as Node))
        setChatExportOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [chatExportOpen]);

  const handleChatExport = useCallback((format: "csv" | "xlsx" | "json") => {
    // Export ALL filtered chats (not just current page)
    const rows = filteredChatRows.map((c) => ({
      id:                  c.id,
      promptId:            c.query ?? "",
      model:               c.engine,
      assistant:           c.rawResponse ?? "",
      mentions:            c.brandsFound.join(", "),
      sources:             c.sourcesFound.map(s => s.domain).join(", "),
      content_in_sources:  c.sourcesFound.map(s => s.title ?? s.url ?? "").filter(Boolean).join(", "),
      citations:           c.sourcesFound.length,
      position:            c.avgPosition > 0 ? c.avgPosition.toFixed(1) : "",
      created:             c.runDate,
    }));

    const date  = new Date().toISOString().slice(0, 10);
    const fname = `chatsexport${date}from-${date}`;

    if (format === "json") {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${fname}.json`; a.click();
    } else if (format === "csv") {
      const cols  = Object.keys(rows[0] ?? {});
      const lines = [cols.join(","), ...rows.map(r => cols.map(c => {
        const v = String((r as Record<string, unknown>)[c] ?? "");
        return v.includes(",") || v.includes('"') || v.includes("\n")
          ? `"${v.replace(/"/g, '""')}"`
          : v;
      }).join(","))];
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${fname}.csv`; a.click();
    } else {
      const ws = xlsxUtils.json_to_sheet(rows);
      const wb = xlsxUtils.book_new();
      xlsxUtils.book_append_sheet(wb, ws, "All Chats");
      xlsxWriteFile(wb, `${fname}.xlsx`);
    }
    setChatExportOpen(false);
  }, [filteredChatRows]);

  return (
    <div className="prompt-detail-page">
      {selectedChat && <ChatModal chat={selectedChat} onClose={() => setSelectedChat(null)} />}
      <div className="pd-topbar">
        <div className="pd-breadcrumb">
          <a href="/" className="pd-breadcrumb-link">Dashboard</a>
          <span className="pd-breadcrumb-sep">&gt;</span>
          <span className="pd-breadcrumb-current">Overview</span>
        </div>
      </div>

      <div className="pd-section">
        <h2 className="pd-section-title">Overview</h2>
        <p className="pd-section-subtitle">How often each brand appears in AI generated discussions</p>

        <div className="pd-overview-grid">
          <div className="pd-chart-card" ref={chartCardRef}>
            {/* Export-only title (hidden in UI, shown during image capture) */}
            <div className="ch-chart-export-title">
              <span className="ch-export-metric">Visibility · {chartExportDateLabel}</span>
              <span className="ch-export-period">{chartExportDaysLabel} · {chartExportResLabel}</span>
            </div>
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
                {/* Chart download menu */}
                <div className="ch-chart-menu-wrap" ref={chartMenuRef}>
                  <button className="ch-dots-btn" title="Export options"
                    onClick={() => setChartMenuOpen((o) => !o)}>
                    <MoreHorizontal size={15} />
                  </button>
                  {chartMenuOpen && (
                    <div className="ch-chart-menu">
                      <button className="ch-chart-menu-item" onClick={exportChartCsv}>
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
                      const ownBrandName = pinnedOwnBrand?.brand.name ?? null;
                      const sorted = [...payload]
                        // Show all brands with value > 0 OR own brand (even at 0%)
                        .filter(p => (p.value as number) > 0 || p.dataKey === ownBrandName)
                        .sort((a, b) => ((b.value as number) ?? 0) - ((a.value as number) ?? 0));
                      const pc = promptsPerDate.get(label as string) ?? 0;
                      return (
                        <div className="ch-tooltip">
                          <div className="ch-tooltip-date">{label}</div>
                          {sorted.map(p => {
                            const isOwn = p.dataKey === ownBrandName;
                            return (
                              <div key={p.dataKey as string} className={`ch-tooltip-row${isOwn ? " ch-tooltip-row--own" : ""}`}>
                                <span className="ch-tooltip-dot" style={{ background: p.color as string }} />
                                <DomainFavicon domain={guessBrandDomain(p.dataKey as string)} size={13} />
                                <span className="ch-tooltip-name">{p.dataKey as string}</span>
                                <span className="ch-tooltip-val">{((p.value as number) ?? 0).toFixed(1)}%</span>
                                {isOwn && <span className="ch-tooltip-you">You</span>}
                              </div>
                            );
                          })}
                          {pc > 0 && <div className="ch-tooltip-footer">{pc} new prompts created</div>}
                        </div>
                      );
                    }}
                  />
                  {chartBrandsForDisplay.map((b) => {
                    const isHov   = hoveredBrand === b.name;
                    const faded   = hoveredBrand !== null && !isHov;
                    const isOwn   = ownBrandNames.has(b.name);
                    return (
                      <Line
                        key={b.name}
                        type="monotone"
                        dataKey={b.name}
                        stroke={b.color}
                        strokeWidth={isHov ? 2.8 : isOwn ? 2.0 : 1.8}
                        strokeOpacity={faded ? 0.1 : 1}
                        strokeDasharray={isOwn ? "5 3" : undefined}
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
              {/* Right group: action icons + Show all button */}
              <div className="pd-brands-header-right">
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

                {/* Export button + dropdown */}
                <div ref={exportMenuRef} style={{ position: "relative" }}>
                  <button
                    className={`pd-brands-action-btn ${exportMenuOpen ? "pd-brands-action-btn--active" : ""}`}
                    title="Export"
                    onClick={() => setExportMenuOpen(v => !v)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </button>
                  {exportMenuOpen && (
                    <div className="pd-export-menu">
                      <div className="pd-export-label">Export format</div>
                      {(["CSV", "XLSX", "JSON"] as const).map(fmt => (
                        <button
                          key={fmt}
                          className="pd-export-option"
                          onClick={() => handleExport(fmt.toLowerCase() as "csv" | "xlsx" | "json")}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="pd-brands-action-btn" title="View all rankings" onClick={() => router.push("/ranking")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 480 480" fill="none" aria-hidden="true"><path d="M120 260.01v60C120 342.09 137.91 360 159.99 360h60" stroke="currentColor" strokeWidth="39.9" strokeLinecap="round" strokeLinejoin="round"/><path d="M260.01 120h60C342.09 120 360 137.91 360 159.99v60" stroke="currentColor" strokeWidth="39.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              </div>{/* end pd-brands-header-right */}
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
                    const sortDir: "asc" | "desc" | null = isActive
                      ? (brandSortMode === "high-low" || brandSortMode === "negative-trend" ? "desc" : "asc")
                      : null;
                    // Right-align sort menu for last 2 columns to avoid overflow
                    const menuRight = colIdx >= 2;
                    return (
                      <th key={col} style={{ position: "relative" }}>
                        <span
                          className={`pd-brands-th-btn ${isActive || menuOpen ? "pd-brands-th-active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); setOpenBrandMenu(menuOpen ? null : col); }}
                        >
                          {labels[col]}
                          <span className="pd-th-arrow">
                            <SortIcon sortDir={sortDir} />
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
                            {/* Value-based sorts */}
                            {([
                              { mode: "high-low" as BrandSortMode, icon: <HiOutlineChevronDown size={13} />, keyword: "Value", direction: "High - low" },
                              { mode: "low-high" as BrandSortMode, icon: <HiOutlineChevronUp size={13} />, keyword: "Value", direction: "Low - high" },
                            ]).map(opt => {
                              const isChecked = brandSortCol === col && brandSortMode === opt.mode;
                              return (
                                <div
                                  key={opt.mode}
                                  className={`pd-sort-option ${isChecked ? "pd-sort-active" : ""}`}
                                  onClick={() => { setBrandSortCol(col); setBrandSortMode(opt.mode); setOpenBrandMenu(null); }}
                                >
                                  <span className="pd-sort-opt-icon">{opt.icon}</span>
                                  <span className="pd-sort-value-keyword">{opt.keyword}</span>
                                  <span style={{ flex: 1 }}>{opt.direction}</span>
                                  {isChecked && <span className="pd-sort-check">✓</span>}
                                </div>
                              );
                            })}
                            {/* Divider between value and trend sorts */}
                            <div className="pd-sort-divider" />
                            {/* Trend-based sorts */}
                            {([
                              { mode: "positive-trend" as BrandSortMode, icon: <HiOutlineArrowTrendingUp size={13} />, label: "Positive trend" },
                              { mode: "negative-trend" as BrandSortMode, icon: <HiOutlineArrowTrendingDown size={13} />, label: "Negative trend" },
                            ]).map(opt => {
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
                {/* Exactly 7 brands — 6 from chartBrands if own brand pinned at bottom */}
                {(pinnedOwnBrand ? chartBrands.slice(0, 6) : chartBrands).map((b, i) => {
                  // Display metrics from currentPeriodMap (current date range)
                  const cb         = currentPeriodMap.get(b.name);
                  // Use current period metrics for display (cb), 6-month b just for ordering
                  const totalChats = filteredChats.length;
                  const vis  = cb && totalChats > 0         ? Math.round((cb.count / totalChats) * 100)         : 0;
                  const sov  = cb && totalAllBrandCount > 0 ? Math.round((cb.count / totalAllBrandCount) * 100) : 0;
                  const sent = cb?.sentiment                 ? Math.round(cb.sentiment)                          : 0;
                  const dotColor = sentimentDotColor(sent);

                  const prevAllBrandCount = prevAllBrandCountMemo;
                  const prevTotalChats    = prevTotalChatsMemo;
                  const pb       = prevBrands.find(p => p.name === b.name);
                  const pVis     = prevTotalChats > 0 && pb    ? Math.round((pb.count / prevTotalChats) * 100)    : 0;
                  const pSov     = prevAllBrandCount > 0 && pb ? Math.round((pb.count / prevAllBrandCount) * 100) : 0;
                  const visDelta  = vis - pVis;
                  const sovDelta  = sov - pSov;
                  const sentDelta = pb?.sentiment && cb ? Math.round((cb.sentiment ?? 0) - pb.sentiment) : 0;
                  const bPos      = cb?.position ?? 0;
                  const posDelta  = pb?.position && bPos ? parseFloat((bPos - pb.position).toFixed(1)) : 0;

                  const showValue = indicatorMode !== "indicators-only";
                  const showDelta = indicatorMode !== "none";
                  const deltaEl = (v: number, fmt: (n: number) => string) =>
                    showDelta && v !== 0 ? (
                      <span className={v > 0 ? "pd-delta-pos" : "pd-delta-neg"}>
                        {v > 0 ? "+" : ""}{fmt(v)}
                      </span>
                    ) : null;
                  // Inverted delta for Position: lower rank# = better → negative = green
                  const deltaElInv = (v: number, fmt: (n: number) => string) =>
                    showDelta && v !== 0 ? (
                      <span className={v < 0 ? "pd-delta-pos" : "pd-delta-neg"}>
                        {v > 0 ? "+" : ""}{fmt(v)}
                      </span>
                    ) : null;

                  return (
                    <React.Fragment key={b.name}>
                      <tr
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
                          <DomainFavicon domain={brandDomainMap.get(b.name) ?? guessBrandDomain(b.name)} size={16} />
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
                        {/* Position — use current period bPos */}
                        <td>
                          <span className="pd-metric-with-delta">
                            {showValue && <span>{bPos > 0 ? `#${bPos.toFixed(1)}` : "—"}</span>}
                            {deltaElInv(posDelta, (n: number) => `${n > 0 ? "+" : ""}${n}`)}
                          </span>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                {chartBrands.length === 0 && (
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
                      {/* Pinned row with real rank — hover highlights own brand line in chart */}
                      <tr
                        className="pd-pinned-row"
                        onMouseEnter={() => setHoveredBrand(b.name)}
                        onMouseLeave={() => setHoveredBrand(null)}
                      >
                        <td className="pd-rank">
                          {hoveredBrand === b.name ? (
                            <span
                              className="pd-rank-dot pd-rank-dot--clickable"
                              style={{ background: b.color }}
                              title="Change brand color"
                              onClick={e => openPickerAt(b.name, e)}
                            />
                          ) : (
                            pinnedOwnBrand.rank
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
                          <DomainFavicon domain={brandDomainMap.get(b.name) ?? guessBrandDomain(b.name)} size={16} />
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
                    <tr
                      key={i}
                      className="pd-domain-row"
                      onClick={() => router.push("/domains/" + encodeURIComponent(d.domain))}
                    >
                      <td className="pd-domain-cell">
                        <DomainFavicon domain={d.domain} size={16} />
                        {d.domain}
                      </td>
                      <td>{pct}%</td>
                      <td>{rate}</td>
                      <td style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
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

            {/* All Chats export button */}
            <div ref={chatExportRef} style={{ position: "relative" }}>
              <button
                className={`ac-col-btn ${chatExportOpen ? "ac-col-btn--active" : ""}`}
                title="Export chats"
                onClick={() => setChatExportOpen(v => !v)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </button>
              {chatExportOpen && (
                <div className="pd-export-menu">
                  <div className="pd-export-label">Export format</div>
                  {(["CSV", "XLSX", "JSON"] as const).map(fmt => (
                    <button
                      key={fmt}
                      className="pd-export-option"
                      onClick={() => handleChatExport(fmt.toLowerCase() as "csv" | "xlsx" | "json")}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              )}
            </div>

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

            {/* Expand button — navigates to Ranking page */}
            <button
              className="ac-col-btn"
              title="View Rankings"
              onClick={() => router.push("/ranking")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 480 480" fill="none" aria-hidden="true">
                <path d="M120 260.01v60C120 342.09 137.91 360 159.99 360h60" stroke="currentColor" strokeWidth="39.9" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M260.01 120h60C342.09 120 360 137.91 360 159.99v60" stroke="currentColor" strokeWidth="39.9" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
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
              {chatTotalPages > 5 && chatPage < chatTotalPages - 2 && (
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
