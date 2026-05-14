"use client";

import React, { useState, useMemo, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Calendar,
  Tag as TagIcon,
  Layers,
  ArrowUpDown,
  Settings as SettingsIcon,
  Share2,
  RefreshCw,
  Archive,
  Building2,
  Check,
  Loader2,
  Play,
} from "lucide-react";
import EngineIcon from "./EngineIcon";
import { DEFAULT_ENGINES } from "../lib/engines";

// ── Types ──────────────────────────────────────────────────────────────────
interface PromptBrand {
  id: string;
  name: string;
  domain: string | null;
  isOwn: boolean;
}

interface PromptTag {
  id: string;
  name: string;
  color: string;
}

interface PromptMetric {
  id: string;
  query: string;
  topicId: string;
  topicName: string | null;
  volumeTier: string;
  createdAt: string;
  visibility: number;
  visibilityTrend: number;
  sentiment: number;
  sentimentTrend: number;
  avgPosition: number;
  positionTrend: number;
  mentions: number;
  mentionsTrend: number;
  rank: number;
  enginesUsed: string[];
  lastRunDate: string | null;
  topBrands: PromptBrand[];
  totalBrandsCount: number;
  tags: PromptTag[];
  sov: number;
  location: string;
}

interface Topic {
  id: string;
  name: string;
  count: number;
}

interface AvailableTag {
  id: string;
  name: string;
  color: string;
}

interface Aggregates {
  visibility: number;
  sentiment: number;
  position: number;
}

interface AvailableBrand {
  id: string;
  name: string;
  isOwn: boolean;
  domain: string | null;
}

interface SetupHints {
  brandsTracked: number;
  ownBrandsTracked: number;
  pendingSuggestions: number;
  pendingSuggestionMentions: number;
  recentChatsTotal: number;
  recentChatsErrored: number;
}

interface Props {
  prompts: PromptMetric[];
  totalCount: number;
  topics: Topic[];
  availableTags: AvailableTag[];
  availableBrands: AvailableBrand[];
  aggregates: Aggregates;
  projectName: string;
  setupHints: SetupHints;
  addPromptAction: (formData: FormData) => Promise<void>;
  addPromptsBulkAction: (args: {
    texts: string[];
    topicId: string | null;
    location: string;
    tagIds: string[];
  }) => Promise<{ ok: boolean; inserted: number; error?: string }>;
  addPromptsFromCsvAction: (args: {
    csvText: string;
  }) => Promise<{ ok: boolean; inserted: number; error?: string }>;
  runNowAction: (
    promptId: string,
    query: string,
    selectedEngines: string[],
  ) => Promise<void>;
  addBrandAction: (name: string) => Promise<{ ok: boolean; error?: string }>;
  createTopicAction: (args: {
    name: string;
    promptsPerTopic: number;
    location: string;
    language: string;
  }) => Promise<{ ok: boolean; topicId?: string; error?: string }>;
  assignTagAction: (args: {
    promptId: string;
    name: string;
    color?: string;
  }) => Promise<{ ok: boolean; tagId?: string; error?: string }>;
  removeTagAction: (args: {
    promptId: string;
    tagId: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  batchAssignTagAction: (args: {
    promptIds: string[];
    tagName: string;
    color?: string;
  }) => Promise<{ ok: boolean; assigned: number; error?: string }>;
  batchAssignTopicAction: (args: {
    promptIds: string[];
    topicId: string;
  }) => Promise<{ ok: boolean; updated: number; error?: string }>;
  batchSetActiveAction: (args: {
    promptIds: string[];
    isActive: boolean;
  }) => Promise<{ ok: boolean; updated: number }>;
  batchDeleteAction: (args: {
    promptIds: string[];
  }) => Promise<{ ok: boolean; deleted: number }>;
}

const TOPIC_LOCATIONS: { code: string; name: string; flag: string }[] = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
];

const TOPIC_LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "nl", name: "Dutch" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "hi", name: "Hindi" },
  { code: "ar", name: "Arabic" },
];

const ALL_ENGINES: readonly string[] = DEFAULT_ENGINES;

type DatePreset = "7" | "14" | "30" | "90" | "180" | "365" | "custom" | "all";

interface DateRange {
  start: Date;
  end: Date;
  preset: DatePreset;
  label: string;
}

const DATE_PRESETS: { key: DatePreset; label: string; days: number; disabled?: boolean }[] = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "14", label: "Last 14 days", days: 14 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "180", label: "Last 180 days", days: 180 },
  { key: "365", label: "Last 365 days", days: 365 },
];

function makeDateRange(preset: DatePreset): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (preset === "all") {
    return {
      start: new Date(2000, 0, 1),
      end,
      preset,
      label: "All time",
    };
  }
  if (preset === "custom") {
    const start = new Date();
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end, preset, label: "Custom" };
  }
  const days = parseInt(preset, 10);
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return { start, end, preset, label: `Last ${days} days` };
}

function fmtDay(d: Date): string {
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`;
}

function daysBetween(start: Date, end: Date): number {
  // Strip times so 00:00 → 23:59 of the same span counts cleanly.
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBetween(d: Date, start: Date, end: Date): boolean {
  const t = startOfDay(d).getTime();
  return t >= startOfDay(start).getTime() && t <= startOfDay(end).getTime();
}

type SortField =
  | "query"
  | "visibility"
  | "sentiment"
  | "avgPosition"
  | "volumeTier"
  | "location"
  | "sov";
type SortDir = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ── Subcomponent: dropdown wrapper ──────────────────────────────────────────
function Dropdown({
  trigger,
  children,
  align = "left",
  width = 220,
}: {
  trigger: (open: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="pp-dd" ref={ref}>
      <button className="pp-dd-trigger" onClick={() => setOpen((v) => !v)}>
        {trigger(open)}
      </button>
      {open && (
        <div
          className="pp-dd-menu"
          style={{ width, [align === "right" ? "right" : "left"]: 0 }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// ── Brand favicon stack for Mentions column ─────────────────────────────────
function BrandFavicon({ brand }: { brand: PromptBrand }) {
  const [failed, setFailed] = useState(false);
  const initial = brand.name.charAt(0).toUpperCase();
  if (!brand.domain || failed) {
    return <span className="pp-mention-fallback">{initial}</span>;
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`https://www.google.com/s2/favicons?sz=64&domain=${brand.domain}`}
      alt={brand.name}
      className="pp-mention-img"
      onError={() => setFailed(true)}
    />
  );
}

// ── Small brand favicon for the brand filter rows ───────────────────────────
function SmallBrandFavicon({
  name,
  domain,
}: {
  name: string;
  domain: string | null;
}) {
  const [failed, setFailed] = useState(false);
  if (!domain || failed) {
    return (
      <span className="pp-brand-fav-fallback">
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
      alt={name}
      className="pp-brand-fav-img"
      onError={() => setFailed(true)}
    />
  );
}

// ── Brand filter dropdown (search + checkboxes + Add brand) ─────────────────
function BrandFilterDropdown({
  projectName,
  brands,
  selectedIds,
  onChange,
  onAddBrand,
}: {
  projectName: string;
  brands: AvailableBrand[];
  selectedIds: string[] | null;
  onChange: (ids: string[] | null) => void;
  onAddBrand: (name: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
        setError(null);
        setQuery("");
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(
    () =>
      brands.filter((b) =>
        b.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [brands, query],
  );

  const allSelected = selectedIds === null;
  const triggerLabel = allSelected
    ? projectName
    : selectedIds.length === 1
    ? brands.find((b) => b.id === selectedIds[0])?.name ?? projectName
    : `${selectedIds.length} brands`;

  const toggleBrand = (id: string) => {
    if (selectedIds === null) {
      // Was "all selected" — keep all except this one OR drop to just this one?
      // peec.ai pattern: unchecking from "all" keeps the rest selected.
      const next = brands.map((b) => b.id).filter((bid) => bid !== id);
      onChange(next.length === brands.length ? null : next);
      return;
    }
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    if (set.size === brands.length) onChange(null);
    else if (set.size === 0) onChange([]);
    else onChange(Array.from(set));
  };

  const handleAdd = async () => {
    setError(null);
    setPending(true);
    const res = await onAddBrand(newName);
    setPending(false);
    if (!res.ok) {
      setError(res.error || "Failed to add brand");
      return;
    }
    setNewName("");
    setAdding(false);
  };

  return (
    <div className="pp-dd" ref={ref}>
      <button
        className="pp-dd-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <Building2 size={13} />
        <span>{triggerLabel}</span>
        <ChevronDown size={12} className={open ? "pp-rotate" : ""} />
      </button>
      {open && (
        <div className="pp-dd-menu pp-brand-menu" style={{ left: 0, width: 280 }}>
          <div className="pp-brand-search">
            <Search size={12} className="pp-brand-search-icon" />
            <input
              autoFocus
              placeholder="Search brands..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            className={`pp-brand-all ${allSelected ? "pp-brand-all-active" : ""}`}
            onClick={() => onChange(null)}
          >
            <span>All brands</span>
            {allSelected && <Check size={14} />}
          </button>
          <div className="pp-brand-list">
            {filtered.length === 0 && (
              <div className="pp-dd-empty">No brands found</div>
            )}
            {filtered.map((b) => {
              const checked =
                selectedIds === null ? true : selectedIds.includes(b.id);
              return (
                <label key={b.id} className="pp-brand-item">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBrand(b.id)}
                  />
                  <SmallBrandFavicon name={b.name} domain={b.domain} />
                  <span className="pp-brand-name">{b.name}</span>
                </label>
              );
            })}
          </div>
          {adding ? (
            <div className="pp-brand-add-form">
              <input
                autoFocus
                placeholder="Brand name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewName("");
                    setError(null);
                  }
                }}
                disabled={pending}
              />
              {error && <div className="pp-brand-error">{error}</div>}
              <div className="pp-brand-add-actions">
                <button
                  type="button"
                  className="pp-brand-add-cancel"
                  onClick={() => {
                    setAdding(false);
                    setNewName("");
                    setError(null);
                  }}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pp-brand-add-submit"
                  onClick={handleAdd}
                  disabled={pending || !newName.trim()}
                >
                  {pending ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="pp-brand-add-btn"
              onClick={() => setAdding(true)}
            >
              <Plus size={13} />
              <span>Add brand</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Volume bars indicator ───────────────────────────────────────────────────
function VolumeBars({ tier }: { tier: string }) {
  const t = tier.toLowerCase();
  let filled = 1;
  if (t.includes("very high")) filled = 4;
  else if (t.includes("high")) filled = 3;
  else if (t.includes("medium")) filled = 2;
  return (
    <span className="pp-volume" title={tier}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`pp-volume-bar ${i < filled ? "pp-volume-bar-on" : ""}`}
          style={{ height: 4 + i * 3 }}
        />
      ))}
    </span>
  );
}

// ── Sentiment dot color ─────────────────────────────────────────────────────
function sentimentDotColor(val: number) {
  if (val >= 60) return "#10b981";
  if (val >= 40) return "#f59e0b";
  return "#ef4444";
}

// ── Trend small label ───────────────────────────────────────────────────────
function TrendLabel({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="pp-trend-flat">—</span>;
  if (value > 0)
    return (
      <span className="pp-trend-up">
        +{value.toFixed(1)}
        {suffix}
      </span>
    );
  return (
    <span className="pp-trend-down">
      {value.toFixed(1)}
      {suffix}
    </span>
  );
}

// ── Component ───────────────────────────────────────────────────────────────
export default function PromptsComparisonClient({
  prompts,
  totalCount,
  topics,
  availableTags,
  availableBrands,
  aggregates,
  projectName,
  setupHints,
  addPromptAction,
  addPromptsBulkAction,
  addPromptsFromCsvAction,
  runNowAction,
  addBrandAction,
  createTopicAction,
  assignTagAction,
  removeTagAction,
  batchAssignTagAction,
  batchAssignTopicAction,
  batchSetActiveAction,
  batchDeleteAction,
}: Props) {
  // null = all brands; otherwise filter to selected brand IDs
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[] | null>(null);
  const [showNewTopic, setShowNewTopic] = useState(false);
  // Or = match prompts with ANY selected tag; And = match ALL selected tags
  const [tagOp, setTagOp] = useState<"or" | "and">("or");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "suggested" | "archived">("active");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | "all" | "none">("all");
  const [selectedTagIds, setSelectedTagIds] = useState<string[] | null>(null); // null = all
  const [selectedModels, setSelectedModels] = useState<string[]>([...ALL_ENGINES]);
  const [dateRange, setDateRange] = useState<DateRange>(() => makeDateRange("7"));
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Bulk-crawl state for the "Crawl Now" button. Progress is "N of M completed"
  // — we fire prompts in small parallel batches so a 100-prompt project doesn't
  // create 100 simultaneous engine calls (which would trip rate limits per
  // peec-clone-handoff/03-ai-engines-and-apis.md).
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [crawlState, setCrawlState] = useState<{
    running: boolean;
    done: number;
    total: number;
  }>({ running: false, done: 0, total: 0 });
  // Set of prompt IDs currently being crawled by the per-row button — lets us
  // show a spinner on the specific row without re-rendering the whole table.
  const [rowCrawling, setRowCrawling] = useState<Set<string>>(new Set());

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...prompts];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.query.toLowerCase().includes(q));
    }

    if (selectedTopicId === "none") {
      result = result.filter((p) => !p.topicName);
    } else if (selectedTopicId !== "all") {
      result = result.filter((p) => p.topicId === selectedTopicId);
    }

    if (selectedTagIds !== null && selectedTagIds.length > 0) {
      const set = new Set(selectedTagIds);
      if (tagOp === "and") {
        result = result.filter((p) => {
          const ids = new Set(p.tags.map((t) => t.id));
          return selectedTagIds.every((id) => ids.has(id));
        });
      } else {
        result = result.filter((p) => p.tags.some((t) => set.has(t.id)));
      }
    }

    // Brand filter — keep prompts that mention at least one selected brand
    if (selectedBrandIds !== null) {
      const set = new Set(selectedBrandIds);
      result = result.filter((p) =>
        p.topBrands.some((b) => set.has(b.id)),
      );
    }

    if (selectedModels.length > 0 && selectedModels.length < ALL_ENGINES.length) {
      const set = new Set(selectedModels);
      result = result.filter((p) =>
        p.enginesUsed.some((e) => set.has(e)) || p.enginesUsed.length === 0,
      );
    }

    if (sortField) {
      result.sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "query":
            cmp = a.query.localeCompare(b.query);
            break;
          case "visibility":
            cmp = a.visibility - b.visibility;
            break;
          case "sentiment":
            cmp = a.sentiment - b.sentiment;
            break;
          case "avgPosition":
            cmp = a.avgPosition - b.avgPosition;
            break;
          case "volumeTier":
            cmp = a.volumeTier.localeCompare(b.volumeTier);
            break;
          case "location":
            cmp = a.location.localeCompare(b.location);
            break;
          case "sov":
            cmp = a.sov - b.sov;
            break;
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [
    prompts,
    search,
    selectedTopicId,
    selectedTagIds,
    tagOp,
    selectedBrandIds,
    selectedModels,
    sortField,
    sortDir,
  ]);

  // ── Tab counts (dynamic) ──────────────────────────────────────────────────
  const activeCount = prompts.length; // all current prompts are "active"
  const suggestedCount = 0;
  const archivedCount = 0;

  const tabFiltered = filtered; // Active tab uses filtered; other tabs are 0 for now

  const noTopicCount = useMemo(
    () => prompts.filter((p) => !p.topicName).length,
    [prompts],
  );

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(tabFiltered.length / pageSize));
  const paginated = tabFiltered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ArrowUpDown size={10} className="pp-sort-icon-idle" />;
    return sortDir === "asc" ? (
      <ChevronUp size={12} />
    ) : (
      <ChevronDown size={12} />
    );
  };

  const toggleModel = (model: string) => {
    setSelectedModels((curr) =>
      curr.includes(model) ? curr.filter((m) => m !== model) : [...curr, model],
    );
  };

  const toggleTagFilter = (id: string) => {
    setSelectedTagIds((curr) => {
      if (curr === null) return [id];
      if (curr.includes(id)) {
        const next = curr.filter((t) => t !== id);
        return next.length === 0 ? null : next;
      }
      return [...curr, id];
    });
  };

  const toggleRow = (id: string) => {
    setSelectedRows((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllRows = () => {
    if (paginated.every((p) => selectedRows.has(p.id)) && paginated.length > 0) {
      const next = new Set(selectedRows);
      paginated.forEach((p) => next.delete(p.id));
      setSelectedRows(next);
    } else {
      const next = new Set(selectedRows);
      paginated.forEach((p) => next.add(p.id));
      setSelectedRows(next);
    }
  };

  const allOnPageSelected =
    paginated.length > 0 && paginated.every((p) => selectedRows.has(p.id));

  // Crawl the currently-filtered prompts across the currently-selected engines.
  // We run in batches of 4 so a 100-prompt project doesn't fire 600 simultaneous
  // engine calls and trip rate limits. After all batches finish we refresh the
  // server component to pull the new chats / metrics into view.
  async function runBulkCrawl() {
    if (crawlState.running) return;
    if (filtered.length === 0) return;
    const engines = selectedModels.length > 0 ? selectedModels : [...ALL_ENGINES];
    const confirmed = window.confirm(
      `Run a fresh crawl for ${filtered.length} prompt${filtered.length === 1 ? "" : "s"} × ${engines.length} engine${engines.length === 1 ? "" : "s"}?\n\nThis hits paid AI APIs.`,
    );
    if (!confirmed) return;

    setCrawlState({ running: true, done: 0, total: filtered.length });

    const BATCH = 4;
    let done = 0;
    for (let i = 0; i < filtered.length; i += BATCH) {
      const batch = filtered.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map((p) => runNowAction(p.id, p.query, engines)),
      );
      done += batch.length;
      setCrawlState({ running: true, done, total: filtered.length });
    }

    setCrawlState({ running: false, done: 0, total: 0 });
    startTransition(() => router.refresh());
  }

  // Crawl one prompt across the currently-selected engines. Used by the
  // per-row Crawl button — keeps the row spinner local while the request flies.
  async function crawlOne(promptId: string, query: string) {
    if (rowCrawling.has(promptId)) return;
    const engines = selectedModels.length > 0 ? selectedModels : [...ALL_ENGINES];
    setRowCrawling((prev) => {
      const next = new Set(prev);
      next.add(promptId);
      return next;
    });
    try {
      await runNowAction(promptId, query, engines);
    } catch (e) {
      console.error("[crawlOne] failed:", e);
    } finally {
      setRowCrawling((prev) => {
        const next = new Set(prev);
        next.delete(promptId);
        return next;
      });
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="pp-page">
      {/* ── Breadcrumb / title ─────────────────────────────────────────── */}
      <div className="pp-breadcrumb">
        <Layers size={14} />
        <span>Prompts</span>
      </div>

      <SetupHintsBanner hints={setupHints} promptCount={prompts.length} />

      {/* ── Filter bar ────────────────────────────────────────────────── */}
      <div className="pp-filter-bar">
        <BrandFilterDropdown
          projectName={projectName}
          brands={availableBrands}
          selectedIds={selectedBrandIds}
          onChange={setSelectedBrandIds}
          onAddBrand={addBrandAction}
        />

        <DateRangePicker value={dateRange} onChange={setDateRange} />

        <Dropdown
          width={260}
          trigger={(open) => (
            <>
              <TagIcon size={13} />
              <span>
                {selectedTagIds === null
                  ? "All Tags"
                  : selectedTagIds.length === 1
                  ? availableTags.find((t) => t.id === selectedTagIds[0])?.name ??
                    "1 Tag"
                  : `${selectedTagIds.length} Tags`}
              </span>
              <ChevronDown size={12} className={open ? "pp-rotate" : ""} />
            </>
          )}
        >
          {() => (
            <div className="pp-dd-section">
              <button
                className={`pp-dd-item ${selectedTagIds === null ? "pp-dd-item-active" : ""}`}
                onClick={() => setSelectedTagIds(null)}
              >
                All Tags
              </button>
              {/* Or / And toggle — peec.ai pattern */}
              <div className="pp-tagop-toggle">
                <button
                  className={`pp-tagop-btn ${tagOp === "or" ? "pp-tagop-btn-active" : ""}`}
                  onClick={() => setTagOp("or")}
                >
                  Or
                </button>
                <button
                  className={`pp-tagop-btn ${tagOp === "and" ? "pp-tagop-btn-active" : ""}`}
                  onClick={() => setTagOp("and")}
                >
                  And
                </button>
              </div>
              {availableTags.length === 0 && (
                <div className="pp-dd-empty">No tags yet</div>
              )}
              {availableTags.map((t) => (
                <label key={t.id} className="pp-dd-check-item">
                  <input
                    type="checkbox"
                    checked={selectedTagIds?.includes(t.id) ?? false}
                    onChange={() => toggleTagFilter(t.id)}
                  />
                  <span
                    className="pp-dd-check-tag"
                    style={{
                      background: `color-mix(in srgb, ${tagColor(t.color)} 18%, white)`,
                      color: tagColor(t.color),
                    }}
                  >
                    {t.name}
                  </span>
                </label>
              ))}
            </div>
          )}
        </Dropdown>

        <Dropdown
          width={240}
          trigger={(open) => (
            <>
              <Layers size={13} />
              <span>
                {selectedModels.length === ALL_ENGINES.length
                  ? "All Models"
                  : `${selectedModels.length} Models`}
              </span>
              <ChevronDown size={12} className={open ? "pp-rotate" : ""} />
            </>
          )}
        >
          {() => (
            <div className="pp-dd-section">
              <div className="pp-dd-heading">Active models</div>
              {ALL_ENGINES.map((m) => (
                <label key={m} className="pp-model-item">
                  <input
                    type="checkbox"
                    checked={selectedModels.includes(m)}
                    onChange={() => toggleModel(m)}
                  />
                  <EngineIcon engine={m} size={18} />
                  <span className="pp-model-name">{m}</span>
                </label>
              ))}
            </div>
          )}
        </Dropdown>
      </div>

      {/* ── Main two-column layout ────────────────────────────────────── */}
      <div className="pp-main">
        {/* Topics panel */}
        <aside className="pp-topics">
          <div className="pp-topics-head">
            <span className="pp-topics-title">Topics</span>
            <button className="pp-icon-btn" title="Collapse">
              <ChevronUp size={14} />
            </button>
          </div>
          <button className="pp-new-topic" onClick={() => setShowNewTopic(true)}>
            <Plus size={13} />
            <span>New topic</span>
          </button>
          <div className="pp-topics-search">
            <Search size={12} className="pp-topics-search-icon" />
            <input placeholder="Search" />
          </div>
          <ul className="pp-topics-list">
            <li>
              <button
                className={`pp-topic-item ${selectedTopicId === "all" ? "pp-topic-item-active" : ""}`}
                onClick={() => setSelectedTopicId("all")}
              >
                <span>All topics</span>
                <span className="pp-topic-count">{totalCount}</span>
              </button>
            </li>
            <li>
              <button
                className={`pp-topic-item ${selectedTopicId === "none" ? "pp-topic-item-active" : ""}`}
                onClick={() => setSelectedTopicId("none")}
              >
                <span>No topic</span>
                <span className="pp-topic-count">{noTopicCount}</span>
              </button>
            </li>
            {topics.map((t) => (
              <li key={t.id}>
                <button
                  className={`pp-topic-item ${selectedTopicId === t.id ? "pp-topic-item-active" : ""}`}
                  onClick={() => setSelectedTopicId(t.id)}
                >
                  <span>{t.name}</span>
                  <span className="pp-topic-count">{t.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Content */}
        <section className="pp-content">
          {/* Tabs row */}
          <div className="pp-tabs-row">
            <div className="pp-tabs">
              <button
                className={`pp-tab ${activeTab === "active" ? "pp-tab-active" : ""}`}
                onClick={() => setActiveTab("active")}
              >
                Active
              </button>
              <button
                className={`pp-tab ${activeTab === "suggested" ? "pp-tab-active" : ""}`}
                onClick={() => setActiveTab("suggested")}
              >
                Suggested
              </button>
              <button
                className={`pp-tab ${activeTab === "archived" ? "pp-tab-active" : ""}`}
                onClick={() => setActiveTab("archived")}
              >
                Archived
              </button>
            </div>
            <div className="pp-tabs-actions">
              <span className="pp-counter">
                <span className="pp-counter-dot" />
                {activeCount} / {totalCount}
              </span>
              <button
                className="pp-add-btn"
                onClick={runBulkCrawl}
                disabled={crawlState.running || filtered.length === 0}
                title={
                  filtered.length === 0
                    ? "No prompts match the current filter"
                    : `Crawl ${filtered.length} prompt(s) across ${selectedModels.length || ALL_ENGINES.length} engine(s)`
                }
                style={{
                  background: crawlState.running ? "#94a3b8" : "#10b981",
                  color: "white",
                  marginRight: 8,
                }}
              >
                {crawlState.running ? (
                  <>
                    <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                    Crawling {crawlState.done}/{crawlState.total}
                  </>
                ) : (
                  <>
                    <Play size={13} />
                    Crawl Now
                  </>
                )}
              </button>
              <button className="pp-add-btn" onClick={() => setShowAddForm(true)}>
                <Plus size={13} />
                Add Prompt
              </button>
            </div>
          </div>

          {/* Aggregate metrics + utility icons */}
          <div className="pp-summary-row">
            <div className="pp-search-wrap">
              <Search size={13} className="pp-search-icon" />
              <input
                className="pp-search-input"
                placeholder="Search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="pp-summary-stats">
              <span className="pp-summary-stat">
                <span className="pp-summary-label">Visibility</span>
                <strong>{aggregates.visibility}%</strong>
              </span>
              <span className="pp-summary-sep">|</span>
              <span className="pp-summary-stat">
                <span className="pp-summary-label">Sentiment</span>
                <span
                  className="pp-dot"
                  style={{ background: sentimentDotColor(aggregates.sentiment) }}
                />
                <strong>{aggregates.sentiment}</strong>
              </span>
              <span className="pp-summary-sep">|</span>
              <span className="pp-summary-stat">
                <span className="pp-summary-label">Position</span>
                <strong>#&nbsp;{aggregates.position || "—"}</strong>
              </span>
              <div className="pp-summary-icons">
                <button className="pp-icon-btn" title="Refresh">
                  <RefreshCw size={14} />
                </button>
                <button className="pp-icon-btn" title="Share">
                  <Share2 size={14} />
                </button>
                <button className="pp-icon-btn" title="Settings">
                  <SettingsIcon size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Batch-actions toolbar — visible when at least one row is selected */}
          {selectedRows.size > 0 && (
            <BatchActionsBar
              selectedCount={selectedRows.size}
              selectedIds={[...selectedRows]}
              availableTags={availableTags}
              topics={topics}
              activeTab={activeTab}
              onClear={() => setSelectedRows(new Set())}
              assignTagAction={batchAssignTagAction}
              assignTopicAction={batchAssignTopicAction}
              setActiveAction={batchSetActiveAction}
              deleteAction={batchDeleteAction}
              onAfterAction={() => {
                setSelectedRows(new Set());
                startTransition(() => router.refresh());
              }}
            />
          )}

          {/* Table */}
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th className="pp-th-checkbox">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAllRows}
                    />
                  </th>
                  <th
                    className="pp-th-sortable"
                    onClick={() => handleSort("query")}
                  >
                    Prompt {renderSortIcon("query")}
                  </th>
                  <th
                    className="pp-th-sortable"
                    onClick={() => handleSort("visibility")}
                  >
                    Visibility {renderSortIcon("visibility")}
                  </th>
                  <th
                    className="pp-th-sortable"
                    onClick={() => handleSort("sentiment")}
                  >
                    Sentiment {renderSortIcon("sentiment")}
                  </th>
                  <th
                    className="pp-th-sortable"
                    onClick={() => handleSort("avgPosition")}
                  >
                    Position {renderSortIcon("avgPosition")}
                  </th>
                  <th>Mentions</th>
                  <th
                    className="pp-th-sortable"
                    onClick={() => handleSort("volumeTier")}
                  >
                    Volume <span className="pp-beta-pill">Beta</span>{" "}
                    {renderSortIcon("volumeTier")}
                  </th>
                  <th>Tags</th>
                  <th
                    className="pp-th-sortable"
                    onClick={() => handleSort("location")}
                  >
                    Location {renderSortIcon("location")}
                  </th>
                  <th
                    className="pp-th-sortable"
                    onClick={() => handleSort("sov")}
                  >
                    SOV {renderSortIcon("sov")}
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeTab !== "active" || paginated.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="pp-empty-cell">
                      <div className="pp-empty">
                        <div className="pp-empty-icon">
                          <Layers size={28} />
                        </div>
                        <div className="pp-empty-title">
                          {activeTab === "suggested"
                            ? "No suggested prompts"
                            : activeTab === "archived"
                            ? "No archived prompts"
                            : "No prompts found"}
                        </div>
                        <div className="pp-empty-sub">
                          {activeTab === "active"
                            ? "Adjust filters or add a new prompt to get started."
                            : "Prompts will appear here once available."}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((p) => (
                    <tr key={p.id}>
                      <td className="pp-td-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(p.id)}
                          onChange={() => toggleRow(p.id)}
                        />
                      </td>
                      <td className="pp-td-prompt">
                        <a href={`/prompts/${p.id}`} className="pp-prompt-link">
                          {p.query}
                        </a>
                      </td>
                      <td>
                        <div className="pp-cell-stack">
                          <span className="pp-metric-val">{p.visibility}%</span>
                          <TrendLabel value={p.visibilityTrend} suffix="%" />
                        </div>
                      </td>
                      <td>
                        {p.sentiment > 0 ? (
                          <div className="pp-cell-stack pp-cell-row">
                            <span className="pp-cell-inline">
                              <span
                                className="pp-dot"
                                style={{
                                  background: sentimentDotColor(p.sentiment),
                                }}
                              />
                              <span className="pp-metric-val">
                                {p.sentiment.toFixed(0)}
                              </span>
                            </span>
                            <TrendLabel value={p.sentimentTrend} />
                          </div>
                        ) : (
                          <span className="pp-empty-val">—</span>
                        )}
                      </td>
                      <td>
                        {p.avgPosition > 0 ? (
                          <div className="pp-cell-stack">
                            <span className="pp-metric-val">
                              #&nbsp;{p.avgPosition.toFixed(1)}
                            </span>
                            <TrendLabel value={p.positionTrend} />
                          </div>
                        ) : (
                          <span className="pp-empty-val">—</span>
                        )}
                      </td>
                      <td>
                        {p.topBrands.length > 0 ? (
                          <div className="pp-mentions-stack">
                            {p.topBrands.slice(0, 3).map((b) => (
                              <span key={b.id} className="pp-mention-chip">
                                <BrandFavicon brand={b} />
                              </span>
                            ))}
                            {p.totalBrandsCount > 3 && (
                              <span className="pp-mention-plus">
                                +{p.totalBrandsCount - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="pp-empty-val">—</span>
                        )}
                      </td>
                      <td>
                        <VolumeBars tier={p.volumeTier} />
                      </td>
                      <td>
                        <PromptTagsCell
                          promptId={p.id}
                          promptTags={p.tags}
                          availableTags={availableTags}
                          onTagClick={(tagId) => {
                            setSelectedTagIds([tagId]);
                            setTagOp("or");
                            setCurrentPage(1);
                          }}
                          assignTagAction={assignTagAction}
                          removeTagAction={removeTagAction}
                        />
                      </td>
                      <td>
                        <span className="pp-location">
                          <span className="pp-flag">🇺🇸</span>
                          {p.location}
                        </span>
                      </td>
                      <td>
                        <span className="pp-metric-val">{p.sov}%</span>
                      </td>
                      <td>
                        <button
                          className="pp-row-crawl-btn"
                          disabled={rowCrawling.has(p.id) || crawlState.running}
                          onClick={() => crawlOne(p.id, p.query)}
                          title={`Run this prompt across ${(selectedModels.length || ALL_ENGINES.length)} engine(s)`}
                        >
                          {rowCrawling.has(p.id) ? (
                            <Loader2
                              size={13}
                              style={{ animation: "spin 1s linear infinite" }}
                            />
                          ) : (
                            <Play size={13} />
                          )}
                          <span>{rowCrawling.has(p.id) ? "Crawling…" : "Crawl"}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination row */}
          <div className="pp-pagination">
            <div className="pp-pagination-left">
              <Dropdown
                width={120}
                trigger={(open) => (
                  <>
                    <span>{pageSize} Prompts</span>
                    <ChevronDown size={12} className={open ? "pp-rotate" : ""} />
                  </>
                )}
              >
                {(close) => (
                  <div className="pp-dd-section">
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <button
                        key={n}
                        className={`pp-dd-item ${pageSize === n ? "pp-dd-item-active" : ""}`}
                        onClick={() => {
                          setPageSize(n);
                          setCurrentPage(1);
                          close();
                        }}
                      >
                        {n} Prompts
                      </button>
                    ))}
                  </div>
                )}
              </Dropdown>
            </div>

            <div className="pp-pagination-pages">
              <button
                className="pp-page-arrow"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              >
                <ChevronLeft size={14} />
              </button>
              {pageRange(currentPage, totalPages).map((n, i) =>
                n === "…" ? (
                  <span key={`dots-${i}`} className="pp-page-dots">…</span>
                ) : (
                  <button
                    key={n}
                    className={`pp-page-num ${currentPage === n ? "pp-page-num-active" : ""}`}
                    onClick={() => setCurrentPage(n as number)}
                  >
                    {n}
                  </button>
                ),
              )}
              <button
                className="pp-page-arrow"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <button className="pp-archive-all">
              <Archive size={13} />
              Archive all
            </button>
          </div>
        </section>
      </div>

      {/* New Topic Modal */}
      {showNewTopic && (
        <NewTopicModal
          onClose={() => setShowNewTopic(false)}
          onSubmit={createTopicAction}
        />
      )}

      {/* Add Prompt Modal (Manual + Bulk Upload) */}
      {showAddForm && (
        <AddPromptModal
          topics={topics}
          availableTags={availableTags}
          locations={TOPIC_LOCATIONS}
          onClose={() => setShowAddForm(false)}
          addBulkAction={addPromptsBulkAction}
          fromCsvAction={addPromptsFromCsvAction}
          onDone={() => {
            setShowAddForm(false);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}

// ── Inline tag-assignment popover on a prompt row ───────────────────────────
function PromptTagsCell({
  promptId,
  promptTags,
  availableTags,
  onTagClick,
  assignTagAction,
  removeTagAction,
}: {
  promptId: string;
  promptTags: PromptTag[];
  availableTags: AvailableTag[];
  onTagClick: (tagId: string) => void;
  assignTagAction: (args: {
    promptId: string;
    name: string;
    color?: string;
  }) => Promise<{ ok: boolean; tagId?: string; error?: string }>;
  removeTagAction: (args: {
    promptId: string;
    tagId: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  // Local optimistic state — keep the cell snappy without re-querying the page.
  const [localTags, setLocalTags] = useState<PromptTag[]>(promptTags);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalTags(promptTags);
  }, [promptTags]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const assignedIds = useMemo(
    () => new Set(localTags.map((t) => t.id)),
    [localTags],
  );

  const matches = useMemo(
    () =>
      availableTags.filter((t) =>
        t.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [availableTags, query],
  );

  const exactMatch = availableTags.find(
    (t) => t.name.toLowerCase() === query.trim().toLowerCase(),
  );
  const canCreate = query.trim().length > 0 && !exactMatch;

  const handleAdd = async (name: string) => {
    if (pending) return;
    setPending(true);
    const res = await assignTagAction({ promptId, name });
    setPending(false);
    if (!res.ok || !res.tagId) return;
    // Optimistic add to local state.
    const found = availableTags.find((t) => t.id === res.tagId);
    setLocalTags((curr) =>
      curr.some((t) => t.id === res.tagId)
        ? curr
        : [
            ...curr,
            {
              id: res.tagId!,
              name: found?.name ?? name,
              color: found?.color ?? "gray",
            },
          ],
    );
    setQuery("");
  };

  const handleRemove = async (tagId: string) => {
    if (pending) return;
    setPending(true);
    const res = await removeTagAction({ promptId, tagId });
    setPending(false);
    if (!res.ok) return;
    setLocalTags((curr) => curr.filter((t) => t.id !== tagId));
  };

  return (
    <div className="pp-tag-cell-wrap" ref={ref}>
      {localTags.length > 0 ? (
        <div className="pp-tags-cell">
          {localTags.map((t) => (
            <button
              key={t.id}
              type="button"
              className="pp-tag-pill pp-tag-pill-btn"
              style={{
                background: `color-mix(in srgb, ${tagColor(t.color)} 18%, white)`,
                color: tagColor(t.color),
              }}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick(t.id);
              }}
              title="Filter by this tag"
            >
              {t.name}
            </button>
          ))}
          <button
            type="button"
            className="pp-add-tags pp-add-tags-small"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            title="Add another tag"
          >
            <Plus size={11} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="pp-add-tags"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          <Plus size={11} />
          Add tags
        </button>
      )}

      {open && (
        <div className="pp-tag-popover">
          <div className="pp-tag-popover-search">
            <Search size={12} />
            <input
              autoFocus
              placeholder="Search or create…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) handleAdd(query.trim());
                if (e.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                }
              }}
            />
          </div>
          <div className="pp-tag-popover-list">
            {matches.map((t) => {
              const assigned = assignedIds.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className="pp-tag-popover-row"
                  onClick={() =>
                    assigned ? handleRemove(t.id) : handleAdd(t.name)
                  }
                  disabled={pending}
                >
                  <span
                    className="pp-tag-pill"
                    style={{
                      background: `color-mix(in srgb, ${tagColor(t.color)} 18%, white)`,
                      color: tagColor(t.color),
                    }}
                  >
                    {t.name}
                  </span>
                  {assigned && <Check size={13} className="pp-tag-popover-check" />}
                </button>
              );
            })}
            {matches.length === 0 && !canCreate && (
              <div className="pp-dd-empty">No tags yet</div>
            )}
            {canCreate && (
              <button
                type="button"
                className="pp-tag-popover-create"
                onClick={() => handleAdd(query.trim())}
                disabled={pending}
              >
                <Plus size={12} />
                Create <strong>{query.trim()}</strong>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Date range picker (presets + calendar) ──────────────────────────────────
function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(value.end));
  const [pickStart, setPickStart] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPickStart(null);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const applyPreset = (key: DatePreset) => {
    onChange(makeDateRange(key));
    setPickStart(null);
    // Stay open — user can preview different ranges; closes on outside click.
  };

  const handleDayClick = (d: Date) => {
    if (!pickStart) {
      setPickStart(d);
      return;
    }
    const a = pickStart;
    const b = d;
    const start = a.getTime() <= b.getTime() ? new Date(a) : new Date(b);
    const end = a.getTime() <= b.getTime() ? new Date(b) : new Date(a);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    onChange({ start, end, preset: "custom", label: "Custom" });
    setPickStart(null);
    // Stay open — only outside click closes.
  };

  const grid = useMemo(() => {
    const first = startOfMonth(calMonth);
    const lastDay = new Date(
      calMonth.getFullYear(),
      calMonth.getMonth() + 1,
      0,
    ).getDate();
    // Monday-first offset
    const offset = (first.getDay() + 6) % 7;
    const cells: { date: Date; current: boolean }[] = [];
    for (let i = offset; i > 0; i--) {
      const d = new Date(first);
      d.setDate(d.getDate() - i);
      cells.push({ date: d, current: false });
    }
    for (let i = 1; i <= lastDay; i++) {
      cells.push({
        date: new Date(calMonth.getFullYear(), calMonth.getMonth(), i),
        current: true,
      });
    }
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      cells.push({ date: d, current: false });
    }
    return cells;
  }, [calMonth]);

  const today = startOfDay(new Date());

  return (
    <div className="pp-dd" ref={ref}>
      <button className="pp-dd-trigger" onClick={() => setOpen((v) => !v)}>
        <Calendar size={13} />
        <span>{value.label}</span>
        <ChevronDown size={12} className={open ? "pp-rotate" : ""} />
      </button>
      {open && (
        <div className="pp-date-panel">
          <div className="pp-date-presets">
            <div className="pp-date-presets-head">Select range</div>
            {DATE_PRESETS.map((p) => {
              const disabled = p.disabled;
              const active = value.preset === p.key;
              return (
                <button
                  key={p.key}
                  className={`pp-date-preset ${active ? "pp-date-preset-active" : ""} ${
                    disabled ? "pp-date-preset-disabled" : ""
                  }`}
                  onClick={() => !disabled && applyPreset(p.key)}
                  disabled={disabled}
                >
                  <span>{p.label}</span>
                  {active && <Check size={13} />}
                </button>
              );
            })}
            <div className="pp-date-divider" />
            <button
              className={`pp-date-preset ${value.preset === "custom" ? "pp-date-preset-active" : ""}`}
              onClick={() => setPickStart(null)}
            >
              <span>Custom</span>
              {value.preset === "custom" && <Check size={13} />}
            </button>
            <button
              className={`pp-date-preset ${value.preset === "all" ? "pp-date-preset-active" : ""}`}
              onClick={() => applyPreset("all")}
            >
              <span>All time</span>
              {value.preset === "all" && <Check size={13} />}
            </button>
            <div className="pp-date-divider" />
            <button
              className="pp-date-preset"
              onClick={() => applyPreset("7")}
            >
              <span>Reset</span>
            </button>
          </div>

          <div className="pp-date-calendar">
            <div className="pp-date-month-nav">
              <button
                className="pp-icon-btn"
                onClick={() => {
                  const m = new Date(calMonth);
                  m.setMonth(m.getMonth() - 1);
                  setCalMonth(m);
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="pp-date-month-label">
                {calMonth.toLocaleString("en", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                className="pp-icon-btn"
                onClick={() => {
                  const m = new Date(calMonth);
                  m.setMonth(m.getMonth() + 1);
                  setCalMonth(m);
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="pp-date-weekdays">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="pp-date-grid">
              {grid.map((cell, i) => {
                const isFuture = startOfDay(cell.date).getTime() > today.getTime();
                const inRange =
                  !isFuture && isBetween(cell.date, value.start, value.end);
                const isStart = isSameDay(cell.date, value.start);
                const isEnd = isSameDay(cell.date, value.end);
                const isPick = pickStart && isSameDay(cell.date, pickStart);
                const classes = [
                  "pp-date-day",
                  !cell.current ? "pp-date-day-muted" : "",
                  isFuture ? "pp-date-day-disabled" : "",
                  inRange ? "pp-date-day-in-range" : "",
                  isStart ? "pp-date-day-start" : "",
                  isEnd ? "pp-date-day-end" : "",
                  isPick ? "pp-date-day-pick" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    key={i}
                    className={classes}
                    onClick={() => !isFuture && handleDayClick(cell.date)}
                    disabled={isFuture}
                  >
                    {cell.date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pp-date-footer">
            <span>
              {fmtDay(value.start)} – {fmtDay(value.end)}
            </span>
            <span className="pp-date-days-badge">
              {daysBetween(value.start, value.end)} days
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── New Topic Modal ─────────────────────────────────────────────────────────
function NewTopicModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (args: {
    name: string;
    promptsPerTopic: number;
    location: string;
    language: string;
  }) => Promise<{ ok: boolean; topicId?: string; error?: string }>;
}) {
  const [name, setName] = useState("");
  const [count, setCount] = useState(10);
  const [location, setLocation] = useState("US");
  const [language, setLanguage] = useState("en");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const locRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locRef.current && !locRef.current.contains(e.target as Node))
        setLocationOpen(false);
      if (langRef.current && !langRef.current.contains(e.target as Node))
        setLanguageOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  const selectedLocation = TOPIC_LOCATIONS.find((l) => l.code === location);
  const selectedLanguage = TOPIC_LANGUAGES.find((l) => l.code === language);

  const handleAdd = async () => {
    setError(null);
    setPending(true);
    const res = await onSubmit({
      name,
      promptsPerTopic: count,
      location,
      language,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error || "Failed to create topic");
      return;
    }
    onClose();
  };

  return (
    <div
      className="pp-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pp-modal-card pp-topic-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pp-topic-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="pp-topic-modal-title">Add new Topic</div>
        <div className="pp-topic-modal-sub">
          Create a Topic without mentioning your own brand. Every topic will have prompts
        </div>

        <div className="pp-topic-field">
          <label className="pp-topic-label">Topic</label>
          <input
            autoFocus
            className="pp-topic-input"
            placeholder="e.g. SEO optimization"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="pp-topic-field">
          <label className="pp-topic-label">Prompts per topic</label>
          <input
            type="number"
            min={1}
            max={50}
            className="pp-topic-input"
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            disabled={pending}
          />
        </div>

        <div className="pp-topic-field">
          <label className="pp-topic-label">Location</label>
          <div className="pp-topic-select" ref={locRef}>
            <button
              type="button"
              className="pp-topic-select-trigger"
              onClick={() => setLocationOpen((v) => !v)}
              disabled={pending}
            >
              <span className="pp-topic-select-value">
                <span className="pp-flag">{selectedLocation?.flag}</span>
                {selectedLocation?.name}
              </span>
              <ChevronDown
                size={14}
                className={locationOpen ? "pp-rotate" : ""}
              />
            </button>
            {locationOpen && (
              <div className="pp-topic-select-menu">
                {TOPIC_LOCATIONS.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    className={`pp-topic-select-option ${
                      location === l.code ? "pp-topic-select-option-active" : ""
                    }`}
                    onClick={() => {
                      setLocation(l.code);
                      setLocationOpen(false);
                    }}
                  >
                    <span className="pp-flag">{l.flag}</span>
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pp-topic-field">
          <label className="pp-topic-label">Language</label>
          <div className="pp-topic-select" ref={langRef}>
            <button
              type="button"
              className="pp-topic-select-trigger"
              onClick={() => setLanguageOpen((v) => !v)}
              disabled={pending}
            >
              <span className="pp-topic-select-value">
                <span className="pp-topic-lang-icon">文A</span>
                {selectedLanguage?.name}
              </span>
              <ChevronDown
                size={14}
                className={languageOpen ? "pp-rotate" : ""}
              />
            </button>
            {languageOpen && (
              <div className="pp-topic-select-menu">
                {TOPIC_LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    className={`pp-topic-select-option ${
                      language === l.code ? "pp-topic-select-option-active" : ""
                    }`}
                    onClick={() => {
                      setLanguage(l.code);
                      setLanguageOpen(false);
                    }}
                  >
                    <span className="pp-topic-lang-icon">文A</span>
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <div className="pp-topic-error">{error}</div>}

        <div className="pp-topic-modal-actions">
          <button
            type="button"
            className="pp-topic-modal-add"
            onClick={handleAdd}
            disabled={pending || !name.trim()}
          >
            <Plus size={14} />
            {pending ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function pageRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push("…", total);
  } else if (current >= total - 3) {
    pages.push(1, "…");
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1, "…");
    for (let i = current - 1; i <= current + 1; i++) pages.push(i);
    pages.push("…", total);
  }
  return pages;
}

const TAG_COLOR_MAP: Record<string, string> = {
  gray: "#6b7280",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  green: "#10b981",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  purple: "#a855f7",
  pink: "#ec4899",
};

function tagColor(name: string): string {
  return TAG_COLOR_MAP[name?.toLowerCase()] ?? "#6b7280";
}

// ── Setup hints banner ────────────────────────────────────────────────────
// Surfaces the most common reasons the metrics columns stay at 0% even after
// a successful crawl: no tracked brands, pending suggestions, or engine
// failures. Each hint is independently dismissible to noise.
function SetupHintsBanner({
  hints,
  promptCount,
}: {
  hints: SetupHints;
  promptCount: number;
}) {
  const showNoBrands =
    promptCount > 0 && hints.recentChatsTotal > 0 && hints.brandsTracked === 0;
  const showSuggestions =
    hints.brandsTracked === 0 && hints.pendingSuggestions > 0;
  const errorRate =
    hints.recentChatsTotal > 0
      ? hints.recentChatsErrored / hints.recentChatsTotal
      : 0;
  const showHighErrorRate = errorRate >= 0.5 && hints.recentChatsTotal >= 2;

  if (!showNoBrands && !showSuggestions && !showHighErrorRate) return null;

  return (
    <div className="pp-hints">
      {showNoBrands && (
        <div className="pp-hint pp-hint-warn">
          <strong>No tracked brands.</strong> Your prompts have been crawled
          ({hints.recentChatsTotal} chat{hints.recentChatsTotal === 1 ? "" : "s"} in the last 7 days),
          but Visibility / Sentiment / Position / SOV only populate when an extracted
          brand matches one in your <a href="/brands">Brands</a> list.{" "}
          {hints.pendingSuggestions > 0 ? (
            <>
              The LLM extracted{" "}
              <a href="/brands"><strong>{hints.pendingSuggestions} brand suggestion{hints.pendingSuggestions === 1 ? "" : "s"}</strong></a>
              {" "}— review and accept them to start tracking.
            </>
          ) : (
            <>Add your own brand + competitors at <a href="/brands">Brands</a>.</>
          )}
        </div>
      )}

      {!showNoBrands && showSuggestions && (
        <div className="pp-hint pp-hint-info">
          <strong>{hints.pendingSuggestions} pending brand suggestion{hints.pendingSuggestions === 1 ? "" : "s"}</strong>
          {" "}from recent crawls. <a href="/brands">Review them</a> to expand tracking.
        </div>
      )}

      {showHighErrorRate && (
        <div className="pp-hint pp-hint-error">
          <strong>{hints.recentChatsErrored} of {hints.recentChatsTotal} recent chats failed</strong>
          {" "}({Math.round(errorRate * 100)}%). Most common causes: missing or rate-limited API keys.
          Open a chat with <code>[ERROR:…]</code> in the response to see the exact reason, or check
          your <code>.env.local</code> for placeholder values like <code>...</code>.
        </div>
      )}
    </div>
  );
}

// ── Add Prompt Modal ──────────────────────────────────────────────────────
// Two tabs: "Manual" (paste one prompt per line, set location/topic/tags) and
// "Bulk Upload" (drop a CSV). Per Peec docs the manual form supports both
// single-line and multi-line input — we use a textarea so both work.
function AddPromptModal({
  topics,
  availableTags,
  locations,
  onClose,
  addBulkAction,
  fromCsvAction,
  onDone,
}: {
  topics: Topic[];
  availableTags: AvailableTag[];
  locations: { code: string; name: string; flag: string }[];
  onClose: () => void;
  addBulkAction: (args: {
    texts: string[];
    topicId: string | null;
    location: string;
    tagIds: string[];
  }) => Promise<{ ok: boolean; inserted: number; error?: string }>;
  fromCsvAction: (args: {
    csvText: string;
  }) => Promise<{ ok: boolean; inserted: number; error?: string }>;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<"manual" | "csv">("manual");
  const [text, setText] = useState("");
  const [topicId, setTopicId] = useState<string>("");
  const [location, setLocation] = useState("US");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(
    () => text.split("\n").map((s) => s.trim()).filter((s) => s.length > 0),
    [text],
  );
  const overLimit = lines.filter((l) => l.length > 200);

  async function handleCsvFile(f: File) {
    setCsvFile(f);
    setError(null);
    const txt = await f.text();
    const rows = txt
      .split(/\r?\n/)
      .map((r) => r.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, "")))
      .filter((r) => r.some((c) => c.length > 0));
    setCsvPreview(rows.slice(0, 6));
  }

  async function submitManual() {
    if (lines.length === 0) {
      setError("Enter at least one prompt");
      return;
    }
    if (overLimit.length > 0) {
      setError(`${overLimit.length} prompt(s) exceed the 200-character limit`);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await addBulkAction({
      texts: lines,
      topicId: topicId || null,
      location,
      tagIds,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Failed to add prompts");
      return;
    }
    onDone();
  }

  async function submitCsv() {
    if (!csvFile) {
      setError("Choose a CSV file");
      return;
    }
    setBusy(true);
    setError(null);
    const csvText = await csvFile.text();
    const result = await fromCsvAction({ csvText });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Failed to import CSV");
      return;
    }
    onDone();
  }

  return (
    <div
      className="pp-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pp-modal-card pp-modal-wide">
        <div className="pp-modal-title">Add prompts</div>

        <div className="pp-modal-tabs">
          <button
            className={`pp-modal-tab ${tab === "manual" ? "pp-modal-tab-active" : ""}`}
            onClick={() => setTab("manual")}
            type="button"
          >
            Manual
          </button>
          <button
            className={`pp-modal-tab ${tab === "csv" ? "pp-modal-tab-active" : ""}`}
            onClick={() => setTab("csv")}
            type="button"
          >
            Bulk Upload
          </button>
        </div>

        {tab === "manual" ? (
          <>
            <label className="pp-modal-label">
              Prompts (one per line, max 200 chars each)
            </label>
            <textarea
              className="pp-modal-textarea"
              rows={6}
              placeholder={"Best CRM for SaaS startups\nWhat AI writing tools should I use?\nCompare top project management apps"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <div className="pp-modal-hint">
              {lines.length} prompt{lines.length === 1 ? "" : "s"} ready
              {overLimit.length > 0 && (
                <span style={{ color: "#dc2626" }}>
                  {" "}— {overLimit.length} over 200 chars
                </span>
              )}
            </div>

            <div className="pp-modal-grid">
              <div>
                <label className="pp-modal-label">Location (IP Address)</label>
                <select
                  className="pp-modal-select"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  {locations.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="pp-modal-label">Topic</label>
                <select
                  className="pp-modal-select"
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                >
                  <option value="">General Topic (default)</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="pp-modal-label">Tags (optional)</label>
            <div className="pp-modal-tags">
              {availableTags.length === 0 ? (
                <span className="pp-modal-empty">
                  No tags yet — create them on the Tags page
                </span>
              ) : (
                availableTags.map((t) => {
                  const on = tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setTagIds(
                          on
                            ? tagIds.filter((id) => id !== t.id)
                            : [...tagIds, t.id],
                        )
                      }
                      className={`pp-modal-tag-chip ${on ? "pp-modal-tag-chip-on" : ""}`}
                    >
                      {on && <Check size={11} />} {t.name}
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            <label className="pp-modal-label">CSV file</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCsvFile(f);
              }}
            />
            <div className="pp-modal-hint">
              Format: header row + one prompt per row. Columns: prompt, location (ISO-2), topic, tag, tag, …
            </div>
            {csvPreview && csvPreview.length > 0 && (
              <div className="pp-csv-preview">
                <div className="pp-modal-hint">Preview (first {csvPreview.length} rows):</div>
                <table className="pp-csv-preview-table">
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr key={i} className={i === 0 ? "pp-csv-header-row" : ""}>
                        {row.map((cell, j) => (
                          <td key={j}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {error && <div className="pp-modal-error">{error}</div>}

        <div className="pp-modal-actions">
          <button
            type="button"
            className="pp-modal-cancel"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pp-modal-submit"
            disabled={busy}
            onClick={tab === "manual" ? submitManual : submitCsv}
          >
            {busy ? (
              <>
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                {" "}Adding…
              </>
            ) : tab === "manual" ? (
              `Add ${lines.length || ""} prompt${lines.length === 1 ? "" : "s"}`.trim()
            ) : (
              "Import CSV"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Batch-actions toolbar ──────────────────────────────────────────────────
// Renders above the prompts table when at least one row is checked. Per Peec
// docs, available actions depend on the current tab (Active vs Archived).
function BatchActionsBar({
  selectedCount,
  selectedIds,
  availableTags,
  topics,
  activeTab,
  onClear,
  assignTagAction,
  assignTopicAction,
  setActiveAction,
  deleteAction,
  onAfterAction,
}: {
  selectedCount: number;
  selectedIds: string[];
  availableTags: AvailableTag[];
  topics: Topic[];
  activeTab: "active" | "suggested" | "archived";
  onClear: () => void;
  assignTagAction: (args: {
    promptIds: string[];
    tagName: string;
    color?: string;
  }) => Promise<{ ok: boolean; assigned: number; error?: string }>;
  assignTopicAction: (args: {
    promptIds: string[];
    topicId: string;
  }) => Promise<{ ok: boolean; updated: number; error?: string }>;
  setActiveAction: (args: {
    promptIds: string[];
    isActive: boolean;
  }) => Promise<{ ok: boolean; updated: number }>;
  deleteAction: (args: {
    promptIds: string[];
  }) => Promise<{ ok: boolean; deleted: number }>;
  onAfterAction: () => void;
}) {
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function pickTag(name: string) {
    if (!name.trim()) return;
    setBusy(true);
    await assignTagAction({ promptIds: selectedIds, tagName: name.trim() });
    setBusy(false);
    setShowTagPicker(false);
    setTagInput("");
    onAfterAction();
  }

  async function pickTopic(topicId: string) {
    setBusy(true);
    await assignTopicAction({ promptIds: selectedIds, topicId });
    setBusy(false);
    setShowTopicPicker(false);
    onAfterAction();
  }

  async function toggleActive(isActive: boolean) {
    setBusy(true);
    await setActiveAction({ promptIds: selectedIds, isActive });
    setBusy(false);
    onAfterAction();
  }

  async function deleteSelected() {
    if (
      !window.confirm(
        `Delete ${selectedCount} prompt${selectedCount === 1 ? "" : "s"} and all associated chats / mentions? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    await deleteAction({ promptIds: selectedIds });
    setBusy(false);
    onAfterAction();
  }

  return (
    <div className="pp-batch-bar">
      <span className="pp-batch-count">
        {selectedCount} selected
      </span>

      <div className="pp-batch-actions">
        <div className="pp-batch-action-wrap">
          <button
            className="pp-batch-btn"
            disabled={busy}
            onClick={() => setShowTagPicker((v) => !v)}
          >
            <TagIcon size={13} /> Assign tag
          </button>
          {showTagPicker && (
            <div className="pp-batch-popover">
              <input
                className="pp-batch-input"
                placeholder="New tag or existing"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") pickTag(tagInput);
                }}
                autoFocus
              />
              <div className="pp-batch-popover-list">
                {availableTags.map((t) => (
                  <button
                    key={t.id}
                    className="pp-batch-popover-item"
                    onClick={() => pickTag(t.name)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pp-batch-action-wrap">
          <button
            className="pp-batch-btn"
            disabled={busy}
            onClick={() => setShowTopicPicker((v) => !v)}
          >
            <Layers size={13} /> Move to topic
          </button>
          {showTopicPicker && (
            <div className="pp-batch-popover">
              <div className="pp-batch-popover-list">
                {topics.length === 0 ? (
                  <div className="pp-modal-empty">No topics yet</div>
                ) : (
                  topics.map((t) => (
                    <button
                      key={t.id}
                      className="pp-batch-popover-item"
                      onClick={() => pickTopic(t.id)}
                    >
                      {t.name} <span style={{ opacity: 0.5 }}>({t.count})</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {activeTab === "active" ? (
          <button
            className="pp-batch-btn"
            disabled={busy}
            onClick={() => toggleActive(false)}
          >
            <Archive size={13} /> Deactivate
          </button>
        ) : (
          <button
            className="pp-batch-btn"
            disabled={busy}
            onClick={() => toggleActive(true)}
          >
            <Check size={13} /> Activate
          </button>
        )}

        <button
          className="pp-batch-btn pp-batch-btn-danger"
          disabled={busy}
          onClick={deleteSelected}
        >
          Delete
        </button>

        <button className="pp-batch-btn-clear" onClick={onClear} disabled={busy}>
          Clear
        </button>
      </div>
    </div>
  );
}
