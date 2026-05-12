"use client";

import { useMemo, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { ChevronDown, Maximize2, X } from "lucide-react";
import { COUNTRY_OPTIONS } from "../../lib/brand-profile-types";
import { numericToAlpha2 } from "../../lib/country-codes";

interface Props {
  value: string[]; // alpha-2 codes
  onChange: (next: string[]) => void;
}

const TOPO_URL = "/maps/countries-110m.json";

const SELECTED_FILL = "#3b82f6"; // blue-500
const UNSELECTED_FILL = "#e2e8f0"; // slate-200
const HOVER_FILL = "#94a3b8"; // slate-400
const BORDER = "#fff";

export default function TargetMarketsMap({ value, onChange }: Props) {
  const selectedSet = useMemo(() => new Set(value), [value]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [zoomed, setZoomed] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const toggleCountry = (alpha2: string) => {
    if (!alpha2) return;
    if (selectedSet.has(alpha2)) {
      onChange(value.filter((c) => c !== alpha2));
    } else {
      onChange([...value, alpha2]);
    }
  };

  const removeCountry = (alpha2: string) => {
    onChange(value.filter((c) => c !== alpha2));
  };

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter(
      (o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q),
    );
  }, [search]);

  const summaryLabel = useMemo(() => {
    if (value.length === 0) return "Add country";
    const first = COUNTRY_OPTIONS.find((c) => c.code === value[0]);
    if (value.length === 1) return first?.name ?? value[0];
    return `${first?.name ?? value[0]} + ${value.length - 1}`;
  }, [value]);

  const firstCountryCode = value[0]?.toLowerCase();

  return (
    <div className="bp-map-wrapper">
      <div className="bp-map-header">
        <div className="bp-map-select-wrapper">
          <button
            type="button"
            className="bp-map-summary"
            onClick={() => setPickerOpen((o) => !o)}
          >
            {firstCountryCode && (
              <span className={`fi fi-${firstCountryCode} bp-flag`} aria-hidden="true">
                {value[0]}
              </span>
            )}
            <span>{summaryLabel}</span>
            <ChevronDown size={12} />
          </button>
          {pickerOpen && (
            <div ref={pickerRef} className="bp-map-picker">
              <input
                type="text"
                className="bp-map-picker-search"
                placeholder="Search countries…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              <div className="bp-map-picker-list">
                {filteredOptions.length === 0 ? (
                  <div className="bp-map-picker-empty">No matches</div>
                ) : (
                  filteredOptions.map((opt) => {
                    const active = selectedSet.has(opt.code);
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        className={`bp-map-picker-option ${active ? "active" : ""}`}
                        onClick={() => toggleCountry(opt.code)}
                      >
                        <span className="bp-map-picker-code">{opt.code}</span>
                        <span className="bp-map-picker-name">{opt.name}</span>
                        {active && <span className="bp-map-picker-check">✓</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className="bp-map-zoom-btn"
          onClick={() => setZoomed((z) => !z)}
          title={zoomed ? "Shrink map" : "Expand map"}
        >
          <Maximize2 size={14} />
        </button>
      </div>

      <div className={`bp-map ${zoomed ? "bp-map--zoomed" : ""}`}>
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 155 }}
          width={820}
          height={420}
          style={{ width: "100%", height: "auto" }}
        >
          <Geographies geography={TOPO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const alpha2 = numericToAlpha2(geo.id as string);
                const selected = alpha2 ? selectedSet.has(alpha2) : false;
                const isHovered = hovered === geo.rsmKey;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => setHovered(geo.rsmKey)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => alpha2 && toggleCountry(alpha2)}
                    style={{
                      default: {
                        fill: selected ? SELECTED_FILL : UNSELECTED_FILL,
                        stroke: BORDER,
                        strokeWidth: 0.5,
                        outline: "none",
                      },
                      hover: {
                        fill: selected ? SELECTED_FILL : HOVER_FILL,
                        stroke: BORDER,
                        strokeWidth: 0.5,
                        outline: "none",
                        cursor: alpha2 ? "pointer" : "default",
                      },
                      pressed: {
                        fill: SELECTED_FILL,
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      {value.length > 0 && (
        <div className="bp-map-chips">
          {value.map((code) => {
            const country = COUNTRY_OPTIONS.find((c) => c.code === code);
            return (
              <span key={code} className="bp-map-chip">
                <span className="bp-map-chip-code">{code}</span>
                <span>{country?.name ?? code}</span>
                <button
                  type="button"
                  className="bp-map-chip-remove"
                  onClick={() => removeCountry(code)}
                  aria-label={`Remove ${country?.name ?? code}`}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
