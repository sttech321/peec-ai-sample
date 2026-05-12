"use client";

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { MAX_TOPICS, SetupTopic } from "../../lib/setup-types";

interface Props {
  topics: SetupTopic[];
  onChange: (next: SetupTopic[]) => void;
  onBack: () => void;
  onNext: () => void;
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export default function TopicsStep({ topics, onChange, onBack, onNext }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const toggle = (id: string) => {
    onChange(topics.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)));
  };

  const addCustom = () => {
    const name = draft.trim();
    if (!name) return;
    if (topics.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    if (topics.length >= MAX_TOPICS) return;
    onChange([
      ...topics,
      {
        id: uid(),
        name,
        custom: true,
        selected: true,
        prompts: [],
      },
    ]);
    setDraft("");
    setAdding(false);
  };

  const selectedCount = topics.filter((t) => t.selected).length;

  return (
    <div className="step3">
      <div className="step3-counter-row">
        <span className="step3-counter-label">Select topics</span>
        <span className="step3-counter">{selectedCount}/{MAX_TOPICS}</span>
      </div>

      <div className="step3-list">
        {topics.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`step3-row ${t.selected ? "step3-row--on" : ""}`}
            onClick={() => toggle(t.id)}
          >
            <span className={`step3-check ${t.selected ? "on" : ""}`}>
              {t.selected && <Check size={11} />}
            </span>
            <span className="step3-name">{t.name}</span>
            {t.custom && <span className="step3-custom-badge">CUSTOM</span>}
          </button>
        ))}

        {adding ? (
          <div className="step3-add-row">
            <input
              className="step3-add-input"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustom();
                if (e.key === "Escape") { setAdding(false); setDraft(""); }
              }}
              placeholder="Topic name..."
            />
            <button type="button" className="step3-add-confirm" onClick={addCustom}>Add</button>
            <button type="button" className="step3-add-cancel" onClick={() => { setAdding(false); setDraft(""); }}>×</button>
          </div>
        ) : (
          topics.length < MAX_TOPICS && (
            <button type="button" className="step3-add-btn" onClick={() => setAdding(true)}>
              <Plus size={13} /> Add custom
            </button>
          )
        )}
      </div>

      <div className="setup-nav setup-nav--row">
        <button type="button" className="setup-btn setup-btn--ghost" onClick={onBack}>Back</button>
        <button
          type="button"
          className="setup-btn setup-btn--primary"
          onClick={onNext}
          disabled={selectedCount === 0}
        >
          Next
        </button>
      </div>
    </div>
  );
}
