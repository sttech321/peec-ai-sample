"use client";

import { useState } from "react";
import { Plus, X, ExternalLink } from "lucide-react";
import DomainFavicon from "../DomainFavicon";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

function normalizeDomain(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split("?")[0];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) return null;
  return s;
}

export default function CompetitorList({ value, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    setError(null);
    const normalized = normalizeDomain(draft);
    if (!normalized) {
      setError("Enter a valid domain (e.g. example.com)");
      return;
    }
    if (value.includes(normalized)) {
      setError("Already added");
      return;
    }
    onChange([...value, normalized]);
    setDraft("");
  };

  const remove = (domain: string) => {
    onChange(value.filter((d) => d !== domain));
  };

  return (
    <div className="bp-competitors">
      <div className="bp-competitor-input-row">
        <input
          type="text"
          className="bp-input"
          placeholder="competitor.com"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        />
        <button type="button" className="bp-add-inline" onClick={add}>
          <Plus size={14} /> Add
        </button>
      </div>
      {error && <div className="bp-input-error">{error}</div>}

      {value.length > 0 && (
        <div className="bp-competitor-cards">
          {value.map((domain) => (
            <div key={domain} className="bp-competitor-card">
              <DomainFavicon domain={domain} size={20} />
              <div className="bp-competitor-meta">
                <span className="bp-competitor-domain">{domain}</span>
                <a
                  href={`https://${domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bp-competitor-link"
                >
                  Visit <ExternalLink size={10} />
                </a>
              </div>
              <button
                type="button"
                className="bp-icon-btn bp-icon-btn--danger"
                onClick={() => remove(domain)}
                title="Remove"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
