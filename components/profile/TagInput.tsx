"use client";

import { KeyboardEvent, useMemo, useState } from "react";
import { X, Plus } from "lucide-react";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  suggestions?: string[];
  validate?: (raw: string) => string | null; // returns normalized value or null to reject
}

export default function TagInput({
  value, onChange, placeholder = "Add", maxTags = 25, suggestions = [], validate,
}: Props) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = useMemo(
    () => suggestions.filter((s) => !value.includes(s)).slice(0, 6),
    [suggestions, value],
  );

  const commit = (raw: string) => {
    setError(null);
    const trimmed = raw.trim();
    if (!trimmed) return;
    const normalized = validate ? validate(trimmed) : trimmed;
    if (!normalized) {
      setError("Invalid value");
      return;
    }
    if (value.includes(normalized)) {
      setError("Already added");
      return;
    }
    if (value.length >= maxTags) {
      setError(`Maximum ${maxTags} reached`);
      return;
    }
    onChange([...value, normalized]);
    setDraft("");
  };

  const remove = (tag: string) => {
    onChange(value.filter((v) => v !== tag));
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setDraft("");
      setAdding(false);
    }
  };

  return (
    <div className="bp-taginput">
      <div className="bp-taginput-row">
        {value.map((tag) => (
          <span key={tag} className="bp-tag">
            {tag}
            <button
              type="button"
              className="bp-tag-remove"
              onClick={() => remove(tag)}
              aria-label={`Remove ${tag}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}

        {adding ? (
          <input
            type="text"
            className="bp-taginput-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            onBlur={() => {
              if (draft) commit(draft);
              setAdding(false);
            }}
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          value.length < maxTags && (
            <button
              type="button"
              className="bp-tag bp-tag--add"
              onClick={() => setAdding(true)}
            >
              {placeholder} <Plus size={11} />
            </button>
          )
        )}
      </div>

      {error && <div className="bp-taginput-error">{error}</div>}

      {remaining.length > 0 && (
        <div className="bp-taginput-suggestions">
          <span className="bp-taginput-suggestions-label">Suggestions:</span>
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              className="bp-taginput-suggestion"
              onClick={() => commit(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
