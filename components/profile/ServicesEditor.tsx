"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, X, Check } from "lucide-react";
import { BrandService } from "../../lib/brand-profile-types";
import TagInput from "./TagInput";

interface Props {
  value: BrandService[];
  onChange: (next: BrandService[]) => void;
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function newService(): BrandService {
  return { id: uid(), name: "", category: "", description: "", keywords: [] };
}

export default function ServicesEditor({ value, onChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BrandService | null>(null);

  const update = (id: string, patch: Partial<BrandService>) =>
    onChange(value.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const remove = (id: string) => {
    onChange(value.filter((s) => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = value.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const commitDraft = () => {
    if (!draft) return;
    if (!draft.name.trim()) { setDraft(null); return; }
    onChange([...value, { ...draft, name: draft.name.trim() }]);
    setDraft(null);
  };

  const openAdd = () => setDraft(newService());
  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="bps-wrap">
      {/* ── Chip row ─────────────────────────────────── */}
      <div className="bps-chips">
        {value.map((svc) => (
          <button
            key={svc.id}
            type="button"
            className={`bps-chip ${expandedId === svc.id ? "bps-chip--active" : ""}`}
            onClick={() => toggleExpand(svc.id)}
            title="Click to edit"
          >
            {svc.name || "Untitled"}
            <span
              className="bps-chip-remove"
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); remove(svc.id); }}
              onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), remove(svc.id))}
              aria-label={`Remove ${svc.name}`}
            >
              <X size={11} />
            </span>
          </button>
        ))}
        {!draft && (
          <button type="button" className="bps-chip bps-chip--add" onClick={openAdd}>
            Add <Plus size={11} />
          </button>
        )}
      </div>

      {/* ── Expanded edit cards for existing services ── */}
      {value.map((svc, idx) =>
        expandedId === svc.id ? (
          <div key={svc.id} className="bps-card">
            <div className="bps-card-header">
              <span className="bps-card-index">#{idx + 1}</span>
              <input
                type="text"
                className="bps-name-input"
                placeholder="Service name"
                value={svc.name}
                onChange={(e) => update(svc.id, { name: e.target.value })}
                autoFocus
              />
              <div className="bps-card-controls">
                <button
                  type="button"
                  className="bps-ctrl-btn"
                  disabled={idx === 0}
                  onClick={() => move(svc.id, -1)}
                  title="Move up"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  type="button"
                  className="bps-ctrl-btn"
                  disabled={idx === value.length - 1}
                  onClick={() => move(svc.id, 1)}
                  title="Move down"
                >
                  <ChevronDown size={13} />
                </button>
                <button
                  type="button"
                  className="bps-ctrl-btn bps-ctrl-btn--danger"
                  onClick={() => remove(svc.id)}
                  title="Remove"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <div className="bps-card-row">
              <input
                type="text"
                className="bp-input"
                placeholder="Category (e.g. SaaS, Logistics)"
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

            <div className="bps-keywords">
              <label className="bp-label-tiny">Primary keywords</label>
              <TagInput
                value={svc.keywords}
                onChange={(kws) => update(svc.id, { keywords: kws })}
                placeholder="Add keyword"
                maxTags={15}
              />
            </div>

            <button
              type="button"
              className="bps-done-btn"
              onClick={() => setExpandedId(null)}
            >
              <Check size={13} /> Done
            </button>
          </div>
        ) : null
      )}

      {/* ── New service draft card ─────────────────── */}
      {draft && (
        <div className="bps-card">
          <div className="bps-card-header">
            <span className="bps-card-index">#{value.length + 1}</span>
            <input
              type="text"
              className="bps-name-input"
              placeholder="Service name (e.g. Web Development)"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && commitDraft()}
              autoFocus
            />
            <button
              type="button"
              className="bps-ctrl-btn"
              onClick={() => setDraft(null)}
              title="Cancel"
            >
              <X size={13} />
            </button>
          </div>

          <div className="bps-card-row">
            <input
              type="text"
              className="bp-input"
              placeholder="Category (e.g. SaaS, Logistics)"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
            <input
              type="text"
              className="bp-input"
              placeholder="Short description"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <div className="bps-keywords">
            <label className="bp-label-tiny">Primary keywords</label>
            <TagInput
              value={draft.keywords}
              onChange={(kws) => setDraft({ ...draft, keywords: kws })}
              placeholder="Add keyword"
              maxTags={15}
            />
          </div>

          <div className="bps-card-footer">
            <button type="button" className="bps-cancel-btn" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="bps-add-btn"
              onClick={commitDraft}
              disabled={!draft.name.trim()}
            >
              <Plus size={13} /> Add service
            </button>
          </div>
        </div>
      )}

      {value.length === 0 && !draft && (
        <p className="bps-empty-hint">
          💡 Services improve prompt generation accuracy.
        </p>
      )}
    </div>
  );
}
