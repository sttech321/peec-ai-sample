"use client";

import { useRef, useState } from "react";
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
  const [addError, setAddError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = (id: string) => {
    onChange(topics.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)));
  };

  const openAdd = () => {
    setAddError("");
    setAdding(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const addCustom = () => {
    const name = draft.trim();
    if (!name) { setAdding(false); setDraft(""); return; }
    if (topics.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setAddError("Topic already exists");
      return;
    }
    onChange([
      ...topics,
      { id: uid(), name, custom: true, selected: true, prompts: [] },
    ]);
    setDraft("");
    setAdding(false);
    setAddError("");
  };

  const cancelAdd = () => {
    setAdding(false);
    setDraft("");
    setAddError("");
  };

  const selectedCount = topics.filter((t) => t.selected).length;

  return (
    <div className="step3">
      <div className="step3-counter-row">
        <span className="step3-counter-label">Select topics</span>
        <span className="step3-counter">{selectedCount}/{Math.max(MAX_TOPICS, topics.length)}</span>
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

        {/* Add custom input row */}
        {adding && (
          <div className="step3-add-row">
            <input
              ref={inputRef}
              className="step3-add-input"
              autoFocus
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setAddError(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustom();
                if (e.key === "Escape") cancelAdd();
              }}
              placeholder="Enter topic name..."
            />
            <button type="button" className="step3-add-confirm" onClick={addCustom}>
              Add
            </button>
            <button type="button" className="step3-add-cancel" onClick={cancelAdd}>
              ×
            </button>
          </div>
        )}

        {/* + Add custom link — always visible and always clickable */}
        {!adding && (
          <button
            type="button"
            className="step3-add-link"
            onClick={openAdd}
          >
            <Plus size={12} />
            Add custom
          </button>
        )}

        {/* Error message */}
        {addError && <p className="step3-add-error">{addError}</p>}
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
