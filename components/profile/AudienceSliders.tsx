"use client";

import { AudienceSlice } from "../../lib/brand-profile-types";
import { Info } from "lucide-react";

interface Props {
  value: AudienceSlice[];
  onChange: (next: AudienceSlice[]) => void;
}

export default function AudienceSliders({ value, onChange }: Props) {
  const enabledTotal = value.filter((s) => s.enabled).reduce((sum, s) => sum + s.weight, 0);
  const balanced = Math.abs(enabledTotal - 100) < 0.5;

  const toggle = (id: string) => {
    onChange(value.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  };

  const setWeight = (id: string, weight: number) => {
    const w = Math.max(0, Math.min(100, weight));
    onChange(value.map((s) => (s.id === id ? { ...s, weight: w } : s)));
  };

  const balance = () => {
    const enabled = value.filter((s) => s.enabled);
    if (!enabled.length) return;
    const each = Math.floor(100 / enabled.length);
    const remainder = 100 - each * enabled.length;
    const next = value.map((s, i) => {
      if (!s.enabled) return { ...s, weight: 0 };
      const enabledIdx = value.filter((v, j) => v.enabled && j <= i).length - 1;
      return { ...s, weight: each + (enabledIdx === 0 ? remainder : 0) };
    });
    onChange(next);
  };

  return (
    <div className="bp-audience">
      <div className="bp-audience-callout">
        <Info size={13} />
        <div>
          <strong>Who is this project for?</strong>
          <span>Select your audience to get more relevant prompt suggestions. Percentages must total 100%.</span>
        </div>
      </div>

      {value.map((slice) => (
        <div key={slice.id} className="bp-audience-row">
          <button
            type="button"
            className={`bp-toggle ${slice.enabled ? "bp-toggle--on" : ""}`}
            onClick={() => toggle(slice.id)}
            aria-label={`Toggle ${slice.label}`}
          >
            <span className="bp-toggle-knob" />
          </button>
          <div className="bp-audience-meta">
            <span className="bp-audience-label">{slice.label}</span>
            <span className="bp-audience-desc">{slice.description}</span>
          </div>
          <input
            type="number"
            min={0}
            max={100}
            value={slice.weight}
            onChange={(e) => setWeight(slice.id, Number(e.target.value))}
            disabled={!slice.enabled}
            className="bp-audience-weight"
          />
          <span className="bp-audience-percent">%</span>
        </div>
      ))}

      <div className={`bp-audience-total ${balanced ? "balanced" : "unbalanced"}`}>
        <span>Total: {enabledTotal}%</span>
        {!balanced && (
          <button type="button" className="bp-link-btn" onClick={balance}>
            Auto-balance
          </button>
        )}
      </div>
    </div>
  );
}
