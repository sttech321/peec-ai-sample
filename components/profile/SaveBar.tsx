"use client";

import { Check, AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  dirty: boolean;
  saving: boolean;
  lastSaved: Date | null;
  error: string | null;
  onSave: () => void;
  onDiscard: () => void;
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 5000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return date.toLocaleTimeString();
}

export default function SaveBar({ dirty, saving, lastSaved, error, onSave, onDiscard }: Props) {
  return (
    <div className={`bp-savebar ${dirty || saving || error ? "bp-savebar--visible" : ""}`}>
      <div className="bp-savebar-status">
        {error ? (
          <>
            <AlertTriangle size={14} className="bp-savebar-icon-error" />
            <span>{error}</span>
          </>
        ) : saving ? (
          <>
            <Loader2 size={14} className="bp-savebar-spin" />
            <span>Saving…</span>
          </>
        ) : dirty ? (
          <>
            <span className="bp-savebar-dot" />
            <span>Unsaved changes</span>
          </>
        ) : lastSaved ? (
          <>
            <Check size={14} className="bp-savebar-icon-ok" />
            <span>Saved {timeAgo(lastSaved)}</span>
          </>
        ) : (
          <span>Saving changes will refresh your prompt suggestions.</span>
        )}
      </div>
      <div className="bp-savebar-actions">
        {dirty && (
          <button type="button" className="bp-btn bp-btn--ghost" onClick={onDiscard} disabled={saving}>
            Discard
          </button>
        )}
        <button
          type="button"
          className="bp-btn bp-btn--primary"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
