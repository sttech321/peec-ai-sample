"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Check, ChevronDown, Copy, Download, Grid2X2, ImageIcon, MoreHorizontal, RotateCcw, Search } from "lucide-react";
import EngineIcon from "./EngineIcon";
import DateRangeDropdown, { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import BrandsDropdown from "./BrandsDropdown";
import {
  ChatFact, Resolution,
  filterByEngines, filterByDateRange,
  buildVisibilitySeries, buildSentimentSeries, buildPositionSeries,
  buildSovSeries, buildDomainRetrievalSeries,
  buildTopRankings, buildTopRankingsBy, buildTopRankingsByGroup,
  computeBrandKpis, previousPeriod,
} from "../lib/chat-aggregations";

interface ProjectBrand {
  name: string;
  isOwn: boolean;
}

interface Props {
  chatFacts: ChatFact[];
  projectName: string;
  projectBrands: ProjectBrand[];
  ownBrandName: string | null;
  ownDomain: string | null;
  chatTopicMap?: Record<string, string>;         // chatId → topicName
  chatTagsMap?: Record<string, string[]>;        // chatId → tagNames[]
  externalDateRange?: DateRangeValue;
  externalModels?: string[];
  externalBrandNames?: string[] | null;
  externalTagNames?: string[] | null;
  externalTopicNames?: string[] | null;
}

const DEFAULT_ENGINES = ["AI Mode", "ChatGPT", "AI Overview", "Gemini", "Perplexity"];

function formatPercent(n: number, digits = 1): string {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

function formatDelta(diff: number, suffix = "%"): { text: string; tone: "up" | "down" | "flat" } {
  if (!isFinite(diff) || Math.abs(diff) < 0.05) return { text: `0${suffix}`, tone: "flat" };
  const sign = diff > 0 ? "+" : "";
  return {
    text: `${sign}${diff.toFixed(1)}${suffix}`,
    tone: diff > 0 ? "up" : "down",
  };
}

// Map a 0-100 value to a heatmap class (matches the 11-color legend).
function heatBucket(v: number): string {
  if (v < 0.5) return "h0";
  if (v < 10) return "h1";
  if (v < 20) return "h2";
  if (v < 30) return "h3";
  if (v < 40) return "h4";
  if (v < 50) return "h5";
  if (v < 60) return "h6";
  if (v < 70) return "h7";
  if (v < 80) return "h8";
  if (v < 90) return "h9";
  return "h10";
}

// Position is inverted: rank 1 is best (darkest), higher rank is lighter.
function positionHeatBucket(pos: number): string {
  if (pos <= 0) return "h0";
  if (pos <= 1) return "h10";
  if (pos <= 2) return "h8";
  if (pos <= 3) return "h6";
  if (pos <= 5) return "h4";
  if (pos <= 7) return "h2";
  return "h1";
}

// Sentiment: green gradient scale (s0-s10)
function sentimentHeatBucket(v: number): string {
  if (v <= 0)   return "s0";
  if (v < 10)   return "s1";
  if (v < 20)   return "s2";
  if (v < 30)   return "s3";
  if (v < 40)   return "s4";
  if (v < 50)   return "s5";
  if (v < 60)   return "s6";
  if (v < 70)   return "s7";
  if (v < 80)   return "s8";
  if (v < 90)   return "s9";
  return "s10";
}

// Position: teal gradient (p0-p10), lower position = darker (better)
function positionHeatBucketNew(pos: number): string {
  if (pos <= 0)  return "p0";
  if (pos <= 1)  return "p10";
  if (pos <= 3)  return "p9";
  if (pos <= 6)  return "p8";
  if (pos <= 9)  return "p7";
  if (pos <= 12) return "p6";
  if (pos <= 15) return "p5";
  if (pos <= 18) return "p4";
  if (pos <= 21) return "p3";
  if (pos <= 24) return "p2";
  return "p1";
}

function normalizeDomain(d: string | null | undefined): string | null {
  if (!d) return null;
  const cleaned = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  return cleaned || null;
}

// ── Performance Matrix: axis types + helpers ─────────────────────────────
type MatrixAxis = "models" | "brands" | "topics" | "tags";
const AXIS_LABELS: Record<MatrixAxis, string> = {
  models: "AI models", brands: "Brands", topics: "Topics", tags: "Tags",
};
type UCell = {
  col: string; row: string;
  visibility: number; sentiment: number; position: number; sov: number;
  hasData: boolean;
};

function filterChatsByAxisItem(
  chats: ChatFact[],
  item: string,
  axis: MatrixAxis,
  topicMap: Record<string, string>,
  tagsMap: Record<string, string[]>,
): ChatFact[] {
  if (axis === "brands") return chats;
  if (axis === "models") return chats.filter(c => c.engine === item);
  if (axis === "topics") return chats.filter(c => topicMap[c.id] === item);
  return chats.filter(c => {
    const tags = tagsMap[c.id];
    return Array.isArray(tags) ? tags.includes(item) : false;
  });
}

function computeMetricsForBrand(
  chats: ChatFact[],
  brandName: string,
): { visibility: number; sentiment: number; position: number; sov: number; hasData: boolean } {
  const total = chats.length;
  if (total === 0) return { visibility: 0, sentiment: 0, position: 0, sov: 0, hasData: false };
  let hits = 0, sentSum = 0, sentN = 0, posSum = 0, posN = 0, totalSlots = 0;
  for (const c of chats) {
    totalSlots += new Set(c.brands.map(b => b.name)).size;
    const entry = c.brands.find(b => b.name === brandName);
    if (entry) {
      hits++;
      if (entry.sentiment != null && entry.sentiment > 0) { sentSum += entry.sentiment; sentN++; }
      if (entry.position != null && entry.position > 0)   { posSum += entry.position;  posN++; }
    }
  }
  return {
    visibility: (hits / total) * 100,
    sentiment: sentN > 0 ? sentSum / sentN : 0,
    position:  posN > 0 ? posSum / posN   : 0,
    sov:       totalSlots > 0 ? (hits / totalSlots) * 100 : 0,
    hasData:   hits > 0,
  };
}

export default function InsightsClient({
  chatFacts, projectName, projectBrands, ownBrandName, ownDomain,
  chatTopicMap = {}, chatTagsMap = {},
  externalDateRange, externalModels, externalBrandNames,
  externalTagNames, externalTopicNames,
}: Props) {
  const [resolution, setResolution] = useState<Resolution>("D");
  const internalDateRange = makePresetRange("30");
  const dateRange = externalDateRange ?? internalDateRange;
  const [selectedBrands, setSelectedBrands] = useState<string[] | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [tagsDropdownOpen, setTagsDropdownOpen] = useState(false);
  const [matrixTab, setMatrixTab] = useState<"visibility" | "sentiment" | "position" | "sov">("visibility");
  // Chart tab — separate from matrix tab
  const [chartTab, setChartTab] = useState<"visibility" | "sentiment" | "position" | "sov">("visibility");
  // Chart download menu
  const [chartMenuOpen, setChartMenuOpen] = useState(false);
  const chartCardRef = useRef<HTMLDivElement>(null);
  const chartMenuRef = useRef<HTMLDivElement>(null);
  // Rankings tab — separate from chart + matrix tabs
  const [rankingsTab, setRankingsTab] = useState<"visibility" | "sentiment" | "position" | "sov">("visibility");
  const [rankSortAsc, setRankSortAsc] = useState(true);

  // ── Rankings hover tooltip ────────────────────────────────────────────
  const [rankHover, setRankHover] = useState<{
    brand: string;
    engine: string;
    pos: { top: number; left: number };
  } | null>(null);

  function showRankTooltip(brand: string, engine: string, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Position tooltip above/left of the cell, clamped to viewport
    const tooltipW = 210;
    const tooltipH = 130;
    let left = rect.left - tooltipW - 8;
    if (left < 8) left = rect.right + 8;
    let top = rect.top - tooltipH / 2;
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipH - 8));
    setRankHover({ brand, engine, pos: { top, left } });
  }

  function hideRankTooltip() { setRankHover(null); }

  // ── Feature 1: X/Y Axis switcher ──────────────────────────────────────
  const [matrixXAxis, setMatrixXAxis] = useState<MatrixAxis>("models");
  const [matrixYAxis, setMatrixYAxis] = useState<MatrixAxis>("brands");
  const [axisSwitcherOpen, setAxisSwitcherOpen] = useState(false);
  const axisSwitcherRef = useRef<HTMLDivElement>(null);

  function handleXAxisChange(axis: MatrixAxis) {
    if (axis === matrixYAxis) return;
    setMatrixXAxis(axis);
    setAxisSwitcherOpen(false);
  }
  function handleYAxisChange(axis: MatrixAxis) {
    if (axis === matrixXAxis) return;
    setMatrixYAxis(axis);
    setAxisSwitcherOpen(false);
  }

  // ── Feature 2: Column/Row Selector panel ──────────────────────────────
  const [colSelectorOpen, setColSelectorOpen] = useState(false);
  const [colSearch, setColSearch] = useState("");
  const [visibleMatrixBrands, setVisibleMatrixBrands] = useState<string[] | null>(null);  // null = all
  const [visibleMatrixEngines, setVisibleMatrixEngines] = useState<string[] | null>(null); // null = all
  const colSelectorRef = useRef<HTMLDivElement>(null);

  // ── Feature 3: Rankings Group-By (fully functional) ──────────────────
  type RankGroupBy = "models" | "topics" | "tags";
  const [rankingsGroupBy, setRankingsGroupBy] = useState<RankGroupBy>("models");
  const [rankingsGroupByOpen, setRankingsGroupByOpen] = useState(false);
  const rankingsGroupByRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (axisSwitcherRef.current && !axisSwitcherRef.current.contains(e.target as Node))
        setAxisSwitcherOpen(false);
      if (colSelectorRef.current && !colSelectorRef.current.contains(e.target as Node))
        setColSelectorOpen(false);
      if (rankingsGroupByRef.current && !rankingsGroupByRef.current.contains(e.target as Node))
        setRankingsGroupByOpen(false);
      if (chartMenuRef.current && !chartMenuRef.current.contains(e.target as Node))
        setChartMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const allEngines = useMemo(() => {
    const set = new Set<string>();
    for (const c of chatFacts) set.add(c.engine);
    const found = Array.from(set);
    for (const d of DEFAULT_ENGINES) if (!found.includes(d)) found.push(d);
    return found;
  }, [chatFacts]);
  const [internalModels, setInternalModels] = useState<string[]>(allEngines);
  const selectedModels = externalModels ?? internalModels;

  const toggleModel = (model: string) => {
    setInternalModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model],
    );
  };

  const applyExternalFilters = (facts: ChatFact[]) => {
    let f = facts;
    if (externalBrandNames && externalBrandNames.length > 0) {
      f = f.filter((c) => c.brands.some((b) => externalBrandNames.includes(b.name)));
    }
    if (externalTagNames && externalTagNames.length > 0) {
      f = f.filter((c) => { const t = chatTagsMap[c.id]; return t && t.some((tag) => externalTagNames.includes(tag)); });
    }
    if (externalTopicNames && externalTopicNames.length > 0) {
      f = f.filter((c) => { const topic = chatTopicMap[c.id]; return topic !== undefined && externalTopicNames.includes(topic); });
    }
    return f;
  };

  const filteredChats = useMemo(
    () => applyExternalFilters(filterByDateRange(filterByEngines(chatFacts, selectedModels), dateRange)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatFacts, selectedModels, dateRange, externalBrandNames, externalTagNames, externalTopicNames, chatTagsMap, chatTopicMap],
  );
  // Previous period only makes sense for bounded ranges; "All time" has nothing before it.
  const previousChats = useMemo(() => {
    if (dateRange.preset === "all") return [];
    const prev = previousPeriod(dateRange);
    return applyExternalFilters(filterByDateRange(filterByEngines(chatFacts, selectedModels), prev));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatFacts, selectedModels, dateRange, externalBrandNames, externalTagNames, externalTopicNames, chatTagsMap, chatTopicMap]);
  const showDeltas = dateRange.preset !== "all";

  // Resolve "your" brand — explicit isOwn flag, fall back to project name match.
  const yourBrand = useMemo(() => {
    if (ownBrandName) return ownBrandName;
    const explicit = projectBrands.find((b) => b.isOwn);
    if (explicit) return explicit.name;
    // Fallback: project name (case-insensitive) match
    const lc = projectName.toLowerCase();
    const match = projectBrands.find((b) => b.name.toLowerCase() === lc);
    return match?.name ?? projectName;
  }, [projectBrands, projectName, ownBrandName]);

  // ── KPI computation ──────────────────────────────────────────────────
  const kpi = useMemo(
    () => computeBrandKpis(filteredChats, yourBrand, selectedModels),
    [filteredChats, yourBrand, selectedModels],
  );
  const prevKpi = useMemo(
    () => computeBrandKpis(previousChats, yourBrand, selectedModels),
    [previousChats, yourBrand, selectedModels],
  );

  // Determine "your" overall rank using all engines for ranking.
  const yourRank = useMemo(() => {
    const rankings = buildTopRankings(filteredChats, selectedModels, 50);
    // Average rank across engines where own brand appears
    const ranks: number[] = [];
    for (const eng of selectedModels) {
      const idx = rankings[eng]?.findIndex((r) => r.brand === yourBrand) ?? -1;
      if (idx >= 0) ranks.push(idx + 1);
    }
    if (ranks.length === 0) return null;
    return Math.round(ranks.reduce((s, r) => s + r, 0) / ranks.length);
  }, [filteredChats, selectedModels, yourBrand]);

  // ── Chart data ──────────────────────────────────────────────────────
  const chartBrands = useMemo(() => {
    // Always show "your" brand as the primary line; if user picked others, include them.
    const set = new Set<string>();
    set.add(yourBrand);
    if (selectedBrands) for (const n of selectedBrands) set.add(n);
    return Array.from(set);
  }, [yourBrand, selectedBrands]);

  const chartData = useMemo(
    () => buildVisibilitySeries(filteredChats, chartBrands, resolution, dateRange),
    [filteredChats, chartBrands, resolution, dateRange],
  );

  // Sentiment / Position / SoV series for the brand
  const sentimentData = useMemo(
    () => buildSentimentSeries(filteredChats, yourBrand, resolution, dateRange),
    [filteredChats, yourBrand, resolution, dateRange],
  );
  const positionData = useMemo(
    () => buildPositionSeries(filteredChats, yourBrand, resolution, dateRange),
    [filteredChats, yourBrand, resolution, dateRange],
  );
  const sovData = useMemo(
    () => buildSovSeries(filteredChats, yourBrand, resolution, dateRange),
    [filteredChats, yourBrand, resolution, dateRange],
  );

  // Domain retrieval % — always shown as second line (right axis)
  const domainData = useMemo(
    () => ownDomain ? buildDomainRetrievalSeries(filteredChats, ownDomain, resolution, dateRange) : [],
    [filteredChats, ownDomain, resolution, dateRange],
  );

  // Merge brand metric + domain retrieval into one series for the chart
  const mergedChartData = useMemo(() => {
    const brandSeries =
      chartTab === "visibility" ? chartData :
      chartTab === "sentiment"  ? sentimentData :
      chartTab === "position"   ? positionData  :
      sovData;
    if (!ownDomain || domainData.length === 0) return brandSeries;
    return brandSeries.map((pt, i) => ({
      ...pt,
      __domain__: domainData[i]?.[ownDomain] ?? 0,
    }));
  }, [chartTab, chartData, sentimentData, positionData, sovData, domainData, ownDomain]);

  // ── Chart export helpers ─────────────────────────────────────────────

  function fmtExportDate(d: Date): string {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function fmtExportDateFull(d: Date): string {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const exportDateLabel = `${fmtExportDate(dateRange.start)} - ${fmtExportDateFull(dateRange.end)}`;
  const exportDaysLabel = dateRange.preset === "all"
    ? "All time"
    : `${Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000)} days`;
  const exportResLabel = resolution === "D" ? "Daily" : resolution === "W" ? "Weekly" : "Monthly";
  const exportTabLabel = chartTab.charAt(0).toUpperCase() + chartTab.slice(1);

  function exportChartCsv() {
    setChartMenuOpen(false);
    const dates = mergedChartData.map((d) => String(d.date));
    const valueSuffix = chartTab === "position" ? "" : "%";
    const rows = chartBrands.map((brand) => [
      brand,
      ...mergedChartData.map((d) => {
        const v = (d as Record<string, unknown>)[brand];
        return v !== undefined && isFinite(Number(v))
          ? `${Number(v).toFixed(2)}${valueSuffix}`
          : "";
      }),
    ]);
    const csv = [["brand", ...dates], ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const today = new Date().toISOString().split("T")[0];
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `${chartTab}_export_from-${today}.csv`;
    a.click();
  }

  async function saveChartAsImage() {
    setChartMenuOpen(false);
    const card = chartCardRef.current;
    if (!card) return;
    card.setAttribute("data-exporting", "true");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(card, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const a = document.createElement("a");
      a.download = `${chartTab}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } finally {
      card.removeAttribute("data-exporting");
    }
  }

  async function copyChartToClipboard() {
    setChartMenuOpen(false);
    const card = chartCardRef.current;
    if (!card) return;
    card.setAttribute("data-exporting", "true");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(card, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        } catch {
          // fallback: download if clipboard API not available
          const a = document.createElement("a");
          a.download = `${chartTab}.png`;
          a.href = canvas.toDataURL("image/png");
          a.click();
        }
      }, "image/png");
    } finally {
      card.removeAttribute("data-exporting");
    }
  }

  // ── Performance matrix ──────────────────────────────────────────────
  const matrixBrands = useMemo(() => {
    // Top 10 brands by overall visibility. Prepend yourBrand only if it
    // actually appears in the data — otherwise we waste a row showing dashes.
    const counts = new Map<string, number>();
    for (const c of filteredChats) {
      const seen = new Set<string>();
      for (const b of c.brands) {
        if (seen.has(b.name)) continue;
        seen.add(b.name);
        counts.set(b.name, (counts.get(b.name) || 0) + 1);
      }
    }
    const ranked = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .map((b) => b.name);
    const ownHasData = counts.has(yourBrand);
    const withOwn = ownHasData
      ? [yourBrand, ...ranked.filter((n) => n !== yourBrand)]
      : ranked;
    return withOwn.slice(0, 10);
  }, [filteredChats, yourBrand]);

  // Apply column selector filter (null = show all)
  const activeMatrixBrands = useMemo(
    () => visibleMatrixBrands ? matrixBrands.filter(b => visibleMatrixBrands.includes(b)) : matrixBrands,
    [matrixBrands, visibleMatrixBrands],
  );
  const activeMatrixEngines = useMemo(
    () => visibleMatrixEngines ? selectedModels.filter(e => visibleMatrixEngines.includes(e)) : selectedModels,
    [selectedModels, visibleMatrixEngines],
  );

  // Column items (X-axis) and row items (Y-axis) for the matrix
  const matrixColItems = useMemo(() => {
    if (matrixXAxis === "models") return activeMatrixEngines;
    if (matrixXAxis === "brands") return activeMatrixBrands;
    const keys = new Set<string>();
    for (const c of filteredChats) {
      if (matrixXAxis === "topics") { const t = chatTopicMap[c.id]; if (t) keys.add(t); }
      else { const tags = chatTagsMap[c.id]; if (tags) tags.forEach(tag => keys.add(tag)); }
    }
    return [...keys].sort();
  }, [matrixXAxis, activeMatrixEngines, activeMatrixBrands, filteredChats, chatTopicMap, chatTagsMap]);

  const matrixRowItems = useMemo(() => {
    if (matrixYAxis === "models") return activeMatrixEngines;
    if (matrixYAxis === "brands") return activeMatrixBrands;
    const keys = new Set<string>();
    for (const c of filteredChats) {
      if (matrixYAxis === "topics") { const t = chatTopicMap[c.id]; if (t) keys.add(t); }
      else { const tags = chatTagsMap[c.id]; if (tags) tags.forEach(tag => keys.add(tag)); }
    }
    return [...keys].sort();
  }, [matrixYAxis, activeMatrixEngines, activeMatrixBrands, filteredChats, chatTopicMap, chatTagsMap]);

  // Unified cells for all X×Y axis combinations
  const unifiedCells = useMemo(() => {
    const cells: UCell[] = [];
    for (const col of matrixColItems) {
      const colChats = filterChatsByAxisItem(filteredChats, col, matrixXAxis, chatTopicMap, chatTagsMap);
      for (const row of matrixRowItems) {
        const cellChats = filterChatsByAxisItem(colChats, row, matrixYAxis, chatTopicMap, chatTagsMap);
        const brandSubject = matrixYAxis === "brands" ? row : matrixXAxis === "brands" ? col : yourBrand;
        cells.push({ col, row, ...computeMetricsForBrand(cellChats, brandSubject) });
      }
    }
    return cells;
  }, [filteredChats, matrixXAxis, matrixYAxis, matrixColItems, matrixRowItems, chatTopicMap, chatTagsMap, yourBrand]);

  // ── Matrix sort state ─────────────────────────────────────────────────
  const [matrixSortEngine, setMatrixSortEngine] = useState<string | null>(null); // null = sort by row label
  const [matrixSortDir, setMatrixSortDir]       = useState<"asc" | "desc">("desc");

  // Sort matrix rows by active metric
  const sortedMatrixRows = useMemo(() => {
    const rows = [...matrixRowItems];
    const col = matrixSortEngine;
    const dir = matrixSortDir;

    rows.sort((a, b) => {
      let va = 0, vb = 0;
      if (col) {
        const ca = unifiedCells.find(c => c.row === a && c.col === col);
        const cb = unifiedCells.find(c => c.row === b && c.col === col);
        if (matrixTab === "visibility")  { va = ca?.visibility ?? 0;   vb = cb?.visibility ?? 0; }
        if (matrixTab === "sentiment")   { va = ca?.sentiment  ?? 0;   vb = cb?.sentiment  ?? 0; }
        if (matrixTab === "position")    { va = ca?.position   ?? 999; vb = cb?.position   ?? 999; }
        if (matrixTab === "sov")         { va = ca?.sov        ?? 0;   vb = cb?.sov        ?? 0; }
      } else {
        const avgMetric = (row: string) => {
          const cells = unifiedCells.filter(c => c.row === row);
          if (cells.length === 0) return matrixTab === "position" ? 999 : 0;
          const sum = cells.reduce((s, c) =>
            s + (matrixTab === "visibility" ? c.visibility : matrixTab === "sentiment" ? c.sentiment : matrixTab === "position" ? c.position : c.sov)
          , 0);
          return sum / cells.length;
        };
        va = avgMetric(a); vb = avgMetric(b);
      }
      const isPosition = matrixTab === "position";
      const effectiveDir = isPosition ? (dir === "desc" ? "asc" : "desc") : dir;
      return effectiveDir === "desc" ? vb - va : va - vb;
    });
    return rows;
  }, [matrixRowItems, unifiedCells, matrixTab, matrixSortEngine, matrixSortDir]);

  // Reset sort when tab or axes change
  useEffect(() => {
    setMatrixSortEngine(null);
    setMatrixSortDir("desc");
  }, [matrixTab, matrixXAxis, matrixYAxis]);

  function toggleMatrixSort(engine: string | null) {
    if (matrixSortEngine === engine) {
      setMatrixSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setMatrixSortEngine(engine);
      setMatrixSortDir("desc");
    }
  }

  // ── Top rankings — updates with tab + group-by ───────────────────────
  const topRankings = useMemo(() => {
    if (rankingsGroupBy === "topics") {
      return buildTopRankingsByGroup(filteredChats, chatTopicMap, rankingsTab, 10);
    }
    if (rankingsGroupBy === "tags") {
      return buildTopRankingsByGroup(filteredChats, chatTagsMap, rankingsTab, 10);
    }
    return buildTopRankingsBy(filteredChats, selectedModels, rankingsTab, 10);
  }, [filteredChats, selectedModels, rankingsTab, rankingsGroupBy, chatTopicMap, chatTagsMap]);

  // ── Render helpers ──────────────────────────────────────────────────
  const visDelta = formatDelta(kpi.visibility - prevKpi.visibility);
  const sentDelta = formatDelta(kpi.sentiment - prevKpi.sentiment, "");
  const posDelta = prevKpi.position && kpi.position
    ? formatDelta(prevKpi.position - kpi.position, "") // lower position = better, invert
    : { text: "0", tone: "flat" as const };
  const sovDelta = formatDelta(kpi.sov - prevKpi.sov);

  const getCell = (col: string, row: string) =>
    unifiedCells.find((c) => c.col === col && c.row === row);

  function getHeatClass(cell: UCell | undefined): string {
    if (!cell) return "h0";
    if (matrixTab === "visibility") return heatBucket(cell.visibility);
    if (matrixTab === "sentiment")  return sentimentHeatBucket(cell.sentiment);
    if (matrixTab === "position")   return positionHeatBucketNew(cell.position);
    if (matrixTab === "sov")        return heatBucket(cell.sov);
    return "h0";
  }
  function getDisplayVal(cell: UCell | undefined): string {
    if (!cell || !cell.hasData) return "—";
    if (matrixTab === "visibility" && cell.visibility >= 0.5) return `${cell.visibility.toFixed(1)}%`;
    if (matrixTab === "sentiment"  && cell.sentiment  >  0)  return Math.round(cell.sentiment).toString();
    if (matrixTab === "position"   && cell.position   >  0)  return cell.position.toFixed(1);
    if (matrixTab === "sov"        && cell.sov        >= 0.5) return `${cell.sov.toFixed(1)}%`;
    return "—";
  }

  return (
    <div className="ins-page">
      {/* Hero */}
      <div className="ins-hero">
        <div className="ins-hero-meta">Updated · {dateRange.label.toLowerCase()}</div>
        <h1 className="ins-hero-title">
          {yourRank
            ? `You're #${yourRank} in AI Visibility`
            : "You're not yet visible in AI"}
        </h1>
        <p className="ins-hero-subtitle">
          {yourRank && yourRank <= 3
            ? "You appear in most AI answers and are often the default choice."
            : yourRank && yourRank <= 10
              ? "You appear regularly in AI answers; there's room to climb."
              : "Track your brand visibility in AI responses to improve your ranking."}
        </p>

        <div className="ins-kpi-row">
          <KpiCard label="Visibility" value={formatPercent(kpi.visibility)} delta={showDeltas ? visDelta : undefined} />
          <KpiCard
            label="Sentiment"
            value={kpi.sentiment > 0 ? Math.round(kpi.sentiment).toString() : "—"}
            delta={kpi.sentiment > 0 && showDeltas ? sentDelta : undefined}
            dot={kpi.sentiment > 0}
          />
          <KpiCard
            label="Position"
            value={kpi.position > 0 ? `#${kpi.position.toFixed(1)}` : "—"}
            delta={showDeltas ? posDelta : undefined}
          />
          <KpiCard label="SoV" value={formatPercent(kpi.sov)} delta={showDeltas ? sovDelta : undefined} />
          <KpiCard
            label="Strongest model"
            value={
              kpi.strongestEngine ? (
                <span className="ins-kpi-engine">
                  <EngineIcon engine={kpi.strongestEngine} size={14} /> {kpi.strongestEngine}
                </span>
              ) : "—"
            }
          />
          <KpiCard
            label="Weakest model"
            value={
              kpi.weakestEngine ? (
                <span className="ins-kpi-engine">
                  <EngineIcon engine={kpi.weakestEngine} size={14} /> {kpi.weakestEngine}
                </span>
              ) : "—"
            }
          />
        </div>
      </div>

      {/* Brand insights chart */}
      <section className="ins-section">
        <h2 className="ins-section-title">Your brand insights</h2>
        <p className="ins-section-subtitle">How your brand metrics change over time</p>

        <div className="ins-chart-card" ref={chartCardRef}>
          {/* Export-only header: hidden in normal UI, shown during image capture */}
          <div className="ins-chart-export-title">
            <span className="ins-export-metric">{exportTabLabel} · {exportDateLabel}</span>
            <span className="ins-export-period">{exportDaysLabel} · {exportResLabel}</span>
          </div>
          <div className="ins-chart-header">
            {/* 4 functional tab buttons */}
            <div className="ins-chart-tabs">
              {([
                { key: "visibility", icon: "👁",  label: "Visibility" },
                { key: "sentiment",  icon: "😊",  label: "Sentiment"  },
                { key: "position",   icon: "↕",   label: "Position"   },
                { key: "sov",        icon: "🥧",  label: "SoV"        },
              ] as { key: typeof chartTab; icon: string; label: string }[]).map(tab => (
                <button
                  key={tab.key}
                  className={`ins-chart-tab ${chartTab === tab.key ? "ins-chart-tab--active" : ""}`}
                  onClick={() => setChartTab(tab.key)}
                >
                  <span>{tab.icon}</span>
                  {chartTab === tab.key && <span style={{ marginLeft: 4 }}>{tab.label}</span>}
                </button>
              ))}
            </div>
            <div className="ins-chart-controls">
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
              {/* ··· Chart download menu */}
              <div className="ins-chart-menu-wrap" ref={chartMenuRef}>
                <button
                  className="ch-dots-btn ins-chart-dots"
                  title="Export options"
                  onClick={() => setChartMenuOpen((o) => !o)}
                >
                  <MoreHorizontal size={15} />
                </button>
                {chartMenuOpen && (
                  <div className="ins-chart-menu">
                    <button className="ins-chart-menu-item" onClick={exportChartCsv}>
                      <Download size={13} />
                      Export CSV
                    </button>
                    <button className="ins-chart-menu-item" onClick={saveChartAsImage}>
                      <ImageIcon size={13} />
                      Save as image
                    </button>
                    <button className="ins-chart-menu-item" onClick={copyChartToClipboard}>
                      <Copy size={13} />
                      Copy to clipboard
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dual Y-axis ComposedChart */}
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={mergedChartData} margin={{ top: 10, right: 48, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              {/* Left axis — brand metric */}
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) =>
                  chartTab === "position" ? v.toFixed(1) :
                  chartTab === "sentiment" ? v.toFixed(1) :
                  `${v}%`
                }
                domain={
                  chartTab === "position"  ? [0, "auto"] :
                  chartTab === "sentiment" ? [0, 100]    :
                  [0, 100]
                }
              />
              {/* Right axis — domain retrieval % */}
              {ownDomain && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, "auto"]}
                />
              )}
              <Tooltip
                cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" }}
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  color: "#111827",
                  fontSize: 12,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                }}
                formatter={(value: unknown, name: unknown) => {
                  const v = Number(value);
                  const n = String(name);
                  if (n === "__domain__") return [`${v.toFixed(1)}%`, `Retrieved % · ${normalizeDomain(ownDomain)}`] as [string, string];
                  const label =
                    chartTab === "visibility" ? `${v.toFixed(1)}%` :
                    chartTab === "sentiment"  ? v.toFixed(1)        :
                    chartTab === "position"   ? `#${v.toFixed(1)}`  :
                    `${v.toFixed(1)}%`;
                  const tabLabel = chartTab.charAt(0).toUpperCase() + chartTab.slice(1);
                  return [label, tabLabel] as [string, string];
                }}
              />
              {/* Brand metric line — left axis, blue */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey={yourBrand}
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "#3b82f6", strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
              {/* Domain retrieval line — right axis, amber */}
              {ownDomain && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="__domain__"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: "#f59e0b", strokeWidth: 0 }}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="ins-legend">
            <span className="ins-legend-item">
              <span className="ins-legend-dot" style={{ background: "#3b82f6" }} />
              {chartTab.charAt(0).toUpperCase() + chartTab.slice(1)}
            </span>
            <span className="ins-legend-sep">|</span>
            <span className="ins-legend-item" style={{ color: "#9ca3af" }}>Your domain</span>
            {normalizeDomain(ownDomain) && (
              <>
                <span className="ins-legend-sep">|</span>
                <span className="ins-legend-item">
                  <span className="ins-legend-dot" style={{ background: "#f59e0b" }} />
                  {normalizeDomain(ownDomain)}
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Performance matrix */}
      <section className="ins-section">
        <div className="ins-section-row">
          <div>
            <h2 className="ins-section-title">Performance matrix</h2>
            <p className="ins-section-subtitle">Compare metrics across different dimensions.</p>
          </div>
          {/* Feature 1: X/Y Axis Switcher + Feature 2: Column Selector */}
          <div className="ins-section-action" style={{ display: "flex", gap: 8 }}>
            {/* Axis Switcher */}
            <div ref={axisSwitcherRef} style={{ position: "relative" }}>
              <button
                className="pd-filter-chip"
                onClick={() => setAxisSwitcherOpen(v => !v)}
              >
                {`${AXIS_LABELS[matrixXAxis]} vs ${AXIS_LABELS[matrixYAxis]}`}
                <ChevronDown size={11} />
              </button>
              {axisSwitcherOpen && (
                <div className="ins-axis-menu">
                  <div className="ins-axis-section-label">X-axis · Columns</div>
                  {([
                    { key: "models" as MatrixAxis, label: "AI models", icon: "⊙" },
                    { key: "brands" as MatrixAxis, label: "Brands",    icon: "⊞" },
                    { key: "topics" as MatrixAxis, label: "Topics",    icon: "◎" },
                    { key: "tags"   as MatrixAxis, label: "Tags",      icon: "◈" },
                  ]).map(opt => (
                    <button
                      key={opt.key}
                      className={`ins-axis-option ${matrixXAxis === opt.key ? "ins-axis-option--active" : ""}`}
                      disabled={matrixYAxis === opt.key}
                      onClick={() => handleXAxisChange(opt.key)}
                    >
                      <span className="ins-axis-icon">{opt.icon}</span>
                      {opt.label}
                      {matrixXAxis === opt.key && <Check size={12} style={{ marginLeft: "auto" }} />}
                    </button>
                  ))}
                  <div className="ins-axis-sep" />
                  <div className="ins-axis-section-label">Y-axis · Rows</div>
                  {([
                    { key: "models" as MatrixAxis, label: "AI models", icon: "⊙" },
                    { key: "brands" as MatrixAxis, label: "Brands",    icon: "⊞" },
                    { key: "topics" as MatrixAxis, label: "Topics",    icon: "◎" },
                    { key: "tags"   as MatrixAxis, label: "Tags",      icon: "◈" },
                  ]).map(opt => (
                    <button
                      key={opt.key}
                      className={`ins-axis-option ${matrixYAxis === opt.key ? "ins-axis-option--active" : ""}`}
                      disabled={matrixXAxis === opt.key}
                      onClick={() => handleYAxisChange(opt.key)}
                    >
                      <span className="ins-axis-icon">{opt.icon}</span>
                      {opt.label}
                      {matrixYAxis === opt.key && <Check size={12} style={{ marginLeft: "auto" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Column Selector */}
            <div ref={colSelectorRef} style={{ position: "relative" }}>
              <button
                className="ins-col-selector-btn"
                onClick={() => setColSelectorOpen(v => !v)}
                title="Select columns/rows"
              >
                <Grid2X2 size={14} />
              </button>
              {colSelectorOpen && (
                <div className="ins-col-panel">
                  <div className="ins-col-search-wrap">
                    <Search size={12} className="ins-col-search-icon" />
                    <input
                      className="ins-col-search-input"
                      placeholder="Search"
                      value={colSearch}
                      onChange={e => setColSearch(e.target.value)}
                      autoFocus
                    />
                  </div>

                  {/* Top brands group */}
                  <div className="ins-col-group-label">Top {matrixBrands.length} Brands</div>
                  <div className="ins-col-items">
                    {matrixBrands.filter(b => b.toLowerCase().includes(colSearch.toLowerCase())).map(b => {
                      const checked = visibleMatrixBrands === null || visibleMatrixBrands.includes(b);
                      const isYou = b === yourBrand;
                      return (
                        <label key={b} className="ins-col-item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const current = visibleMatrixBrands ?? matrixBrands;
                              const next = checked ? current.filter(x => x !== b) : [...current, b];
                              setVisibleMatrixBrands(next.length === matrixBrands.length ? null : next);
                            }}
                          />
                          <span className="ins-col-item-name">{b}</span>
                          {isYou && <span className="ins-you-badge">You</span>}
                        </label>
                      );
                    })}
                  </div>

                  {/* Top engines group */}
                  <div className="ins-col-group-label">Top {selectedModels.length} AI models</div>
                  <div className="ins-col-items">
                    {selectedModels.filter(e => e.toLowerCase().includes(colSearch.toLowerCase())).map(e => {
                      const checked = visibleMatrixEngines === null || visibleMatrixEngines.includes(e);
                      return (
                        <label key={e} className="ins-col-item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const current = visibleMatrixEngines ?? selectedModels;
                              const next = checked ? current.filter(x => x !== e) : [...current, e];
                              setVisibleMatrixEngines(next.length === selectedModels.length ? null : next);
                            }}
                          />
                          <EngineIcon engine={e} size={13} />
                          <span className="ins-col-item-name">{e}</span>
                        </label>
                      );
                    })}
                  </div>

                  <button
                    className="ins-col-reset"
                    onClick={() => { setVisibleMatrixBrands(null); setVisibleMatrixEngines(null); setColSearch(""); }}
                  >
                    <RotateCcw size={11} /> Reset all
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ins-chart-card">
          <div className="ins-chart-header">
            <div className="ins-chart-tabs">
              {(["visibility", "sentiment", "position", "sov"] as const).map(tab => (
                <button
                  key={tab}
                  className={`ins-chart-tab ${matrixTab === tab ? "ins-chart-tab--active" : ""}`}
                  onClick={() => setMatrixTab(tab)}
                >
                  {tab === "visibility" && <><span className="ins-eye">👁</span> Visibility</>}
                  {tab === "sentiment" && "😊 Sentiment"}
                  {tab === "position" && "📏 Position"}
                  {tab === "sov" && "🥧 SoV"}
                </button>
              ))}
            </div>
          </div>

          <div className="ins-matrix-wrap">
            <table className="ins-matrix">
              <thead>
                <tr>
                  <th className="ins-matrix-rowhead">
                    <button className="ins-matrix-sort-btn" onClick={() => toggleMatrixSort(null)}>
                      {AXIS_LABELS[matrixYAxis]}{" "}{matrixSortEngine === null ? (matrixSortDir === "desc" ? "↓" : "↑") : "↕"}
                    </button>
                  </th>
                  {matrixColItems.map(col => (
                    <th key={col}>
                      <button className="ins-matrix-sort-btn" onClick={() => toggleMatrixSort(col)}>
                        {matrixXAxis === "models" && <><EngineIcon engine={col} size={12} />{" "}</>}
                        {col}
                        {matrixXAxis === "brands" && col === yourBrand && <span className="ins-you-tag ins-you-tag--inline">You</span>}
                        {" "}{matrixSortEngine === col ? (matrixSortDir === "desc" ? "↓" : "↑") : "↕"}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedMatrixRows.length === 0 ? (
                  <tr><td className="ins-empty" colSpan={matrixColItems.length + 1}>No data for this filter combination.</td></tr>
                ) : sortedMatrixRows.map(row => (
                  <tr key={row}>
                    <td className="ins-matrix-rowhead ins-matrix-rowhead--brand">
                      {matrixYAxis === "models" ? (
                        <span className="ins-engine-cell"><EngineIcon engine={row} size={14} /> {row}</span>
                      ) : (
                        <>
                          {row}
                          {matrixYAxis === "brands" && row === yourBrand && <span className="ins-you-pill">You</span>}
                        </>
                      )}
                    </td>
                    {matrixColItems.map(col => {
                      const cell = getCell(col, row);
                      return (
                        <td key={col}>
                          <div className={`ins-heat ins-heat-${getHeatClass(cell)}`}>
                            {getDisplayVal(cell)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Dynamic legend per tab */}
          <div className="ins-heat-legend">
            {matrixTab === "sentiment" && [
              { label: "0-9",   cls: "s0"  }, { label: "10-19", cls: "s1"  },
              { label: "20-29", cls: "s2"  }, { label: "30-39", cls: "s3"  },
              { label: "40-49", cls: "s4"  }, { label: "50-59", cls: "s5"  },
              { label: "60-69", cls: "s6"  }, { label: "70-79", cls: "s7"  },
              { label: "80-89", cls: "s8"  }, { label: "90-100",cls: "s10" },
            ].map(b => (
              <span key={b.cls} className="ins-heat-legend-item">
                <span className={`ins-heat-dot ins-heat-${b.cls}`} />{b.label}
              </span>
            ))}
            {matrixTab === "position" && [
              { label: "0",     cls: "p0"  }, { label: "1-3",   cls: "p9"  },
              { label: "4-6",   cls: "p8"  }, { label: "7-9",   cls: "p7"  },
              { label: "10-12", cls: "p6"  }, { label: "13-15", cls: "p5"  },
              { label: "16-18", cls: "p4"  }, { label: "19-21", cls: "p3"  },
              { label: "22-24", cls: "p2"  }, { label: "25-27", cls: "p1"  }, { label: "28-30", cls: "p0" },
            ].map(b => (
              <span key={b.cls + b.label} className="ins-heat-legend-item">
                <span className={`ins-heat-dot ins-heat-${b.cls}`} />{b.label}
              </span>
            ))}
            {(matrixTab === "visibility" || matrixTab === "sov") && [
              { label: "0%",      cls: "h0"  }, { label: "1-10%",   cls: "h1"  },
              { label: "11-20%",  cls: "h2"  }, { label: "21-30%",  cls: "h3"  },
              { label: "31-40%",  cls: "h4"  }, { label: "41-50%",  cls: "h5"  },
              { label: "51-60%",  cls: "h6"  }, { label: "61-70%",  cls: "h7"  },
              { label: "71-80%",  cls: "h8"  }, { label: "81-90%",  cls: "h9"  },
              { label: "91-100%", cls: "h10" },
            ].map(b => (
              <span key={b.cls} className="ins-heat-legend-item">
                <span className={`ins-heat-dot ins-heat-${b.cls}`} />{b.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Top rankings */}
      <section className="ins-section">
        <div className="ins-section-row">
          <div>
            <h2 className="ins-section-title">Top rankings</h2>
            <p className="ins-section-subtitle">Leading brands by position</p>
          </div>
          {/* Feature 3: Rankings Group-By Dropdown */}
          <div ref={rankingsGroupByRef} style={{ position: "relative" }}>
            <button
              className="pd-filter-chip"
              onClick={() => setRankingsGroupByOpen(v => !v)}
            >
              By {rankingsGroupBy === "models" ? "AI models" : rankingsGroupBy === "topics" ? "Topics" : "Tags"}
              <ChevronDown size={11} />
            </button>
            {rankingsGroupByOpen && (
              <div className="ins-axis-menu" style={{ right: 0, left: "auto" }}>
                {([
                  { value: "models" as RankGroupBy, label: "AI models", icon: "⊙" },
                  { value: "topics" as RankGroupBy, label: "Topics",    icon: "◎" },
                  { value: "tags"   as RankGroupBy, label: "Tags",      icon: "◈" },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    className={`ins-axis-option ${rankingsGroupBy === opt.value ? "ins-axis-option--active" : ""}`}
                    onClick={() => { setRankingsGroupBy(opt.value); setRankingsGroupByOpen(false); }}
                  >
                    <span className="ins-axis-icon">{opt.icon}</span>
                    {opt.label}
                    {rankingsGroupBy === opt.value && <Check size={12} style={{ marginLeft: "auto" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ins-chart-card">
          <div className="ins-chart-header">
            {/* 4 functional ranking tabs */}
            <div className="ins-chart-tabs">
              {([
                { key: "visibility", icon: "👁",  label: "Visibility" },
                { key: "sentiment",  icon: "😊",  label: "Sentiment"  },
                { key: "position",   icon: "↕",   label: "Position"   },
                { key: "sov",        icon: "🥧",  label: "SoV"        },
              ] as { key: typeof rankingsTab; icon: string; label: string }[]).map(tab => (
                <button
                  key={tab.key}
                  className={`ins-chart-tab ${rankingsTab === tab.key ? "ins-chart-tab--active" : ""}`}
                  onClick={() => setRankingsTab(tab.key)}
                >
                  <span>{tab.icon}</span>
                  {rankingsTab === tab.key && <span style={{ marginLeft: 4 }}>{tab.label}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Empty state when no data; table otherwise */}
          {Object.keys(topRankings).length === 0 ? (
            <div className="ins-rankings-empty">
              <div className="ins-rankings-empty-title">No rankings data</div>
              <div className="ins-rankings-empty-sub">
                We couldn&apos;t find any ranking data for the selected filters. Try adjusting the metric or date range.
              </div>
            </div>
          ) : (
          <div className="ins-matrix-wrap ins-rankings-wrap">
            <table className="ins-matrix ins-rankings">
              <thead>
                <tr>
                  <th className="ins-matrix-rowhead ins-rankings-engine-head">
                    <button
                      onClick={() => setRankSortAsc(v => !v)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600, fontSize: "inherit", color: "inherit" }}
                      title={`Sort ${rankSortAsc ? "Z→A" : "A→Z"}`}
                    >
                      {rankingsGroupBy === "models" ? "AI models" :
                       rankingsGroupBy === "topics" ? "Topics" : "Tags"}
                      <span style={{ fontSize: 10, opacity: 0.7 }}>{rankSortAsc ? "↑" : "↓"}</span>
                    </button>
                  </th>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <th key={i} className="ins-rankings-pos-head">#{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Rows = group keys (engines / topics / tags) */}
                {Object.keys(topRankings).sort((a, b) => rankSortAsc ? a.localeCompare(b) : b.localeCompare(a)).map((groupKey) => {
                  const ranks = topRankings[groupKey] || [];
                  return (
                    <tr key={groupKey}>
                      <td className="ins-matrix-rowhead">
                        {rankingsGroupBy === "models" ? (
                          <span className="ins-engine-cell">
                            <EngineIcon engine={groupKey} size={14} /> {groupKey}
                          </span>
                        ) : (
                          <span className="ins-group-label">{groupKey}</span>
                        )}
                      </td>
                      {Array.from({ length: 10 }).map((_, i) => {
                        const item = ranks[i];
                        if (!item) return <td key={i}><div className="ins-rank-empty">—</div></td>;
                        const isYou = item.brand === yourBrand;
                        const metricLabel =
                          rankingsTab === "visibility" ? `${item.visibility.toFixed(1)}%` :
                          rankingsTab === "sentiment"  ? Math.round(item.sentiment).toString() :
                          rankingsTab === "position"   ? `#${item.position.toFixed(1)}` :
                          `${item.sov.toFixed(1)}%`;
                        const showMetric = rankingsTab !== "visibility";
                        return (
                          <td key={i}>
                            <div
                              className={`ins-rank-pill ${isYou ? "ins-rank-pill--you" : ""}`}
                              onMouseEnter={(e) => showRankTooltip(item.brand, groupKey, e)}
                              onMouseLeave={hideRankTooltip}
                            >
                              <span className="ins-rank-brand">{item.brand}</span>
                              {isYou && <span className="ins-rank-you">You</span>}
                              {showMetric && <span className="ins-rank-metric">{metricLabel}</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* empty state handled above the table */}
              </tbody>
            </table>
          </div>
          )} {/* end ternary */}

          <div className="ins-rank-legend">
            <span className="ins-legend-item">
              <span className="ins-legend-dot" style={{ background: "#fef3c7", border: "1px solid #fde68a" }} />
              Other brands
            </span>
            <span className="ins-legend-item">
              <span className="ins-legend-dot" style={{ background: "#fed7aa", border: "1px solid #fdba74" }} />
              Your brand
            </span>
          </div>
        </div>
      </section>

      {/* ── Rankings hover tooltip (portal) ────────────────────────────── */}
      {rankHover && typeof document !== "undefined" && ReactDOM.createPortal(
        (() => {
          // Find entry from topRankings
          const entry = topRankings[rankHover.engine]?.find(r => r.brand === rankHover.brand) ??
                        Object.values(topRankings).flat().find(r => r.brand === rankHover.brand);
          const sentColor = !entry ? "#9ca3af"
            : entry.sentiment >= 65 ? "#16a34a"
            : entry.sentiment >= 50 ? "#d97706"
            : entry.sentiment > 0  ? "#dc2626"
            : "#9ca3af";

          return (
            <div
              className="ins-rank-tooltip"
              style={{ position: "fixed", top: rankHover.pos.top, left: rankHover.pos.left, zIndex: 9999 }}
              onMouseEnter={() => setRankHover(rankHover)}
              onMouseLeave={hideRankTooltip}
            >
              {/* Header: Brand + Engine */}
              <div className="ins-rank-tooltip-head">
                <span className="ins-rank-tooltip-brand">{rankHover.brand}</span>
                <span className="ins-rank-tooltip-engine">{rankHover.engine}</span>
              </div>
              {/* 4 metrics */}
              <div className="ins-rank-tooltip-rows">
                <div className="ins-rank-tooltip-row">
                  <span className="ins-rank-tooltip-label">Visibility</span>
                  <span className="ins-rank-tooltip-val">{entry ? `${entry.visibility.toFixed(1)}%` : "—"}</span>
                </div>
                <div className="ins-rank-tooltip-row">
                  <span className="ins-rank-tooltip-label">Sentiment</span>
                  <span className="ins-rank-tooltip-val" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {entry && entry.sentiment > 0 && (
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sentColor, display: "inline-block", flexShrink: 0 }} />
                    )}
                    {entry && entry.sentiment > 0 ? entry.sentiment.toFixed(1) : "—"}
                  </span>
                </div>
                <div className="ins-rank-tooltip-row">
                  <span className="ins-rank-tooltip-label">Position</span>
                  <span className="ins-rank-tooltip-val">{entry && entry.position > 0 ? `#${entry.position.toFixed(1)}` : "—"}</span>
                </div>
                <div className="ins-rank-tooltip-row">
                  <span className="ins-rank-tooltip-label">SoV</span>
                  <span className="ins-rank-tooltip-val">{entry ? `${entry.sov.toFixed(1)}%` : "—"}</span>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  delta?: { text: string; tone: "up" | "down" | "flat" };
  dot?: boolean;
}

function KpiCard({ label, value, delta, dot }: KpiCardProps) {
  return (
    <div className="ins-kpi">
      <div className="ins-kpi-label">
        {label} <span className="ins-info">ⓘ</span>
      </div>
      <div className="ins-kpi-value">
        {dot && <span className="ins-kpi-dot" />}
        {value}
        {delta && (
          <span className={`ins-kpi-delta ins-kpi-delta--${delta.tone}`}>{delta.text}</span>
        )}
      </div>
    </div>
  );
}
