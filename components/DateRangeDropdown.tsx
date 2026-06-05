"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Check } from "lucide-react";

export type DatePreset = "7" | "14" | "30" | "90" | "180" | "365" | "all" | "custom";

export interface DateRangeValue {
  start: Date;
  end: Date;
  preset: DatePreset;
  label: string;
}

interface Props {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  defaultPreset?: DatePreset;
}

const PRESETS: { key: DatePreset; label: string; days: number }[] = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "14", label: "Last 14 days", days: 14 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "180", label: "Last 180 days", days: 180 },
  { key: "365", label: "Last 365 days", days: 365 },
];

export function makePresetRange(preset: DatePreset): DateRangeValue {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (preset === "all") {
    const start = new Date(2000, 0, 1);
    return { start, end, preset, label: "All time" };
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

function fmtShort(d: Date): string {
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`;
}

function daysInRange(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBetween(d: Date, start: Date, end: Date): boolean {
  const t = d.getTime();
  return t >= startOfDay(start).getTime() && t <= startOfDay(end).getTime();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function DateRangeDropdown({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));
  const [pickStart, setPickStart] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Reset calendar to current month every time dropdown opens
  useEffect(() => {
    if (open) setCalMonth(startOfMonth(new Date()));
  }, [open]);

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

  const applyPreset = (preset: DatePreset) => {
    onChange(makePresetRange(preset));
    setCalMonth(startOfMonth(new Date())); // always snap back to current month
    setOpen(false);
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
    setOpen(false);
  };

  // Build day grid for calMonth (Mo..Su)
  const grid = useMemo(() => {
    const first = startOfMonth(calMonth);
    const lastDay = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // shift Sunday(0) to last
    const cells: { date: Date; current: boolean }[] = [];
    // Previous month tail
    for (let i = offset - 1; i >= 0; i--) {
      const d = new Date(first);
      d.setDate(d.getDate() - (i + 1));
      cells.push({ date: d, current: false });
    }
    for (let i = 1; i <= lastDay; i++) {
      cells.push({ date: new Date(calMonth.getFullYear(), calMonth.getMonth(), i), current: true });
    }
    while (cells.length % 7 !== 0 || cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      cells.push({ date: d, current: false });
      if (cells.length >= 42) break;
    }
    return cells;
  }, [calMonth]);

  return (
    <div ref={ref} className="relative inline-block">
      <button className="pd-filter-chip" onClick={() => setOpen(!open)}>
        <Calendar size={11} /> {value.label} <ChevronDown size={11} />
      </button>

      {open && (
        <div className="pd-daterange-panel">
          <div className="pd-daterange-presets">
            <div className="pd-daterange-section-label">Select range</div>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                className={`pd-daterange-preset ${value.preset === p.key ? "active" : ""}`}
                onClick={() => applyPreset(p.key)}
              >
                <span>{p.label}</span>
                {value.preset === p.key && <Check size={13} />}
              </button>
            ))}
            <div className="pd-daterange-divider" />
            <button
              className={`pd-daterange-preset ${value.preset === "custom" ? "active" : ""}`}
              onClick={() => setPickStart(null)}
            >
              <span>Custom</span>
              {value.preset === "custom" && <Check size={13} />}
            </button>
            <button className="pd-daterange-preset" onClick={() => applyPreset("all")}>
              <span>All time</span>
              {value.preset === "all" && <Check size={13} />}
            </button>
            <div className="pd-daterange-divider" />
            <button className="pd-daterange-preset" onClick={() => applyPreset("7")}>
              Reset
            </button>
            <div className="pd-daterange-footer">
              <span>{fmtShort(value.start)} – {fmtShort(value.end)}</span>
              <span className="pd-daterange-days-badge">{daysInRange(value.start, value.end)} days</span>
            </div>
          </div>

          <div className="pd-daterange-calendar">
            <div className="pd-daterange-month-nav">
              <button
                onClick={() => {
                  const m = new Date(calMonth);
                  m.setMonth(m.getMonth() - 1);
                  setCalMonth(m);
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <span>{calMonth.toLocaleString("en", { month: "long", year: "numeric" })}</span>
              <button
                onClick={() => {
                  const m = new Date(calMonth);
                  m.setMonth(m.getMonth() + 1);
                  setCalMonth(m);
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="pd-daterange-weekdays">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="pd-daterange-days-grid">
              {grid.map((cell, i) => {
                const inRange = isBetween(cell.date, value.start, value.end);
                const isStart = isSameDay(cell.date, value.start);
                const isEnd = isSameDay(cell.date, value.end);
                const isPick = pickStart && isSameDay(cell.date, pickStart);
                const cls = [
                  "pd-daterange-day",
                  cell.current ? "" : "muted",
                  inRange ? "in-range" : "",
                  isStart ? "edge-start" : "",
                  isEnd ? "edge-end" : "",
                  isPick ? "picking" : "",
                ].filter(Boolean).join(" ");
                return (
                  <button key={i} className={cls} onClick={() => handleDayClick(cell.date)}>
                    {cell.date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
