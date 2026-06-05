"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { RotateCcw, Search } from "lucide-react";
import { DOMAIN_TYPE_COLORS } from "../lib/domain-aggregations";

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
  const placeholderRef = useRef<HTMLDivElement>(null);
  const dropdownRef    = useRef<HTMLDivElement>(null);
  const [pos, setPos]  = useState<{ top: number; left: number } | null>(null);

  // Measure where the type badge cell is so we can portal the dropdown there
  useLayoutEffect(() => {
    if (!placeholderRef.current) return;
    const td = placeholderRef.current.closest("td") ?? placeholderRef.current.parentElement;
    const rect = td?.getBoundingClientRect();
    if (!rect) return;

    const DROP_H = 360;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < DROP_H
      ? rect.top - DROP_H - 4   // open upward
      : rect.bottom + 4;         // open downward (default)

    // right-align to the td, clamp to viewport
    const left = Math.max(8, Math.min(rect.right - 240, window.innerWidth - 248));
    setPos({ top, left });
  }, []);

  // Close on outside mousedown
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const filtered = ALL_TYPES.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase())
  );
  const isOverridden = currentType !== defaultType;

  // Portal content
  const dropdown = (
    <div
      ref={dropdownRef}
      className="tdrop-wrap"
      style={{
        position: "fixed",
        top:  pos?.top  ?? 0,
        left: pos?.left ?? 0,
        zIndex: 99999,
        visibility: pos ? "visible" : "hidden",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Search */}
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

      {/* Type list */}
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
        {filtered.length === 0 && (
          <div className="tdrop-empty">No matching types</div>
        )}
      </div>

      {/* Reset — only when overridden */}
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

  return (
    <>
      {/* Invisible placeholder — used only to measure td position */}
      <div
        ref={placeholderRef}
        style={{ position: "absolute", top: 0, left: 0, width: 0, height: 0, pointerEvents: "none" }}
      />
      {typeof document !== "undefined" && ReactDOM.createPortal(dropdown, document.body)}
    </>
  );
}
