"use client";

import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { BrandService } from "../../lib/brand-profile-types";
import TagInput from "./TagInput";

interface Props {
  value: BrandService[];
  onChange: (next: BrandService[]) => void;
}

function newService(): BrandService {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
    name: "",
    category: "",
    description: "",
    keywords: [],
  };
}

export default function ServicesEditor({ value, onChange }: Props) {
  const update = (id: string, patch: Partial<BrandService>) => {
    onChange(value.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const remove = (id: string) => onChange(value.filter((s) => s.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    const idx = value.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="bp-services">
      {value.map((svc, idx) => (
        <div key={svc.id} className="bp-service-card">
          <div className="bp-service-header">
            <span className="bp-service-index">#{idx + 1}</span>
            <input
              type="text"
              className="bp-service-name"
              placeholder="Service name (e.g. Search Engine Optimization)"
              value={svc.name}
              onChange={(e) => update(svc.id, { name: e.target.value })}
            />
            <div className="bp-service-controls">
              <button
                type="button"
                className="bp-icon-btn"
                disabled={idx === 0}
                onClick={() => move(svc.id, -1)}
                title="Move up"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                className="bp-icon-btn"
                disabled={idx === value.length - 1}
                onClick={() => move(svc.id, 1)}
                title="Move down"
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                className="bp-icon-btn bp-icon-btn--danger"
                onClick={() => remove(svc.id)}
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="bp-service-grid">
            <input
              type="text"
              className="bp-input"
              placeholder="Category (e.g. Marketing, SaaS)"
              value={svc.category}
              onChange={(e) => update(svc.id, { category: e.target.value })}
            />
            <input
              type="text"
              className="bp-input"
              placeholder="Short description"
              value={svc.description}
              onChange={(e) => update(svc.id, { description: e.target.value })}
            />
          </div>
          <div className="bp-service-keywords">
            <label className="bp-label-tiny">Primary keywords</label>
            <TagInput
              value={svc.keywords}
              onChange={(kws) => update(svc.id, { keywords: kws })}
              placeholder="Add keyword"
              maxTags={15}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        className="bp-add-service"
        onClick={() => onChange([...value, newService()])}
      >
        <Plus size={14} /> Add service
      </button>

      <p className="bp-section-hint">
        💡 Services improve prompt generation accuracy.
      </p>
    </div>
  );
}
