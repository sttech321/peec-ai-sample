"use client";

import React, { useState, useEffect, useTransition } from "react";
import { X } from "lucide-react";
import { updatePromptSettings } from "../app/prompts/actions";
import CountrySelect from "./CountrySelect";

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
  const [, startTransition] = useTransition();

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
    persist({ isActive, location: code, tagIds });
  };

  const handleTagToggle = (id: string) => {
    const next = new Set(tagIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTagIds(next);
    persist({ isActive, location, tagIds: next });
  };

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
            <CountrySelect value={location} valueType="code" onChange={handleLocationSelect} />
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
