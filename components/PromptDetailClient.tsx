"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { utils as xlsxUtils, writeFile as xlsxWriteFile } from "xlsx";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Settings, MessageSquare, Play, Loader2, Copy, Download, ImageIcon, MoreHorizontal,
} from "lucide-react";
import {
  HiMiniChevronUp, HiMiniChevronDown,
  HiOutlineChevronDown, HiOutlineChevronUp,
  HiOutlineArrowTrendingUp, HiOutlineArrowTrendingDown,
} from "react-icons/hi2";
import BrandColorPicker from "./BrandColorPicker";
import ChatModal from "./ChatModal";
import EngineIcon from "./EngineIcon";
import DomainFavicon from "./DomainFavicon";
import { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import PromptSettingsModal from "./PromptSettingsModal";
import InfoTooltip from "./InfoTooltip";
import PageFilterBar, {
  PageFilterBrand,
  PageFilterDateRange,
} from "./PageFilterBar";
import { addBrand } from "../app/actions/brands";
import { guessBrandDomain } from "../lib/brand-domain";
import {
  ChatFact, ChatRecordView, Resolution,
  aggregateBrands, aggregateDomains, totalCitations, toChatRecords,
  buildVisibilitySeries, filterByEngines, filterByDateRange, aggregateByCategory,
  previousPeriod,
} from "../lib/chat-aggregations";
import { classifyDomain, DOMAIN_TYPE_COLORS } from "../lib/domain-aggregations";
import TypeDropdown from "./TypeDropdown";

interface ProjectBrand {
  name: string;
  isOwn: boolean;
  domains?: string[];
}

interface PromptInfo {
  id: string;
  query: string;
  createdAt: string;
  volumeTier: string;
  topicName: string;
  projectName: string;
  isActive: boolean;
  location: string;
}

interface ProjectTag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  prompt: PromptInfo;
  chatFacts: ChatFact[];
  projectBrands: ProjectBrand[];
  availableTags: ProjectTag[];
  selectedTagIds: string[];
  initialHiddenBrandIds?: string[];
  updateBrandFilterAction?: (hiddenBrandIds: string[] | null) => Promise<{ ok: boolean; error?: string }>;
  initialDomainTypeOverrides?: Record<string, string>;
  updateDomainTypeOverrideAction?: (domain: string, type: string | null) => Promise<{ ok: boolean; error?: string }>;
  initialBrandColors?: Record<string, string>;
  updateBrandColorByNameAction?: (brandName: string, color: string) => Promise<{ ok: boolean; error?: string }>;
}

const VOLUME_TIER_LEVEL: Record<string, number> = {
  "Very High": 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function volumeLevel(tier: string): number {
  return VOLUME_TIER_LEVEL[tier] ?? 2;
}

function formatDelta(diff: number, suffix = "%"): { text: string; cls: "up" | "down" } | null {
  if (!isFinite(diff)) return null;
  const rounded = Math.round(diff);
  if (rounded === 0) return null;
  const sign = rounded > 0 ? "+" : "";
  return { text: `${sign}${rounded}${suffix}`, cls: rounded > 0 ? "up" : "down" };
}

function formatTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffHr = Math.floor(diffMs / 3600000);
  if (diffHr < 1) return "just now";
  if (diffHr < 24) return `${diffHr} hr ago`;
  return `${Math.floor(diffHr / 24)} day ago`;
}


function SortIcon({ sortDir }: { sortDir: "asc" | "desc" | null }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", lineHeight: 1, gap: "1px" }}>
      <HiMiniChevronUp  size={8} style={{ opacity: sortDir === "asc"  ? 1 : sortDir === "desc" ? 0.22 : 0.38 }} />
      <HiMiniChevronDown size={8} style={{ opacity: sortDir === "desc" ? 1 : sortDir === "asc"  ? 0.22 : 0.38 }} />
    </span>
  );
}

export default function PromptDetailClient({
  prompt, chatFacts, projectBrands, availableTags, selectedTagIds,
  initialHiddenBrandIds = [],
  updateBrandFilterAction,
  initialDomainTypeOverrides,
  updateDomainTypeOverrideAction,
  initialBrandColors = {},
  updateBrandColorByNameAction,
}: Props) {
  const router = useRouter();
  const [resolution, setResolution] = useState<Resolution>("W");
  const [selectedChat, setSelectedChat] = useState<ChatRecordView | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  // Portal target in the shared header (DashboardLayout) for the top-right
  // action buttons; resolved after mount so SSR markup stays in sync.
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHeaderSlot(document.getElementById("page-header-actions"));
  }, []);
  const [selectedDomainType, setSelectedDomainType] = useState<string | null>(null);
  const [typeOverrides, setTypeOverrides] = useState<Map<string, string>>(() =>
    new Map(Object.entries(initialDomainTypeOverrides ?? {}))
  );
  const [openTypeDropdown, setOpenTypeDropdown] = useState<string | null>(null);

  // ── Overview chart + Top 7 Brands state (matching Overview page design) ──
  const [chartView, setChartView]       = useState<"line" | "bar">("line");
  type BrandSortCol  = "visibility" | "sov" | "sentiment" | "position";
  type BrandSortMode = "high-low" | "low-high" | "positive-trend" | "negative-trend";
  const [brandSortCol,  setBrandSortCol]  = useState<BrandSortCol>("visibility");
  const [brandSortMode, setBrandSortMode] = useState<BrandSortMode>("high-low");
  const [openBrandMenu, setOpenBrandMenu] = useState<BrandSortCol | null>(null);
  type IndicatorMode = "default" | "indicators-only" | "none";
  const [indicatorMode, setIndicatorMode]         = useState<IndicatorMode>("default");
  const [indicatorPanelOpen, setIndicatorPanelOpen] = useState(false);
  const indicatorPanelRef                           = useRef<HTMLDivElement>(null);
  const [hoveredBrand, setHoveredBrand]   = useState<string | null>(null);
  const [pickerInfo, setPickerInfo]       = useState<{ name: string; pos: { top: number; left: number } } | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (indicatorPanelRef.current && !indicatorPanelRef.current.contains(e.target as Node))
        setIndicatorPanelOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Close export menu on outside click
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

  function openPickerAt(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (pickerInfo?.name === name) { setPickerInfo(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const top  = window.innerHeight - rect.bottom > 300 ? rect.bottom + 8 : rect.top - 300;
    const left = Math.max(8, Math.min(rect.left - 90, window.innerWidth - 230));
    setPickerInfo({ name, pos: { top, left } });
  }

  async function handleTypeOverride(domain: string, type: string) {
    setTypeOverrides(prev => new Map(prev).set(domain, type));
    await updateDomainTypeOverrideAction?.(domain, type);
  }

  async function handleTypeReset(domain: string) {
    setTypeOverrides(prev => { const m = new Map(prev); m.delete(domain); return m; });
    await updateDomainTypeOverrideAction?.(domain, null);
  }

  const allAvailableModels = useMemo(() => {
    const set = new Set<string>();
    for (const c of chatFacts) set.add(c.engine);
    const found = Array.from(set);
    const defaults = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Groq"];
    for (const d of defaults) if (!found.includes(d)) found.push(d);
    return found;
  }, [chatFacts]);

  // Adapt ProjectBrand (name + isOwn + optional domains[]) to the
  // PageFilterBrand shape PageFilterBar expects ({ id, name, isOwn, domain }).
  // We use name as id so the strings PageFilterBar returns in onBrandsChange
  // are the same name-keyed identifiers selectedBrands is keyed on.
  const pageFilterBrands: PageFilterBrand[] = useMemo(
    () =>
      projectBrands.map((b) => ({
        id: b.name,
        name: b.name,
        isOwn: b.isOwn,
        // Fall back to a guessed domain so the favicon lookup works for
        // auto-tracked brands that don't have a domain configured yet.
        // Same heuristic used by lib/page-filter-data.ts:getPageFilterData.
        domain: b.domains?.[0] ?? guessBrandDomain(b.name),
      })),
    [projectBrands],
  );

  // Resolve a domain for any extracted brand name — prefer a domain configured
  // on the project's brand row, fall back to the heuristic guess. Used by the
  // Top 7 Brands table to render real favicons via DomainFavicon.
  const brandDomainByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of projectBrands) {
      m.set(b.name, b.domains?.[0] ?? guessBrandDomain(b.name));
    }
    return m;
  }, [projectBrands]);

  const [selectedModels, setSelectedModels] = useState<string[]>(allAvailableModels);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => makePresetRange("30"));

  // Brand filter state — initialized from DB (hiddenBrandIds → visible brand names)
  const [selectedBrands, setSelectedBrands] = useState<string[] | null>(() => {
    if (initialHiddenBrandIds.length === 0) return null; // all visible
    const hiddenSet = new Set(initialHiddenBrandIds);
    const allNames = projectBrands.map((b) => b.name);
    const visibleNames = allNames.filter((name) => !hiddenSet.has(name));
    return visibleNames.length === allNames.length ? null : visibleNames;
  });

  // When user changes brand filter → update DB (project-wide, persists on refresh)
  const handleBrandsChange = async (names: string[] | null) => {
    setSelectedBrands(names); // optimistic update
    if (!updateBrandFilterAction) return;
    if (names === null) {
      // all selected = nothing hidden
      void updateBrandFilterAction([]);
    } else {
      // hidden = brands NOT in selected list
      const allNames = projectBrands.map((b) => b.name);
      const hiddenNames = allNames.filter((name) => !names.includes(name));
      void updateBrandFilterAction(hiddenNames);
    }
  };

  const [mentionedOnly, setMentionedOnly] = useState(false);

  const runScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanStatus(`Querying ${selectedModels.length} engine${selectedModels.length === 1 ? "" : "s"}…`);
    try {
      const engines = selectedModels.join(",");
      const res = await fetch(
        `/api/run-daily-scan?promptId=${encodeURIComponent(prompt.id)}&engines=${encodeURIComponent(engines)}`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Scan failed (HTTP ${res.status})`);
      }
      setScanStatus(
        data.mode === "inngest"
          ? `Dispatched ${data.dispatched} jobs — results stream in shortly.`
          : `Completed ${data.dispatched} engine calls. Refreshing…`,
      );
      router.refresh();
      window.setTimeout(() => setScanStatus(null), 4000);
    } catch (err) {
      setScanStatus(err instanceof Error ? `Error: ${err.message}` : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  // Local color overrides — initialized from DB, updated instantly on color pick
  const [localColorOverrides, setLocalColorOverrides] = useState<Record<string, string>>(initialBrandColors);

  const stableBrandColors = useMemo(() => {
    const all = aggregateBrands(chatFacts, 20);
    const map: Record<string, string> = {};
    for (const b of all) map[b.name] = b.color;
    return { ...map, ...localColorOverrides }; // local overrides take priority
  }, [chatFacts, localColorOverrides]);

  const filteredChats = useMemo(
    () => filterByDateRange(filterByEngines(chatFacts, selectedModels), dateRange),
    [chatFacts, selectedModels, dateRange],
  );

  // ── 6-month brand pool — engine-filtered only, no date filter ────────────────
  // Stable brand selection: top brands from full 6-month history, not just current window
  const fullRankingFullPeriod = useMemo(
    () => aggregateBrands(filterByEngines(chatFacts, selectedModels), 500, undefined, stableBrandColors),
    [chatFacts, selectedModels, stableBrandColors],
  );

  // Current period ranking — for display metrics (vis%, SOV%, sentiment, position)
  const fullRanking = useMemo(
    () => aggregateBrands(filteredChats, 500, undefined, stableBrandColors),
    [filteredChats, stableBrandColors],
  );

  // Quick lookup: current period metrics by brand name
  const currentPeriodMap = useMemo(() => {
    const m = new Map<string, typeof fullRanking[0]>();
    for (const b of fullRanking) m.set(b.name, b);
    return m;
  }, [fullRanking]);

  // Real rank (1-indexed) in 6-month visibility High-Low — for pinned brand rank display
  const rankByName = useMemo(() => {
    const m = new Map<string, number>();
    fullRankingFullPeriod.forEach((b, i) => m.set(b.name, i + 1));
    return m;
  }, [fullRankingFullPeriod]);

  const pinnedNames = useMemo(() => {
    const names = new Set<string>();
    for (const b of projectBrands) if (b.isOwn) names.add(b.name);
    if (selectedBrands !== null) for (const n of selectedBrands) names.add(n);
    return names;
  }, [projectBrands, selectedBrands]);

  // top7 from 6-month pool — stable across date range changes
  const top7 = useMemo(() => {
    const ownBrandNames = new Set(projectBrands.filter((b) => b.isOwn).map((b) => b.name));
    const visible = selectedBrands === null
      ? fullRankingFullPeriod
      : fullRankingFullPeriod.filter((b) => selectedBrands.includes(b.name) || ownBrandNames.has(b.name));
    return visible.slice(0, 7);
  }, [fullRankingFullPeriod, selectedBrands, projectBrands]);

  const brands = useMemo(() => top7, [top7]);

  const domains = useMemo(() => aggregateDomains(filteredChats, 10), [filteredChats]);
  const totalDomainCitations = useMemo(() => totalCitations(filteredChats), [filteredChats]);
  // chartData and barData defined AFTER pinnedOwnBrand + chartBrandsForDisplay (further below)

  const promptsPerDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of filteredChats) { const d = c.runDate.slice(0, 10); map.set(d, (map.get(d) ?? 0) + 1); }
    return map;
  }, [filteredChats]);

  const daysLabel = useMemo(() => {
    const diff = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000);
    return `Showing data for ${diff} day${diff !== 1 ? "s" : ""}`;
  }, [dateRange]);

  // ── Previous period (for delta indicators) ──────────────────────────────────
  const filteredPrevious = useMemo(() => {
    if (dateRange.preset === "all") return [];
    const prev = previousPeriod(dateRange);
    return filterByDateRange(filterByEngines(chatFacts, selectedModels), prev);
  }, [chatFacts, selectedModels, dateRange]);

  const prevFullRanking = useMemo(
    () => aggregateBrands(filteredPrevious, 500, undefined, stableBrandColors),
    [filteredPrevious, stableBrandColors],
  );
  const prevByName = useMemo(() => {
    const map = new Map<string, { count: number; sentiment: number; position: number }>();
    prevFullRanking.forEach((b) => map.set(b.name, { count: b.count, sentiment: b.sentiment, position: b.position }));
    return { map, total: filteredPrevious.length };
  }, [prevFullRanking, filteredPrevious]);

  // ── Own brand ────────────────────────────────────────────────────────────────
  const ownBrand = useMemo(
    () => projectBrands.find((b) => b.isOwn)?.name ?? null,
    [projectBrands],
  );

  // ── SOV maps (all brands, both periods) ─────────────────────────────────────
  const sowMap = useMemo(() => {
    let totalMentions = 0;
    const hits = new Map<string, number>();
    for (const c of filteredChats) {
      const seen = new Set<string>();
      for (const b of c.brands) {
        if (seen.has(b.name)) continue;
        seen.add(b.name);
        totalMentions++;
        hits.set(b.name, (hits.get(b.name) ?? 0) + 1);
      }
    }
    const m = new Map<string, number>();
    for (const [name, h] of hits) m.set(name, totalMentions > 0 ? (h / totalMentions) * 100 : 0);
    return m;
  }, [filteredChats]);

  const prevSowMap = useMemo(() => {
    let totalMentions = 0;
    const hits = new Map<string, number>();
    for (const c of filteredPrevious) {
      const seen = new Set<string>();
      for (const b of c.brands) {
        if (seen.has(b.name)) continue;
        seen.add(b.name);
        totalMentions++;
        hits.set(b.name, (hits.get(b.name) ?? 0) + 1);
      }
    }
    const m = new Map<string, number>();
    for (const [name, h] of hits) m.set(name, totalMentions > 0 ? (h / totalMentions) * 100 : 0);
    return m;
  }, [filteredPrevious]);

  // ── Step 1: TOP 7 POOL — always 7 most visible brands (current period, high-low)
  // Pool stays same regardless of sort direction; sort only changes display ORDER
  const top7Pool = useMemo(() => {
    const byVisDesc = [...brands].sort((a, b) => {
      const ca = currentPeriodMap.get(a.name);
      const cb = currentPeriodMap.get(b.name);
      return (cb?.count ?? 0) - (ca?.count ?? 0);
    });
    return byVisDesc;
  }, [brands, currentPeriodMap]);

  // ── Step 2: SORT — reorder top7Pool by user's selected column/direction
  const sortedBrands = useMemo(() => {
    const list = [...top7Pool];
    // dir=1 for HIGH-LOW (descending: highest first)
    // dir=-1 for LOW-HIGH (ascending: lowest first)
    const dir = (brandSortMode === "high-low" || brandSortMode === "negative-trend") ? 1 : -1;
    list.sort((a, b) => {
      const ca = currentPeriodMap.get(a.name);
      const cb = currentPeriodMap.get(b.name);
      if (brandSortCol === "visibility") return dir * ((cb?.count ?? 0) - (ca?.count ?? 0));
      if (brandSortCol === "sov")        return dir * ((sowMap.get(b.name) ?? 0) - (sowMap.get(a.name) ?? 0));
      if (brandSortCol === "sentiment")  return dir * ((cb?.sentiment ?? 0) - (ca?.sentiment ?? 0));
      if (brandSortCol === "position") {
        const posA = ca?.position && ca.position > 0 ? ca.position : 999;
        const posB = cb?.position && cb.position > 0 ? cb.position : 999;
        return -dir * (posB - posA);
      }
      return 0;
    });
    return list;
  }, [top7Pool, brandSortCol, brandSortMode, sowMap, currentPeriodMap]);

  // ── Pinned own brand (always visible even if not in top 7) ──────────────────
  const ownBrandNamesSet = useMemo(
    () => new Set(projectBrands.filter(b => b.isOwn).map(b => b.name)),
    [projectBrands]
  );

  const pinnedOwnBrand = useMemo(() => {
    const ownInTop7 = sortedBrands.some(b => ownBrandNamesSet.has(b.name));
    if (ownInTop7) return null;

    const ownProjectBrand = projectBrands.find(b => b.isOwn);
    if (!ownProjectBrand) return null;
    const ownName = ownProjectBrand.name;

    // Rank from current period visibility (High-Low)
    const currentByVisDesc = [...(fullRanking)].sort((a, b) => b.count - a.count);
    const ownIdx = currentByVisDesc.findIndex(b => b.name === ownName);
    const rank = ownIdx === -1 ? currentByVisDesc.length + 1 : ownIdx + 1;

    const brand6m = fullRankingFullPeriod.find(b => b.name === ownName);
    const stableColor = stableBrandColors[ownName] ?? "#6366f1";
    const brandForDisplay = brand6m ?? { name: ownName, count: 0, sentiment: 0, position: 0, color: stableColor };

    return { brand: brandForDisplay, rank };
  }, [sortedBrands, ownBrandNamesSet, projectBrands, fullRanking, fullRankingFullPeriod, stableBrandColors]);

  // Chart shows top 6 + own brand when pinned (same 7 lines as table)
  const chartBrandsForDisplay = useMemo(() => {
    if (!pinnedOwnBrand) return sortedBrands;
    return [...sortedBrands.slice(0, 6), pinnedOwnBrand.brand];
  }, [sortedBrands, pinnedOwnBrand]);

  // chartData + barData defined here (after chartBrandsForDisplay + pinnedOwnBrand)
  const chartData = useMemo(() => {
    const series = buildVisibilitySeries(filteredChats, chartBrandsForDisplay.map((b) => b.name), resolution, dateRange);
    if (pinnedOwnBrand) {
      const ownName = pinnedOwnBrand.brand.name;
      return series.map(point => ({
        ...point,
        [ownName]: (point as Record<string, unknown>)[ownName] ?? 0,
      }));
    }
    return series;
  }, [filteredChats, chartBrandsForDisplay, pinnedOwnBrand, resolution, dateRange]);

  const barData = useMemo(() => {
    const total = filteredChats.length;
    return chartBrandsForDisplay.map(b => {
      const cb = currentPeriodMap.get(b.name);
      return {
        name: b.name,
        value: cb && total > 0 ? Math.round((cb.count / total) * 100) : 0,
        color: b.color,
        domain: guessBrandDomain(b.name),
      };
    });
  }, [chartBrandsForDisplay, currentPeriodMap, filteredChats]);

  // ── Chart export ──────────────────────────────────────────────────────────
  const chartExportDateLabel = `${dateRange.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${dateRange.end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const chartExportDaysLabel = dateRange.preset === "all"
    ? "All time"
    : `${Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000)} days`;
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

  // ── Common Terms from rawResponse (bigrams, for Fanout Queries section) ──────
  const commonTerms = useMemo(() => {
    const stop = new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been","have","has","had","do","does","did","will","would","could","should","may","might","it","this","that","these","those","we","you","he","she","they","your","their","its","our","as","if","not","can","how","what","which","when","where","who","more","also","up","out","about","into","them","than","other","such","some","most","all","any","both","each","many","well","just","very","one","two","three","help","use","using","used","new","best","top","good","great","first","need","make","get","work","include","provide","offer","create","often","look","based","way","through","ai","like","know","brands"]);
    const counts = new Map<string, number>();
    for (const c of filteredChats) {
      if (!c.rawResponse) continue;
      const words = c.rawResponse.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !stop.has(w));
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([text, count]) => ({ text, count }));
  }, [filteredChats]);

  // ── Enriched recent chats ────────────────────────────────────────────────────
  interface EnrichedChat extends ChatRecordView {
    isMentioned: boolean;
    ownPosition: number | null;
  }
  const chatFactById = useMemo(() => {
    const m = new Map<string, ChatFact>();
    for (const c of filteredChats) m.set(c.id, c);
    return m;
  }, [filteredChats]);

  const recentChatsData = useMemo((): EnrichedChat[] => {
    const records = toChatRecords(filteredChats);
    records.sort((a, b) => new Date(b.runDate).getTime() - new Date(a.runDate).getTime());

    // Use ownBrand if set, else fall back to projectName (covers projects with no isOwn brand)
    const effectiveName = (ownBrand ?? prompt.projectName)?.toLowerCase();

    // Build own-domain set inline so we don't depend on later-declared useMemos
    const ownDomains = new Set<string>();
    for (const b of projectBrands) {
      if (!b.isOwn) continue;
      for (const d of b.domains ?? []) if (d) ownDomains.add(d.toLowerCase());
    }
    function matchesDomain(domain: string): boolean {
      if (ownDomains.size === 0 || !domain) return false;
      const d = domain.toLowerCase().replace(/^www\./, "");
      for (const o of ownDomains) {
        if (d === o || d.endsWith("." + o)) return true;
      }
      return false;
    }

    return records.map((chat) => {
      const fact = chatFactById.get(chat.id);
      const ownFact = effectiveName && fact
        ? fact.brands.find((b) => b.name.toLowerCase() === effectiveName)
        : undefined;
      const brandMatch = effectiveName
        ? chat.brandsFound.some((b) => b.toLowerCase() === effectiveName)
        : false;
      const domainMatch = chat.sourcesFound.some((s) => matchesDomain(s.domain));
      return {
        ...chat,
        isMentioned: brandMatch || domainMatch,
        ownPosition: ownFact?.position ?? null,
      };
    });
  }, [filteredChats, chatFactById, ownBrand, prompt.projectName, projectBrands]);

  const displayedChats = useMemo(
    () => (mentionedOnly ? recentChatsData.filter((c) => c.isMentioned) : recentChatsData),
    [recentChatsData, mentionedOnly],
  );

  // ── Brand vs Source visibility ───────────────────────────────────────────
  // Spec: a chat counts toward "brand visibility" if any own brand is named in
  // the response, and toward "source visibility" if any source domain matches
  // an own brand's tracked domain — even when the brand itself wasn't named.
  const ownBrandSet = useMemo(
    () => new Set(projectBrands.filter((b) => b.isOwn).map((b) => b.name)),
    [projectBrands],
  );
  const ownDomainSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of projectBrands) {
      if (!b.isOwn) continue;
      for (const d of b.domains ?? []) if (d) s.add(d.toLowerCase());
    }
    return s;
  }, [projectBrands]);

  function domainMatchesOwn(domain: string, ownDomains: Set<string>): boolean {
    if (ownDomains.size === 0 || !domain) return false;
    const d = domain.toLowerCase().replace(/^www\./, "");
    for (const o of ownDomains) {
      if (d === o || d.endsWith("." + o)) return true;
    }
    return false;
  }

  const brandVsSource = useMemo(() => {
    const totalChats = filteredChats.length;
    if (totalChats === 0 || ownBrandSet.size === 0) {
      return { totalChats, brandChats: 0, sourceChats: 0, hasOwnBrand: ownBrandSet.size > 0 };
    }
    let brandChats = 0;
    let sourceChats = 0;
    for (const c of filteredChats) {
      const brandMentioned = c.brands.some((b) => ownBrandSet.has(b.name));
      const sourceCited = c.sources.some((s) => domainMatchesOwn(s.domain, ownDomainSet));
      if (brandMentioned) brandChats++;
      if (sourceCited) sourceChats++;
    }
    return { totalChats, brandChats, sourceChats, hasOwnBrand: true };
  }, [filteredChats, ownBrandSet, ownDomainSet]);

  const brandVisibilityPct =
    brandVsSource.totalChats > 0
      ? Math.round((brandVsSource.brandChats / brandVsSource.totalChats) * 100)
      : 0;
  const sourceVisibilityPct =
    brandVsSource.totalChats > 0
      ? Math.round((brandVsSource.sourceChats / brandVsSource.totalChats) * 100)
      : 0;

  function visibilityInsight(brandPct: number, sourcePct: number): {
    label: string;
    tone: "good" | "warn" | "info";
  } {
    if (brandPct === 0 && sourcePct === 0) {
      return { label: "Neither your brand nor your domain shows up yet.", tone: "warn" };
    }
    const delta = brandPct - sourcePct;
    if (Math.abs(delta) <= 5) {
      return { label: "Brand and source visibility are aligned.", tone: "good" };
    }
    if (delta > 0) {
      return {
        label:
          "AI mentions your brand more than it cites your content. Tightening on-page authority may help your domain catch up.",
        tone: "info",
      };
    }
    return {
      label:
        "Your domain is cited more than your brand is named. AI may not associate the content with your brand — strengthen brand mentions on the cited pages.",
      tone: "info",
    };
  }
  const insight = visibilityInsight(brandVisibilityPct, sourceVisibilityPct);

  // totalMentions from current period (not 6-month)
  const totalMentions = brands.reduce((s, b) => s + (currentPeriodMap.get(b.name)?.count ?? 0), 0);
  const maxDomainCount = domains.length > 0 ? domains[0].count : 1;

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

  // ── Export helpers ────────────────────────────────────────────────────────
  function buildExportRows() {
    const total     = filteredChats.length;
    const prevTotal = filteredPrevious.length;
    const allByVisDesc = [...fullRankingFullPeriod].sort((a, b) =>
      (currentPeriodMap.get(b.name)?.count ?? 0) - (currentPeriodMap.get(a.name)?.count ?? 0)
    );
    const totalSOV = allByVisDesc.reduce((s, b) => s + (currentPeriodMap.get(b.name)?.count ?? 0), 0);
    const prevSOV  = prevFullRanking.reduce((s, b) => s + b.count, 0);

    return allByVisDesc.map((b, idx) => {
      const cb  = currentPeriodMap.get(b.name);
      const pb  = prevFullRanking.find(p => p.name === b.name);
      const vis  = cb && total > 0     ? cb.count / total     : 0;
      const pVis = pb && prevTotal > 0  ? pb.count / prevTotal  : 0;
      const sov  = cb && totalSOV > 0  ? cb.count / totalSOV   : 0;
      const pSov = pb && prevSOV > 0   ? pb.count / prevSOV    : 0;
      return {
        rank:                 idx + 1,
        brand_id:             `brand_${b.name.toLowerCase().replace(/\s+/g, "_").slice(0, 20)}`,
        brand:                b.name,
        domain:               brandDomainByName.get(b.name) ?? guessBrandDomain(b.name),
        days_to_process:      0,
        is_processing:        false,
        visibility:           parseFloat(vis.toFixed(4)),
        visibility_delta:     parseFloat((vis - pVis).toFixed(4)),
        share_of_voice:       parseFloat(sov.toFixed(4)),
        share_of_voice_delta: parseFloat((sov - pSov).toFixed(4)),
        sentiment:            cb?.sentiment ? Math.round(cb.sentiment) : "",
        sentiment_delta:      pb?.sentiment && cb?.sentiment ? Math.round(cb.sentiment - pb.sentiment) : "",
        position:             cb?.position  ? parseFloat(cb.position.toFixed(2)) : "",
        position_delta:       pb?.position  && cb?.position ? parseFloat((cb.position - pb.position).toFixed(2)) : "",
      };
    });
  }

  function handleExport(format: "csv" | "xlsx" | "json") {
    const rows  = buildExportRows();
    const date  = new Date().toISOString().slice(0, 10);
    const fname = `top-brandsexportfrom-${date}`;

    if (format === "json") {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${fname}.json`; a.click();
    } else if (format === "csv") {
      const cols  = Object.keys(rows[0] ?? {});
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
  }

  const createdDate = new Date(prompt.createdAt);
  const diffDays = Math.floor((Date.now() - createdDate.getTime()) / 86400000);
  const timeAgo = diffDays > 0 ? `${diffDays} day${diffDays > 1 ? "s" : ""} ago` : "today";

  return (
    <div className="prompt-detail-page">
      {selectedChat && <ChatModal chat={selectedChat} ownBrand={ownBrand ?? undefined} onClose={() => setSelectedChat(null)} />}
      {isSettingsOpen && (
        <PromptSettingsModal
          promptId={prompt.id}
          initialActive={prompt.isActive}
          initialLocation={prompt.location}
          availableTags={availableTags}
          selectedTagIds={selectedTagIds}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
      {/* ── Top-bar actions — portaled into the shared header (top-right) ──── */}
      {headerSlot &&
        createPortal(
          <div className="pd-topbar-actions">
            {scanStatus && (
              <span
                className={`pd-scan-status ${scanStatus.startsWith("Error") ? "pd-scan-status-error" : ""}`}
              >
                {scanStatus}
              </span>
            )}
            <button
              className="pd-run-scan-btn"
              onClick={runScan}
              disabled={isScanning || selectedModels.length === 0}
              title="Query selected AI engines now and refresh data"
            >
              {isScanning ? (
                <>
                  <Loader2 size={14} strokeWidth={2} className="pd-spin" />
                  <span>Running…</span>
                </>
              ) : (
                <>
                  <Play size={14} strokeWidth={2} />
                  <span>Run scan</span>
                </>
              )}
            </button>
            <button
              className="pd-settings-btn"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings size={14} strokeWidth={2} />
              <span>Settings</span>
            </button>
          </div>,
          headerSlot
        )}

      <div className="pd-filters" style={{ display: "block", padding: 0, border: "none", gap: 0 }}>
        <PageFilterBar
          projectName={prompt.projectName}
          projectBrands={pageFilterBrands}
          availableTags={availableTags}
          hideTags
          initialDateRange={dateRange as unknown as PageFilterDateRange}
          initialModels={selectedModels}
          initialBrands={selectedBrands}
          addBrandAction={addBrand}
          onBrandsChange={handleBrandsChange}
          onDateChange={(r) => setDateRange(r as unknown as DateRangeValue)}
          onModelsChange={(engines) => setSelectedModels(engines)}
        />
      </div>

      {/* ── Header Card ───────────────────────────────────── */}
      <div className="pd-prompt-header">
        <span className="pd-header-label">Prompt</span>

        <h1 className="pd-prompt-title">{prompt.query}</h1>

        <div className="pd-meta-grid">
          <div className="pd-meta-item">
            <span className="pd-meta-label">Date added</span>
            <span className="pd-meta-value">{timeAgo}</span>
          </div>

          <div className="pd-meta-item">
            <span className="pd-meta-label">Topic</span>
            <span className="pd-meta-value">
              {prompt.topicName || "—"}
            </span>
          </div>

          <div className="pd-meta-item">
            <span className="pd-meta-label">Volume</span>

            <span className="pd-meta-value">
              <span
                className="pd-volume-bars"
                aria-label={prompt.volumeTier || "Medium"}
              >
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`pd-volume-bar ${
                      i <= volumeLevel(prompt.volumeTier)
                        ? "pd-volume-bar-on"
                        : ""
                    }`}
                  />
                ))}
              </span>
            </span>
          </div>

          <div className="pd-meta-item">
            <span className="pd-meta-label">Location</span>

            <span className="pd-meta-value pd-location">
              <img
                src={`https://flagcdn.com/w40/${(
                  prompt.location || "us"
                ).toLowerCase()}.png`}
                alt=""
                width={16}
                height={12}
                className="pd-flag-img"
              />

              {(prompt.location || "US").toUpperCase()}
            </span>
          </div>

          <div className="pd-meta-item">
            <span className="pd-meta-label">Status</span>

            <span className="pd-status-badge">
              {prompt.isActive ? "Active" : "Paused"}
            </span>
          </div>
        </div>
      </div>

      <div className="pd-section">
        <h2 className="pd-section-title">Overview</h2>
        <p className="pd-section-subtitle">How often each brand appears in AI generated discussions</p>

        <div className="pd-overview-grid">
          {/* ── Visibility Chart ───────────────────────────── */}
          <div className="pd-chart-card" ref={chartCardRef}>
            {/* Export-only title (hidden in UI, shown during image capture) */}
            <div className="ch-chart-export-title">
              <span className="ch-export-metric">Visibility · {chartExportDateLabel}</span>
              <span className="ch-export-period">{chartExportDaysLabel} · {chartExportResLabel}</span>
            </div>
            <div className="pd-chart-header">
              <div className="pd-chart-label">
                Visibility <InfoTooltip text="% of chats mentioning each brand over time." />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

            <ResponsiveContainer width="100%" height={248}>
              {chartView === "line" ? (
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" horizontal vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} dy={6} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, "auto"]} tickFormatter={(v) => `${v}%`} width={36} />
                  <Tooltip
                    wrapperStyle={{ zIndex: 100, pointerEvents: "none" }}
                    position={{ y: 8 }}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const sorted = [...payload].filter(p => (p.value as number) > 0).sort((a, b) => ((b.value as number) ?? 0) - ((a.value as number) ?? 0));
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
                  {chartBrandsForDisplay.map((b) => {
                    const isHov = hoveredBrand === b.name;
                    const faded = hoveredBrand !== null && !isHov;
                    const isOwn = ownBrandNamesSet.has(b.name);
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
                <BarChart data={barData} barCategoryGap="28%" margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" horizontal vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: "#e5e7eb" }}
                    tick={(props) => {
                      const { x, y, payload } = props;
                      return (
                        <g transform={`translate(${Number(x)},${Number(y) + 4})`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <image href={`https://www.google.com/s2/favicons?domain=${guessBrandDomain(payload.value as string)}&sz=32`} x={-10} y={0} width={20} height={20} />
                        </g>
                      );
                    }} height={32} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={36} />
                  <Tooltip wrapperStyle={{ zIndex: 100, pointerEvents: "none" }} cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as { name: string; value: number; domain: string };
                      const diff = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000);
                      return (
                        <div className="ch-tooltip">
                          <div className="ch-tooltip-bar-header"><span>Visibility</span><span className="ch-tooltip-days">{diff} days</span></div>
                          <div className="ch-tooltip-row"><DomainFavicon domain={d.domain} size={14} /><span className="ch-tooltip-name">{d.name}</span><span className="ch-tooltip-val">{d.value}%</span></div>
                        </div>
                      );
                    }} />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]} isAnimationActive={false}>
                    {barData.map((e) => {
                      const faded = hoveredBrand !== null && hoveredBrand !== e.name;
                      return <Cell key={e.name} fill={e.color} fillOpacity={faded ? 0.12 : 1} />;
                    })}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>

            <div className="pd-chart-footer">
              <span>{daysLabel}</span>
              <div className="ch-view-toggle">
                <button className={`ch-view-btn ${chartView === "line" ? "ch-view-btn--active" : ""}`} onClick={() => setChartView("line")} title="Line chart">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 8 13 13 8 8 2 14" /></svg>
                </button>
                <button className={`ch-view-btn ${chartView === "bar" ? "ch-view-btn--active" : ""}`} onClick={() => setChartView("bar")} title="Bar chart">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="10" width="4" height="12" rx="1"/><rect x="9" y="6" width="4" height="16" rx="1"/><rect x="16" y="2" width="4" height="20" rx="1"/></svg>
                </button>
              </div>
            </div>
          </div>

          {/* ── Top 7 Brands ───────────────────────────────── */}
          <div className="pd-brands-card" onClick={() => setOpenBrandMenu(null)}>
            <div className="pd-brands-header">
              <span className="pd-brands-title">Top 7 Brands <InfoTooltip text="Top brands across LLMs for your prompts" /></span>
              <div className="pd-brands-actions">
                {/* Indicator settings */}
                <div ref={indicatorPanelRef} style={{ position: "relative" }}>
                  <button className={`pd-brands-action-btn ${indicatorPanelOpen ? "pd-brands-action-btn--active" : ""}`} title="Change indicators" onClick={() => setIndicatorPanelOpen(v => !v)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </button>
                  {indicatorPanelOpen && (
                    <div className="pd-indicator-panel">
                      <div className="pd-indicator-title">Change indicators</div>
                      {([
                        { value: "default", icon: "⊙", label: "Default" },
                        { value: "indicators-only", icon: "↕", label: "Indicators only" },
                        { value: "none", icon: "T", label: "None" },
                      ] as { value: IndicatorMode; icon: string; label: string }[]).map(opt => (
                        <div key={opt.value} className={`pd-indicator-option ${indicatorMode === opt.value ? "pd-indicator-option--active" : ""}`}
                          onClick={() => { setIndicatorMode(opt.value); setIndicatorPanelOpen(false); }}>
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
                <button className="pd-brands-action-btn" title="View all rankings" onClick={() => router.push(`/prompts/${prompt.id}/ranking`)}><svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 480 480" fill="none" aria-hidden="true"><path d="M120 260.01v60C120 342.09 137.91 360 159.99 360h60" stroke="currentColor" strokeWidth="39.9" strokeLinecap="round" strokeLinejoin="round"/><path d="M260.01 120h60C342.09 120 360 137.91 360 159.99v60" stroke="currentColor" strokeWidth="39.9" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
              </div>
            </div>

            <table className="pd-brands-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th>Brand</th>
                  {(["visibility", "sov", "sentiment", "position"] as BrandSortCol[]).map((col, colIdx) => {
                    const days = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000);
                    const lbls: Record<BrandSortCol, string> = { visibility: "Visibility", sov: "SOV", sentiment: "Sentiment", position: "Position" };
                    const tips: Record<BrandSortCol, string> = {
                      visibility: `% of chats mentioning the brand in the last ${days} days.`,
                      sov: `Brand mentions / total brand mentions in the last ${days} days.`,
                      sentiment: `Brand sentiment score in the last ${days} days.`,
                      position: `Brand average position in the last ${days} days.`,
                    };
                    const isActive = brandSortCol === col;
                    const menuOpen = openBrandMenu === col;
                    const sortDir: "asc" | "desc" | null = isActive
                      ? (brandSortMode === "high-low" || brandSortMode === "negative-trend" ? "desc" : "asc")
                      : null;
                    const menuRight = colIdx >= 2;
                    return (
                      <th key={col} style={{ position: "relative" }}>
                        <span className={`pd-brands-th-btn ${isActive || menuOpen ? "pd-brands-th-active" : ""}`}
                          onClick={e => { e.stopPropagation(); setOpenBrandMenu(menuOpen ? null : col); }}>
                          {lbls[col]} <span className="pd-th-arrow"><SortIcon sortDir={sortDir} /></span>
                          <InfoTooltip text={tips[col]} />
                        </span>
                        {menuOpen && (
                          <div className="pd-brands-sort-menu" style={{ right: menuRight ? 0 : "auto", left: menuRight ? "auto" : 0 }} onClick={e => e.stopPropagation()}>
                            <div className="pd-sort-label">Sort by</div>
                            {/* Value-based sorts */}
                            {([
                              { mode: "high-low" as BrandSortMode, icon: <HiOutlineChevronDown size={13} />, keyword: "Value", direction: "High - low" },
                              { mode: "low-high" as BrandSortMode, icon: <HiOutlineChevronUp size={13} />, keyword: "Value", direction: "Low - high" },
                            ]).map(opt => {
                              const checked = brandSortCol === col && brandSortMode === opt.mode;
                              return (
                                <div key={opt.mode} className={`pd-sort-option ${checked ? "pd-sort-active" : ""}`}
                                  onClick={() => { setBrandSortCol(col); setBrandSortMode(opt.mode); setOpenBrandMenu(null); }}>
                                  <span className="pd-sort-opt-icon">{opt.icon}</span>
                                  <span className="pd-sort-value-keyword">{opt.keyword}</span>
                                  <span style={{ flex: 1 }}>{opt.direction}</span>
                                  {checked && <span className="pd-sort-check">✓</span>}
                                </div>
                              );
                            })}
                            <div className="pd-sort-divider" />
                            {/* Trend-based sorts */}
                            {([
                              { mode: "positive-trend" as BrandSortMode, icon: <HiOutlineArrowTrendingUp size={13} />, label: "Positive trend" },
                              { mode: "negative-trend" as BrandSortMode, icon: <HiOutlineArrowTrendingDown size={13} />, label: "Negative trend" },
                            ]).map(opt => {
                              const checked = brandSortCol === col && brandSortMode === opt.mode;
                              return (
                                <div key={opt.mode} className={`pd-sort-option ${checked ? "pd-sort-active" : ""}`}
                                  onClick={() => { setBrandSortCol(col); setBrandSortMode(opt.mode); setOpenBrandMenu(null); }}>
                                  <span className="pd-sort-opt-icon">{opt.icon}</span>
                                  <span style={{ flex: 1 }}>{opt.label}</span>
                                  {checked && <span className="pd-sort-check">✓</span>}
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
                {(pinnedOwnBrand ? sortedBrands.slice(0, 6) : sortedBrands).map((b, i) => {
                  // Use current period metrics for display (b is from 6-month pool)
                  const cb       = currentPeriodMap.get(b.name);
                  const vis      = cb && filteredChats.length > 0 ? Math.round((cb.count / filteredChats.length) * 100) : 0;
                  const sov      = Math.round(sowMap.get(b.name) ?? 0);
                  const cbSent   = cb?.sentiment ?? 0;
                  const cbPos    = cb?.position  ?? 0;
                  const prevData = prevByName.map.get(b.name);
                  const prevVis  = prevByName.total > 0 ? Math.round(((prevData?.count ?? 0) / prevByName.total) * 100) : 0;
                  const prevSov  = Math.round(prevSowMap.get(b.name) ?? 0);
                  const visDelta  = formatDelta(vis - prevVis);
                  const sovDelta  = formatDelta(sov - prevSov);
                  const sentDelta = formatDelta(cbSent - (prevData?.sentiment ?? cbSent));
                  const posDelta  = formatDelta((prevData?.position ?? cbPos) - cbPos, "");
                  const realRank  = rankByName.get(b.name) ?? i + 1;
                  const showValue = indicatorMode !== "indicators-only";
                  const showDelta = indicatorMode !== "none";
                  const dotColor  = cbSent >= 70 ? "#10b981" : cbSent >= 40 ? "#f59e0b" : cbSent > 0 ? "#ef4444" : "#cbd5e1";
                  return (
                    <tr key={b.name} onMouseEnter={() => setHoveredBrand(b.name)} onMouseLeave={() => setHoveredBrand(null)}>
                      <td className="pd-rank">
                        {hoveredBrand === b.name ? (
                          <span className="pd-rank-dot pd-rank-dot--clickable" style={{ background: b.color }} title="Change brand color"
                            onClick={e => openPickerAt(b.name, e)} />
                        ) : realRank}
                        {pickerInfo?.name === b.name && (
                          <BrandColorPicker color={b.color} position={pickerInfo.pos}
                            onChange={color => {
                              setLocalColorOverrides(prev => ({ ...prev, [b.name]: color }));
                              updateBrandColorByNameAction?.(b.name, color);
                            }}
                            onClose={() => setPickerInfo(null)} />
                        )}
                      </td>
                      <td className="pd-brand-cell">
                        <DomainFavicon domain={brandDomainByName.get(b.name) ?? guessBrandDomain(b.name)} size={16} />
                        {b.name}
                        {pinnedNames.has(b.name) && projectBrands.find((pb) => pb.name === b.name)?.isOwn && (
                          <span className="pd-brand-you-badge">You</span>
                        )}
                      </td>
                      <td className="pd-td-metric">
                        <span className="pd-metric-with-delta">
                          {showValue && <span className="pd-vis-value">{vis}%</span>}
                          {showDelta && dateRange.preset !== "all" && visDelta && <span className={`pd-delta pd-delta-${visDelta.cls}`}>{visDelta.text}</span>}
                        </span>
                      </td>
                      <td className="pd-td-metric">
                        <span className="pd-metric-with-delta">
                          {showValue && <span className="pd-vis-value">{sov}%</span>}
                          {showDelta && dateRange.preset !== "all" && sovDelta && <span className={`pd-delta pd-delta-${sovDelta.cls}`}>{sovDelta.text}</span>}
                        </span>
                      </td>
                      <td className="pd-td-metric">
                        <span className="pd-metric-with-delta">
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />
                          {showValue && <span className="pd-vis-value">{cbSent > 0 ? cbSent.toFixed(0) : "—"}</span>}
                          {showDelta && dateRange.preset !== "all" && cbSent > 0 && sentDelta && <span className={`pd-delta pd-delta-${sentDelta.cls}`}>{sentDelta.text}</span>}
                        </span>
                      </td>
                      <td className="pd-td-metric">
                        <span className="pd-metric-with-delta">
                          {showValue && <span className="pd-vis-value">{cbPos > 0 ? `#${cbPos.toFixed(1)}` : "—"}</span>}
                          {showDelta && dateRange.preset !== "all" && cbPos > 0 && posDelta && <span className={`pd-delta pd-delta-${posDelta.cls}`}>{posDelta.text}</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {sortedBrands.length === 0 && (
                  <tr><td colSpan={6} className="pd-empty">
                    {isScanning ? "Querying engines — brands will appear once responses are parsed…" : "No brands extracted yet."}
                  </td></tr>
                )}

                {/* ── Pinned own brand row — always visible even outside top 7 ── */}
                {pinnedOwnBrand && (() => {
                  const b        = pinnedOwnBrand.brand;
                  const cb       = currentPeriodMap.get(b.name);
                  const total    = filteredChats.length;
                  const vis      = cb && total > 0 ? Math.round((cb.count / total) * 100) : 0;
                  const sov      = Math.round(sowMap.get(b.name) ?? 0);
                  const cbSent   = cb?.sentiment ?? 0;
                  const cbPos    = cb?.position  ?? 0;
                  const dotColor = cbSent >= 70 ? "#10b981" : cbSent >= 40 ? "#f59e0b" : cbSent > 0 ? "#ef4444" : "#cbd5e1";
                  const showValue = indicatorMode !== "indicators-only";
                  return (
                    <>
                      <tr className="pd-pinned-separator"><td colSpan={6} /></tr>
                      <tr
                        className="pd-pinned-row"
                        onMouseEnter={() => setHoveredBrand(b.name)}
                        onMouseLeave={() => setHoveredBrand(null)}
                      >
                        <td className="pd-rank">
                          {hoveredBrand === b.name ? (
                            <span className="pd-rank-dot pd-rank-dot--clickable" style={{ background: b.color }}
                              title="Change brand color" onClick={e => openPickerAt(b.name, e)} />
                          ) : pinnedOwnBrand.rank}
                          {pickerInfo?.name === b.name && (
                            <BrandColorPicker color={b.color} position={pickerInfo.pos}
                              onChange={color => {
                                setLocalColorOverrides(prev => ({ ...prev, [b.name]: color }));
                                updateBrandColorByNameAction?.(b.name, color);
                              }}
                              onClose={() => setPickerInfo(null)} />
                          )}
                        </td>
                        <td className="pd-brand-cell">
                          <DomainFavicon domain={brandDomainByName.get(b.name) ?? guessBrandDomain(b.name)} size={16} />
                          {b.name}
                          <span className="pd-brand-you-badge">You</span>
                        </td>
                        <td className="pd-td-metric">
                          <span className="pd-metric-with-delta">
                            {showValue && <span className="pd-vis-value">{vis}%</span>}
                          </span>
                        </td>
                        <td className="pd-td-metric">
                          <span className="pd-metric-with-delta">
                            {showValue && <span className="pd-vis-value">{sov}%</span>}
                          </span>
                        </td>
                        <td className="pd-td-metric">
                          <span className="pd-metric-with-delta">
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />
                            {showValue && <span className="pd-vis-value">{cbSent > 0 ? cbSent.toFixed(0) : "—"}</span>}
                          </span>
                        </td>
                        <td className="pd-td-metric">
                          <span className="pd-metric-with-delta">
                            {showValue && <span className="pd-vis-value">{cbPos > 0 ? `#${cbPos.toFixed(1)}` : "—"}</span>}
                          </span>
                        </td>
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
            <span className="pd-link-tab pd-link-active">All URLs</span>
            <span className="pd-link-tab">All domains</span>
          </div>
        </div>

        <div className="pd-domains-grid">
          <div className="pd-domains-table-card">
            <table className="pd-domains-table">
              <thead><tr><th>Domain</th><th>Retrieved</th><th>Citation rate</th><th>Type</th></tr></thead>
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
              <div className="urls-types-total">Total retrievals: {totalDomainCitations.toLocaleString()}</div>
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

      {/* ── Fanout Queries / Common Terms ────────────────────────────────── */}
      <div className="pd-section">
        <h2 className="pd-section-title">Fanout Queries</h2>
        <p className="pd-section-subtitle">Common themes extracted from AI responses for this prompt</p>
        <div className="pd-fanout-grid">
          <div className="pd-fanout-card">
            <div className="pd-fanout-card-header">
              <span className="pd-fanout-card-title">Common Terms</span>
            </div>
            {commonTerms.length === 0 ? (
              <div className="pd-fanout-empty">No data yet — run a scan to extract terms.</div>
            ) : (
              <div className="pd-common-terms-list">
                {commonTerms.map(({ text, count }, i) => {
                  const maxCount = commonTerms[0]?.count ?? 1;
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={i} className="pd-common-term-row">
                      <span className="pd-common-term-label">{text}</span>
                      <div className="pd-common-term-bar-wrap">
                        <div className="pd-common-term-bar" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="pd-common-term-count">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pd-fanout-card">
            <div className="pd-fanout-card-header">
              <span className="pd-fanout-card-title">Latest Queries</span>
            </div>
            {recentChatsData.length === 0 ? (
              <div className="pd-fanout-empty">No queries yet.</div>
            ) : (
              <div>
                {recentChatsData.slice(0, 8).map((chat) => (
                  <div key={chat.id} className="pd-fanout-query-row" onClick={() => setSelectedChat(chat)}>
                    <EngineIcon engine={chat.engine} />
                    <span className="pd-fanout-query-text">
                      {chat.rawResponse
                        ? chat.rawResponse.replace(/#+\s/g, "").slice(0, 90) + "…"
                        : prompt.query}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Chats ──────────────────────────────────────────────────── */}
      <div className="pd-section">
        <div className="pd-domains-header-row">
          <div>
            <h2 className="pd-section-title">
              {mentionedOnly
                ? `Recent ${ownBrand ?? prompt.projectName} Mentions`
                : "Recent Chats"}
            </h2>
            <p className="pd-section-subtitle">
              {mentionedOnly
                ? `Filtered to chats where ${ownBrand ?? prompt.projectName} was mentioned`
                : "Individual AI responses for this prompt"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 font-medium">
              {ownBrand ?? prompt.projectName} mentioned
            </span>
            <button
              className={`pd-recent-toggle ${mentionedOnly ? "pd-recent-toggle-on" : ""}`}
              onClick={() => setMentionedOnly((v) => !v)}
              aria-pressed={mentionedOnly}
            >
              <span className="pd-recent-toggle-track">
                <span className="pd-recent-toggle-thumb" />
              </span>
            </button>
          </div>
        </div>

        {displayedChats.length === 0 ? (
          <div className="pd-empty-chats">
            {mentionedOnly
              ? `No chats where ${ownBrand ?? prompt.projectName} was mentioned.`
              : "🔍 No recent chats recorded yet."}
          </div>
        ) : (
          <div className="pd-chats-table-wrap">
            <table className="pd-chats-table">
              <thead>
                <tr>
                  <th>Chat</th>
                  <th>{ownBrand ?? prompt.projectName} mentioned</th>
                  <th>Position</th>
                  <th>Mentions</th>
                  <th>Sources</th>
                  <th>Location</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {displayedChats.map((chat) => {
                  const snippet = chat.rawResponse
                    ? chat.rawResponse.replace(/#+\s/g, "").slice(0, 100) + "…"
                    : prompt.query ?? "—";
                  return (
                    <tr key={chat.id} className="pd-chat-row" onClick={() => setSelectedChat(chat)}>
                      <td className="pd-chat-text-cell">
                        <EngineIcon engine={chat.engine} />
                        <span className="pd-chat-snippet-text">{snippet}</span>
                      </td>
                      <td>
                        <span className={`pd-chat-yesno ${chat.isMentioned ? "pd-chat-yesno-yes" : "pd-chat-yesno-no"}`}>
                          {chat.isMentioned ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="pd-chat-pos-cell">
                        {chat.ownPosition !== null ? (
                          <span className="pd-chat-position">#{chat.ownPosition}</span>
                        ) : (
                          <span className="pd-chat-position-none">—</span>
                        )}
                      </td>
                      <td>
                        <div className="pd-chat-mentions-row">
                          {chat.brandsFound
                            .filter((name) => selectedBrands === null || selectedBrands.includes(name))
                            .slice(0, 3)
                            .map((name, idx) => (
                              <DomainFavicon
                                key={idx}
                                domain={brandDomainByName.get(name) ?? guessBrandDomain(name)}
                                size={16}
                              />
                            ))}
                          {chat.brandsFound.filter((n) => selectedBrands === null || selectedBrands.includes(n)).length > 3 && (
                            <span className="pd-mention-more">
                              +{chat.brandsFound.filter((n) => selectedBrands === null || selectedBrands.includes(n)).length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="pd-chat-mentions-row">
                          {chat.sourcesFound.slice(0, 3).map((s, idx) => (
                            <DomainFavicon key={idx} domain={s.domain} size={16} />
                          ))}
                          {chat.sourcesFound.length > 3 && (
                            <span className="pd-mention-more">+{chat.sourcesFound.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="pd-chat-location">
                        <img
                          src={`https://flagcdn.com/w40/${(prompt.location || "us").toLowerCase()}.png`}
                          alt={prompt.location || "us"}
                          width={16}
                          height={12}
                        />
                      </td>
                      <td className="pd-chat-created">{formatTimeAgo(chat.runDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
