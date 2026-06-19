"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { ChevronsUpDown, Search, Check } from "lucide-react";
import { COUNTRIES } from "../lib/setup-types";

/** Circular country flag (from the circle-flags CDN), with a code-letter fallback. */
function CSFlag({ code, size = 18 }: { code: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!code) return null;
  if (err) {
    return (
      <span className="cs-flag-fallback" style={{ width: size, height: size }}>{code.toUpperCase()}</span>
    );
  }
  return (
    <img
      className="cs-flag"
      src={`https://hatscripts.github.io/circle-flags/flags/${code.toLowerCase()}.svg`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErr(true)}
    />
  );
}

interface Props {
  /** Current value — a country code ("US") or name ("United States"), per `valueType`. */
  value: string;
  onChange: (value: string) => void;
  /** Whether `value`/`onChange` use the 2-letter code or the country name. Default "code". */
  valueType?: "code" | "name";
  disabled?: boolean;
}

/** Searchable country dropdown with flags, sourced from the `countries-list` package.
 *  The dropdown is portalled with fixed positioning so it never clips inside modals. */
export default function CountrySelect({ value, onChange, valueType = "code", disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = COUNTRIES.find((c) => (valueType === "code" ? c.code === value : c.name === value));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle),
    );
  }, [q]);

  // Position the portalled panel from the trigger rect; flip up if no room below.
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const PANEL_H = 320;
    const below = window.innerHeight - r.bottom;
    const top = below >= PANEL_H || below >= r.top ? r.bottom + 4 : Math.max(8, r.top - PANEL_H - 4);
    setPos({ top, left: r.left, width: r.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
      setQ("");
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const label = selected?.name ?? (value || "Select country");

  return (
    <div className="cs-wrap">
      <button
        ref={btnRef}
        type="button"
        className="cs-trigger"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cs-trigger-val">
          {selected && <CSFlag code={selected.code} />}
          <span className="cs-trigger-label">{label}</span>
        </span>
        <ChevronsUpDown size={14} className="cs-chevron" />
      </button>

      {open && pos && typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <div
            ref={panelRef}
            className="cs-panel"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: Math.max(pos.width, 240) }}
          >
            <div className="cs-search">
              <Search size={13} />
              <input
                autoFocus
                placeholder="Search countries..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="cs-list custom-scrollbar">
              {filtered.map((c) => {
                const isSel = valueType === "code" ? c.code === value : c.name === value;
                return (
                  <button
                    key={c.code}
                    type="button"
                    className={`cs-option${isSel ? " cs-option-active" : ""}`}
                    onClick={() => {
                      onChange(valueType === "code" ? c.code : c.name);
                      setOpen(false);
                      setQ("");
                    }}
                  >
                    <CSFlag code={c.code} />
                    <span className="cs-option-name">{c.name}</span>
                    {isSel && <Check size={13} className="cs-check" />}
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="cs-empty">No matches</div>}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
