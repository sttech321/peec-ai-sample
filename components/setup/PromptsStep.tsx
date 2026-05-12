"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Check } from "lucide-react";
import { SetupTopic, MAX_PROMPTS_PER_TOPIC } from "../../lib/setup-types";

interface Props {
  topics: SetupTopic[];
  onChange: (next: SetupTopic[]) => void;
  onBack: () => void;
  onFinish: () => void;
  loading?: boolean;
  error?: string | null;
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export default function PromptsStep({ topics, onChange, onBack, onFinish, loading, error }: Props) {
  const selectedTopics = useMemo(() => topics.filter((t) => t.selected), [topics]);
  const [openId, setOpenId] = useState<string>(selectedTopics[0]?.id ?? "");
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const totalSelected = useMemo(
    () => selectedTopics.reduce((s, t) => s + t.prompts.filter((p) => p.selected).length, 0),
    [selectedTopics],
  );
  const totalPossible = useMemo(
    () => selectedTopics.reduce((s, t) => s + t.prompts.length, 0),
    [selectedTopics],
  );

  const togglePrompt = (topicId: string, promptId: string) => {
    onChange(
      topics.map((t) => {
        if (t.id !== topicId) return t;
        return {
          ...t,
          prompts: t.prompts.map((p) => (p.id === promptId ? { ...p, selected: !p.selected } : p)),
        };
      }),
    );
  };

  const addCustomPrompt = (topicId: string) => {
    const text = draft.trim();
    if (!text) return;
    onChange(
      topics.map((t) => {
        if (t.id !== topicId) return t;
        return {
          ...t,
          prompts: [...t.prompts, { id: uid(), text, selected: true, custom: true }],
        };
      }),
    );
    setDraft("");
    setAddingFor(null);
  };

  return (
    <div className="step4">
      <div className="step3-counter-row">
        <span className="step3-counter-label">Select prompts</span>
        <span className="step3-counter">{totalSelected}/{totalPossible}</span>
      </div>

      <div className="step4-list">
        {selectedTopics.map((topic) => {
          const isOpen = openId === topic.id;
          const selectedCount = topic.prompts.filter((p) => p.selected).length;
          return (
            <div key={topic.id} className={`step4-group ${isOpen ? "step4-group--open" : ""}`}>
              <button
                type="button"
                className="step4-group-header"
                onClick={() => setOpenId(isOpen ? "" : topic.id)}
              >
                <span className="step4-group-name">{topic.name}</span>
                <span className="step4-group-count">{selectedCount}</span>
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>

              {isOpen && (
                <div className="step4-prompts">
                  <span className="step3-counter-label step4-prompt-label">Prompts</span>
                  {topic.prompts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`step4-prompt-row ${p.selected ? "on" : ""}`}
                      onClick={() => togglePrompt(topic.id, p.id)}
                    >
                      <span className={`step3-check ${p.selected ? "on" : ""}`}>
                        {p.selected && <Check size={11} />}
                      </span>
                      <span className="step4-prompt-text">{p.text}</span>
                      {p.custom && <span className="step3-custom-badge">CUSTOM</span>}
                    </button>
                  ))}

                  {addingFor === topic.id ? (
                    <div className="step3-add-row">
                      <input
                        className="step3-add-input"
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addCustomPrompt(topic.id);
                          if (e.key === "Escape") { setAddingFor(null); setDraft(""); }
                        }}
                        placeholder="Prompt text..."
                      />
                      <button type="button" className="step3-add-confirm" onClick={() => addCustomPrompt(topic.id)}>
                        Add
                      </button>
                      <button
                        type="button"
                        className="step3-add-cancel"
                        onClick={() => { setAddingFor(null); setDraft(""); }}
                      >×</button>
                    </div>
                  ) : (
                    topic.prompts.length < MAX_PROMPTS_PER_TOPIC + 10 && (
                      <button
                        type="button"
                        className="step3-add-btn step4-add-prompt"
                        onClick={() => setAddingFor(topic.id)}
                      >
                        <Plus size={12} /> Add custom
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <div className="step1-error">{error}</div>}

      <div className="setup-nav setup-nav--row">
        <button type="button" className="setup-btn setup-btn--ghost" onClick={onBack} disabled={loading}>
          Back
        </button>
        <button
          type="button"
          className="setup-btn setup-btn--primary"
          onClick={onFinish}
          disabled={loading || totalSelected === 0}
        >
          {loading ? "Creating project..." : "Looks good"}
        </button>
      </div>
    </div>
  );
}
