"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import { X, ChevronsUpDown, Check } from "lucide-react";
import { updatePromptSettings } from "../app/prompts/actions";

interface PromptTag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  promptId: string;
  initialActive: boolean;
  initialLocation: string;
  availableTags: PromptTag[];
  selectedTagIds: string[];
  onClose: () => void;
}

const TAG_COLOR_MAP: Record<string, string> = {
  gray: "#6b7280",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  purple: "#a855f7",
  pink: "#ec4899",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  amber: "#f59e0b",
  orange: "#f97316",
};

function tagColor(name: string): string {
  return TAG_COLOR_MAP[name?.toLowerCase()] ?? "#6b7280";
}

const LOCATIONS: Array<{ code: string; label: string }> = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
  { code: "SE", label: "Sweden" },
  { code: "IN", label: "India" },
  { code: "JP", label: "Japan" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
];

// Windows fonts don't render regional-indicator flag emoji, so use flagcdn PNGs
// (cached, tiny, no dependency). Returns the 40w PNG for crisp 20×15 rendering.
function flagUrl(code: string): string {
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}

export default function PromptSettingsModal({
  promptId,
  initialActive,
  initialLocation,
  availableTags,
  selectedTagIds,
  onClose,
}: Props) {
  const [isActive, setIsActive] = useState(initialActive);
  const [location, setLocation] = useState(initialLocation || "US");
  const [tagIds, setTagIds] = useState<Set<string>>(new Set(selectedTagIds));
  const [locationOpen, setLocationOpen] = useState(false);
  const [, startTransition] = useTransition();

  const locRef = useRef<HTMLDivElement>(null);

  // Close location dropdown on outside click
  useEffect(() => {
    if (!locationOpen) return;
    const onClick = (e: MouseEvent) => {
      if (locRef.current && !locRef.current.contains(e.target as Node)) {
        setLocationOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [locationOpen]);

  // Close modal on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const persist = (next: { isActive: boolean; location: string; tagIds: Set<string> }) => {
    startTransition(async () => {
      try {
        await updatePromptSettings({
          promptId,
          isActive: next.isActive,
          location: next.location,
          tagIds: Array.from(next.tagIds),
        });
      } catch (e) {
        console.error("[PromptSettings] save failed:", e);
      }
    });
  };

  const handleActiveToggle = () => {
    const next = !isActive;
    setIsActive(next);
    persist({ isActive: next, location, tagIds });
  };

  const handleLocationSelect = (code: string) => {
    setLocation(code);
    setLocationOpen(false);
    persist({ isActive, location: code, tagIds });
  };

  const handleTagToggle = (id: string) => {
    const next = new Set(tagIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTagIds(next);
    persist({ isActive, location, tagIds: next });
  };

  const currentLocation = LOCATIONS.find((l) => l.code === location) ?? LOCATIONS[0];

  return (
    <div className="ps-modal-backdrop" onClick={onClose}>
      <div className="ps-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ps-modal-header">
          <div>
            <h2 className="ps-modal-title">Prompt Settings</h2>
            <p className="ps-modal-subtitle">Update the prompt settings.</p>
          </div>
          <button type="button" className="ps-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="ps-modal-body">
          <div className="ps-row">
            <button
              type="button"
              className={`ps-toggle ${isActive ? "ps-toggle-on" : ""}`}
              onClick={handleActiveToggle}
              aria-pressed={isActive}
              aria-label="Active"
            >
              <span className="ps-toggle-knob" />
            </button>
            <span className="ps-row-label">Active</span>
          </div>

          <div className="ps-field">
            <label className="ps-field-label">Location</label>
            <div className="ps-loc-wrap" ref={locRef}>
              <button
                type="button"
                className="ps-loc-trigger"
                onClick={() => setLocationOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={locationOpen}
              >
                <img
                  src={flagUrl(currentLocation.code)}
                  alt=""
                  width={20}
                  height={15}
                  className="ps-loc-flag"
                  loading="lazy"
                />
                <span className="ps-loc-name">{currentLocation.label}</span>
                <ChevronsUpDown size={14} className="ps-loc-caret" />
              </button>
              {locationOpen && (
                <div className="ps-loc-menu" role="listbox">
                  {LOCATIONS.map((opt) => {
                    const on = opt.code === location;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        role="option"
                        aria-selected={on}
                        className={`ps-loc-item ${on ? "ps-loc-item-active" : ""}`}
                        onClick={() => handleLocationSelect(opt.code)}
                      >
                        <img
                          src={flagUrl(opt.code)}
                          alt=""
                          width={20}
                          height={15}
                          className="ps-loc-flag"
                          loading="lazy"
                        />
                        <span className="ps-loc-name">{opt.label}</span>
                        {on && <Check size={14} className="ps-loc-check" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="ps-field">
            <label className="ps-field-label">Tags</label>
            {availableTags.length === 0 ? (
              <p className="ps-empty-tags">No tags in this project yet.</p>
            ) : (
              <div className="ps-tags-list">
                {availableTags.map((tag) => {
                  const on = tagIds.has(tag.id);
                  const color = tagColor(tag.color);
                  return (
                    <div key={tag.id} className="ps-tag-row">
                      <button
                        type="button"
                        className={`ps-toggle ${on ? "ps-toggle-on" : ""}`}
                        onClick={() => handleTagToggle(tag.id)}
                        aria-pressed={on}
                        aria-label={`Toggle ${tag.name}`}
                      >
                        <span className="ps-toggle-knob" />
                      </button>
                      <span
                        className="ps-tag-chip"
                        style={{
                          background: `color-mix(in srgb, ${color} 14%, white)`,
                          color: color,
                          borderColor: `color-mix(in srgb, ${color} 28%, white)`,
                        }}
                      >
                        {tag.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
