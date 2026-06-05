"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

interface Props {
  label: string;        // e.g. "All Brands"
  items: string[];      // all available options
  selected: Set<string>; // empty Set = all selected
  onChange: (next: Set<string>) => void;
  searchable?: boolean;
  featuresMode?: boolean; // shows Or/And toggle instead of search
}

export default function ChatFilterDropdown({
  label, items, selected, onChange, searchable = true, featuresMode = false,
}: Props) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState("");
  const [orMode, setOrMode]   = useState(true); // Or = any match, And = all match
  const ref                   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const filtered = items.filter(item =>
    item.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = selected.size === 0;
  const activeLabel = allSelected
    ? label
    : selected.size === 1
      ? [...selected][0]
      : `${selected.size} selected`;

  function toggle(item: string) {
    const next = new Set(selected);
    if (next.has(item)) next.delete(item); else next.add(item);
    onChange(next);
  }

  function selectOnly(item: string) {
    onChange(new Set([item]));
    setOpen(false);
  }

  return (
    <div ref={ref} className="cfd-wrap">
      <button
        className={`cfd-trigger ${!allSelected ? "cfd-trigger--active" : ""}`}
        onClick={() => setOpen(v => !v)}
      >
        {activeLabel}
        <ChevronDown size={11} />
      </button>

      {open && (
        <div className="cfd-dropdown">
          {/* Search or Or/And toggle */}
          {featuresMode ? (
            <div className="cfd-feature-header">
              <span className="cfd-feature-label">All Features</span>
              <div className="cfd-orand">
                <button className={`cfd-orand-btn ${orMode ? "active" : ""}`} onClick={() => setOrMode(true)}>Or</button>
                <button className={`cfd-orand-btn ${!orMode ? "active" : ""}`} onClick={() => setOrMode(false)}>And</button>
              </div>
            </div>
          ) : searchable ? (
            <div className="cfd-search">
              <Search size={13} className="cfd-search-icon" />
              <input
                autoFocus
                className="cfd-search-input"
                placeholder={`Search ${label.replace("All ", "").toLowerCase()}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          ) : null}

          {/* "All X" row */}
          <div className="cfd-list">
            {!featuresMode && (
              <div className="cfd-row" onClick={() => { onChange(new Set()); setOpen(false); }}>
                <span className={`cfd-checkbox ${allSelected ? "cfd-checkbox--checked" : ""}`}>
                  {allSelected && <Check size={10} />}
                </span>
                <span className="cfd-row-label">{label}</span>
                {allSelected && <span className="cfd-check-mark">✓</span>}
              </div>
            )}

            {/* Items */}
            {filtered.map(item => {
              const checked = allSelected || selected.has(item);
              return (
                <div
                  key={item}
                  className="cfd-row cfd-row--hoverable"
                  onClick={() => toggle(item)}
                >
                  <span className={`cfd-checkbox ${checked ? "cfd-checkbox--checked" : ""}`}>
                    {checked && <Check size={10} />}
                  </span>
                  <span className="cfd-row-label">{item}</span>
                  {!allSelected && !selected.has(item) ? null : (
                    <button
                      className="cfd-only-btn"
                      onClick={e => { e.stopPropagation(); selectOnly(item); }}
                    >
                      Only
                    </button>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="cfd-empty">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
