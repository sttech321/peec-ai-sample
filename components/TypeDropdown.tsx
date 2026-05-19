"use client";
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, RotateCcw, Search } from "lucide-react";
import { DOMAIN_TYPE_COLORS } from "../lib/url-aggregations";

const ALL_TYPES = [
  "Corporate", "Editorial", "Institutional", "Other",
  "Reference", "UGC", "Competitor", "You", "Related",
];

interface Props {
  domain: string;
  currentType: string;
  defaultType: string;
  onSelect: (type: string) => void;
  onReset: () => void;
  onClose: () => void;
}

export default function TypeDropdown({ currentType, defaultType, onSelect, onReset, onClose }: Props) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  const filtered = ALL_TYPES.filter((t) => t.toLowerCase().includes(search.toLowerCase()));
  const isOverridden = currentType !== defaultType;

  return (
    <div ref={ref} className="tdrop-wrap">
      <div className="tdrop-search">
        <Search size={13} className="tdrop-search-icon" />
        <input
          autoFocus
          type="text"
          placeholder="Search or create type"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="tdrop-input"
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
      </div>
      <div className="tdrop-list">
        {filtered.map((type) => {
          const color = (DOMAIN_TYPE_COLORS as Record<string, string>)[type] ?? "#64748b";
          const isActive = type === currentType;
          return (
            <button
              key={type}
              className={`tdrop-row${isActive ? " tdrop-row--active" : ""}`}
              onClick={() => { onSelect(type); onClose(); }}
            >
              <span className="tdrop-item">
                <span className="tdrop-dot" style={{ background: color }} />
                <span className="tdrop-label">{type}</span>
              </span>
              {isActive && <span className="tdrop-check">✓</span>}
            </button>
          );
        })}
        {filtered.length === 0 && <div className="tdrop-empty">No matching types</div>}
      </div>
      <div className="tdrop-custom-section">
        <span>Custom types</span>
        <ChevronDown size={12} />
      </div>
      {isOverridden && (
        <div className="tdrop-footer">
          <button className="tdrop-reset" onClick={() => { onReset(); onClose(); }}>
            <RotateCcw size={11} />
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}
