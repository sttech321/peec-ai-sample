"use client";

import { ComponentType, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  LuStore,
  LuCalendar,
  LuTag,
  LuSparkles,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuLayoutGrid,
  LuCheck,
  LuSearch,
  LuPlus,
} from "react-icons/lu";
import {
  SiOpenai,
  SiPerplexity,
  SiGoogle,
  SiGooglegemini,
  SiClaude,
} from "react-icons/si";

// ----------------------------------------------------------------------------
// shared

type IconProps = { className?: string };

function useOutside<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);
  return ref;
}

function Trigger({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50",
        active ? "border-zinc-400" : "border-zinc-200",
      ].join(" ")}
    >
      <span className="text-zinc-500">{icon}</span>
      {label}
      <LuChevronDown className="h-3 w-3 text-zinc-400" />
    </button>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={[
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
        checked ? "border-blue-500 bg-blue-500" : "border-zinc-300 bg-white",
      ].join(" ")}
    >
      {checked && <LuCheck className="h-3 w-3 text-white" />}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Brand filter

const TRACKED = { name: "Thrive", you: true };
const ALL_BRANDS = [
  "Coalition",
  "Coalition Technologies",
  "Directive",
  "Disruptive",
  "HigherVisibility",
  "Ignite",
  "Intero Digital",
  "KlientBoost",
  "LYFE Marketing",
  "SmartSites",
  "Victorious",
  "WebFX",
];

function BrandFilter() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(ALL_BRANDS));
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));

  const filtered = useMemo(
    () => ALL_BRANDS.filter((b) => b.toLowerCase().includes(query.toLowerCase())),
    [query]
  );
  const allSelected = selected.size === ALL_BRANDS.length;

  function toggle(brand: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  }

  return (
    <div ref={ref} className="relative">
      <Trigger
        icon={<LuStore className="h-3.5 w-3.5" />}
        label={TRACKED.name}
        active={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="p-2">
            <div className="relative">
              <LuSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search brands..."
                className="w-full rounded-md border border-zinc-200 bg-white py-1.5 pl-8 pr-2 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(ALL_BRANDS))
            }
            className="flex w-full items-center justify-between border-y border-zinc-100 px-3 py-2 text-left text-xs font-medium text-zinc-900 hover:bg-zinc-50"
          >
            All brands
            {allSelected && <LuCheck className="h-3.5 w-3.5 text-zinc-900" />}
          </button>

          <div className="max-h-80 overflow-y-auto">
            <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              Tracked brand
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-xs">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-emerald-500 text-[9px] font-medium text-white">
                T
              </span>
              <span className="flex-1 text-zinc-900">{TRACKED.name}</span>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                You
              </span>
            </div>

            <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              All brands
            </div>
            <ul className="pb-1">
              {filtered.map((brand) => (
                <li key={brand}>
                  <button
                    type="button"
                    onClick={() => toggle(brand)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    <Checkbox checked={selected.has(brand)} />
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-zinc-200 text-[9px] font-medium text-zinc-600">
                      {brand[0]}
                    </span>
                    <span className="flex-1">{brand}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button className="flex w-full items-center gap-1.5 border-t border-zinc-100 px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50">
            <LuPlus className="h-3.5 w-3.5" />
            Add brand
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Date range filter

const PRESETS = [
  "Last 7 days",
  "Last 14 days",
  "Last 30 days",
  "Last 90 days",
  "Last 180 days",
  "Last 365 days",
];

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function fmtRange(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  return `${start.toLocaleDateString("en-GB", opts)} - ${end.toLocaleDateString("en-GB", opts)}`;
}

function DateRangeFilter() {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState("Last 30 days");
  const [view, setView] = useState({ year: 2026, month: 4 }); // May 2026 (0-indexed)
  const today = new Date(2026, 4, 7);
  const start = new Date(2026, 3, 8); // 8 Apr 2026
  const end = today;
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));

  const grid = buildMonthGrid(view.year, view.month);
  const monthLabel = new Date(view.year, view.month).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  function inRange(d: Date) {
    return d >= start && d <= end;
  }
  function isSameDay(a: Date, b: Date) {
    return a.toDateString() === b.toDateString();
  }

  return (
    <div ref={ref} className="relative">
      <Trigger
        icon={<LuCalendar className="h-3.5 w-3.5" />}
        label={preset}
        active={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 flex overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="flex w-44 flex-col border-r border-zinc-100">
            <div className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              Select range
            </div>
            <ul>
              {PRESETS.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => setPreset(p)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    <span>{p}</span>
                    {preset === p && <LuCheck className="h-3.5 w-3.5 text-zinc-900" />}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setPreset("Custom")}
                  className="flex w-full items-center px-3 py-1.5 text-left text-xs font-medium text-zinc-900 hover:bg-zinc-50"
                >
                  Custom
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setPreset("All time")}
                  className="flex w-full items-center px-3 py-1.5 text-left text-xs font-medium text-zinc-900 hover:bg-zinc-50"
                >
                  All time
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setPreset("Last 30 days")}
                  className="flex w-full items-center border-t border-zinc-100 px-3 py-1.5 text-left text-xs text-zinc-500 hover:bg-zinc-50"
                >
                  Reset
                </button>
              </li>
            </ul>
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-zinc-100 px-3 py-2 text-[11px]">
              <span className="text-zinc-700">{fmtRange(start, end)}</span>
              <span className="text-zinc-400">30 days</span>
            </div>
          </div>

          <div className="w-72 p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setView((v) =>
                    v.month === 0
                      ? { year: v.year - 1, month: 11 }
                      : { year: v.year, month: v.month - 1 }
                  )
                }
                className="rounded p-1 text-zinc-500 hover:bg-zinc-50"
              >
                <LuChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-xs font-medium text-zinc-900">{monthLabel}</div>
              <button
                type="button"
                onClick={() =>
                  setView((v) =>
                    v.month === 11
                      ? { year: v.year + 1, month: 0 }
                      : { year: v.year, month: v.month + 1 }
                  )
                }
                className="rounded p-1 text-zinc-500 hover:bg-zinc-50"
              >
                <LuChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] font-medium text-zinc-400">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-0.5 text-center text-[11px]">
              {grid.map((d, i) => {
                const inMonth = d.getMonth() === view.month;
                const future = d > today;
                const selected = isSameDay(d, today);
                const ranged = inRange(d) && !selected;

                let cls = "h-7 w-7 mx-auto flex items-center justify-center rounded-md transition-colors ";
                if (selected) cls += "bg-zinc-900 text-white font-medium";
                else if (ranged) cls += "bg-zinc-100 text-zinc-900";
                else if (!inMonth || future) cls += "text-zinc-300";
                else cls += "text-zinc-700 hover:bg-zinc-50";

                return (
                  <div key={i} className="py-0.5">
                    <button type="button" disabled={future} className={cls}>
                      {d.getDate()}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Tag filter

const TAGS = ["SEO", "Link Building", "Web Design", "Content", "PPC"];

function TagFilter() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(TAGS));
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));

  const all = selected.size === TAGS.length;

  return (
    <div ref={ref} className="relative">
      <Trigger
        icon={<LuTag className="h-3.5 w-3.5" />}
        label="All Tags"
        active={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => setSelected(all ? new Set() : new Set(TAGS))}
            className="flex w-full items-center justify-between border-b border-zinc-100 px-3 py-2 text-left text-xs font-medium text-zinc-900 hover:bg-zinc-50"
          >
            All Tags
            {all && <LuCheck className="h-3.5 w-3.5 text-zinc-900" />}
          </button>
          <ul className="py-1">
            {TAGS.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(t)) next.delete(t);
                      else next.add(t);
                      return next;
                    })
                  }
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  <Checkbox checked={selected.has(t)} />
                  <LuTag className="h-3 w-3 text-zinc-400" />
                  <span className="flex-1">{t}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Models filter

type ModelDef = { name: string; Icon: ComponentType<IconProps>; color: string; upgrade?: boolean };

const SELECTED_MODELS: ModelDef[] = [
  { name: "ChatGPT", Icon: SiOpenai, color: "text-emerald-600" },
  { name: "Perplexity", Icon: SiPerplexity, color: "text-cyan-700" },
  { name: "AI Overview", Icon: SiGoogle, color: "text-blue-500" },
  { name: "AI Mode", Icon: SiGoogle, color: "text-blue-500" },
  { name: "Gemini", Icon: SiGooglegemini, color: "text-blue-500" },
];

const AVAILABLE_MODELS: ModelDef[] = [
  { name: "Grok", Icon: SiOpenai, color: "text-zinc-700" },
  { name: "Copilot", Icon: SiOpenai, color: "text-blue-500" },
  { name: "GPT 5 Search", Icon: SiOpenai, color: "text-emerald-600", upgrade: true },
  { name: "Claude Sonnet 4.6", Icon: SiClaude, color: "text-orange-600", upgrade: true },
  { name: "Claude Haiku 4.5", Icon: SiClaude, color: "text-orange-600", upgrade: true },
];

function ModelFilter() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(SELECTED_MODELS.map((m) => m.name))
  );
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));

  const allSelected = selected.size === SELECTED_MODELS.length;

  return (
    <div ref={ref} className="relative">
      <Trigger
        icon={<LuSparkles className="h-3.5 w-3.5" />}
        label="All Models"
        active={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() =>
              setSelected(
                allSelected ? new Set() : new Set(SELECTED_MODELS.map((m) => m.name))
              )
            }
            className="flex w-full items-center justify-between border-b border-zinc-100 px-3 py-2 text-left text-xs font-medium text-zinc-900 hover:bg-zinc-50"
          >
            All Models
            {allSelected && <LuCheck className="h-3.5 w-3.5 text-zinc-900" />}
          </button>

          <ul className="max-h-72 overflow-y-auto py-1">
            {SELECTED_MODELS.map((m) => (
              <li key={m.name}>
                <button
                  type="button"
                  onClick={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(m.name)) next.delete(m.name);
                      else next.add(m.name);
                      return next;
                    })
                  }
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  <Checkbox checked={selected.has(m.name)} />
                  <m.Icon className={`h-3.5 w-3.5 shrink-0 ${m.color}`} />
                  <span className="flex-1">{m.name}</span>
                </button>
              </li>
            ))}

            <li className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              Available models
            </li>
            {AVAILABLE_MODELS.map((m) => (
              <li key={m.name}>
                <div className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">
                  <span className="w-4" />
                  <m.Icon className={`h-3.5 w-3.5 shrink-0 ${m.color}`} />
                  <span className="flex-1">{m.name}</span>
                  {m.upgrade && (
                    <button className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 hover:bg-zinc-200">
                      Upgrade
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------

export function FilterBar() {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-white px-6 py-3">
      <div className="mr-2 flex items-center gap-1.5 text-sm font-medium text-zinc-900">
        <LuLayoutGrid className="h-4 w-4 text-zinc-500" />
        Overview
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <BrandFilter />
        <DateRangeFilter />
        <TagFilter />
        <ModelFilter />
      </div>
    </div>
  );
}
