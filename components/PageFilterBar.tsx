"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Plus,
  Search,
  Tag as TagIcon,
} from "lucide-react";
import EngineIcon from "./EngineIcon";

// ── Public types ────────────────────────────────────────────────────────────
export interface PageFilterBrand {
  id: string;
  name: string;
  isOwn: boolean;
  domain: string | null;
}

export interface PageFilterTag {
  id: string;
  name: string;
  color: string;
}

export type PageFilterDatePreset =
  | "7"
  | "14"
  | "30"
  | "90"
  | "180"
  | "365"
  | "custom"
  | "all";

export interface PageFilterDateRange {
  start: Date;
  end: Date;
  preset: PageFilterDatePreset;
  label: string;
}

interface Props {
  projectName: string;
  projectBrands: PageFilterBrand[];
  availableTags: PageFilterTag[];
  /** Optional — if provided, the "+ Add brand" inline form is shown. */
  addBrandAction?: (
    name: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Optional callbacks if the parent wants to react to filter changes. */
  onBrandsChange?: (ids: string[] | null) => void;
  onTagsChange?: (ids: string[] | null) => void;
  onModelsChange?: (engines: string[]) => void;
  onDateChange?: (range: PageFilterDateRange) => void;
}

const ALL_ENGINES = ["ChatGPT", "Claude", "Perplexity", "Gemini", "AI Overviews"];

const DATE_PRESETS: { key: PageFilterDatePreset; label: string }[] = [
  { key: "7", label: "Last 7 days" },
  { key: "14", label: "Last 14 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "180", label: "Last 180 days" },
  { key: "365", label: "Last 365 days" },
];

// ── Date helpers ────────────────────────────────────────────────────────────
function makeDateRange(preset: PageFilterDatePreset): PageFilterDateRange {
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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
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
function fmtDay(d: Date): string {
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`;
}
function daysBetween(start: Date, end: Date): number {
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

// ── Generic dropdown wrapper ────────────────────────────────────────────────
function Dropdown({
  trigger,
  children,
  width = 220,
}: {
  trigger: (open: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
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
        <div className="pp-dd-menu" style={{ width, left: 0 }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// ── Brand favicon for dropdown rows ─────────────────────────────────────────
function BrandRowFavicon({
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

// ── Brand filter dropdown ───────────────────────────────────────────────────
function BrandFilterDropdown({
  projectName,
  brands,
  selectedIds,
  onChange,
  onAddBrand,
}: {
  projectName: string;
  brands: PageFilterBrand[];
  selectedIds: string[] | null;
  onChange: (ids: string[] | null) => void;
  onAddBrand?: (name: string) => Promise<{ ok: boolean; error?: string }>;
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
      brands.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())),
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
    if (!onAddBrand) return;
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
      <button className="pp-dd-trigger" onClick={() => setOpen((v) => !v)}>
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
                  <BrandRowFavicon name={b.name} domain={b.domain} />
                  <span className="pp-brand-name">{b.name}</span>
                </label>
              );
            })}
          </div>
          {onAddBrand &&
            (adding ? (
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
            ))}
        </div>
      )}
    </div>
  );
}

// ── Date range picker ───────────────────────────────────────────────────────
function DateRangePicker({
  value,
  onChange,
}: {
  value: PageFilterDateRange;
  onChange: (v: PageFilterDateRange) => void;
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

  const applyPreset = (key: PageFilterDatePreset) => {
    onChange(makeDateRange(key));
    setPickStart(null);
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
  };

  const grid = useMemo(() => {
    const first = startOfMonth(calMonth);
    const lastDay = new Date(
      calMonth.getFullYear(),
      calMonth.getMonth() + 1,
      0,
    ).getDate();
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
              const active = value.preset === p.key;
              return (
                <button
                  key={p.key}
                  className={`pp-date-preset ${active ? "pp-date-preset-active" : ""}`}
                  onClick={() => applyPreset(p.key)}
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
            <button className="pp-date-preset" onClick={() => applyPreset("7")}>
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
                const isFuture =
                  startOfDay(cell.date).getTime() > today.getTime();
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

// ── Main bar ────────────────────────────────────────────────────────────────
export default function PageFilterBar({
  projectName,
  projectBrands,
  availableTags,
  addBrandAction,
  onBrandsChange,
  onTagsChange,
  onModelsChange,
  onDateChange,
}: Props) {
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[] | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[] | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>(ALL_ENGINES);
  const [dateRange, setDateRange] = useState<PageFilterDateRange>(() =>
    makeDateRange("7"),
  );

  const updateBrands = (v: string[] | null) => {
    setSelectedBrandIds(v);
    onBrandsChange?.(v);
  };
  const updateTags = (v: string[] | null) => {
    setSelectedTagIds(v);
    onTagsChange?.(v);
  };
  const updateModels = (v: string[]) => {
    setSelectedModels(v);
    onModelsChange?.(v);
  };
  const updateDate = (v: PageFilterDateRange) => {
    setDateRange(v);
    onDateChange?.(v);
  };

  const toggleTagFilter = (id: string) => {
    if (selectedTagIds === null) {
      updateTags([id]);
      return;
    }
    if (selectedTagIds.includes(id)) {
      const next = selectedTagIds.filter((t) => t !== id);
      updateTags(next.length === 0 ? null : next);
    } else {
      updateTags([...selectedTagIds, id]);
    }
  };

  const toggleModel = (model: string) => {
    if (selectedModels.includes(model)) {
      updateModels(selectedModels.filter((m) => m !== model));
    } else {
      updateModels([...selectedModels, model]);
    }
  };

  return (
    <div className="pp-filter-bar">
      <BrandFilterDropdown
        projectName={projectName}
        brands={projectBrands}
        selectedIds={selectedBrandIds}
        onChange={updateBrands}
        onAddBrand={addBrandAction}
      />

      <DateRangePicker value={dateRange} onChange={updateDate} />

      <Dropdown
        width={240}
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
              onClick={() => updateTags(null)}
            >
              All Tags
            </button>
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
                <span className="pp-dd-check-label">{t.name}</span>
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
  );
}
