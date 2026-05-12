"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { INDUSTRY_OPTIONS } from "../../lib/brand-profile-types";

interface Props {
  value: string;
  onChange: (next: string) => void;
}

export default function IndustrySelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDUSTRY_OPTIONS;
    return INDUSTRY_OPTIONS.filter((opt) => opt.toLowerCase().includes(q));
  }, [query]);

  const showCustom = query.trim() && !INDUSTRY_OPTIONS.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  return (
    <div ref={ref} className="bp-industry-wrapper">
      <button
        type="button"
        className="bp-industry-trigger"
        onClick={() => setOpen(!open)}
      >
        <span className={value ? "" : "bp-placeholder"}>{value || "Select an industry"}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="bp-industry-panel">
          <div className="bp-industry-search">
            <Search size={12} />
            <input
              type="text"
              placeholder="Search or type custom..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="bp-industry-list custom-scrollbar">
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`bp-industry-option ${opt === value ? "active" : ""}`}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span>{opt}</span>
                {opt === value && <Check size={13} />}
              </button>
            ))}
            {showCustom && (
              <button
                type="button"
                className="bp-industry-option bp-industry-custom"
                onClick={() => {
                  onChange(query.trim());
                  setOpen(false);
                  setQuery("");
                }}
              >
                Use “{query.trim()}”
              </button>
            )}
            {filtered.length === 0 && !showCustom && (
              <div className="bp-industry-empty">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
