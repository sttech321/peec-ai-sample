"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useRouter } from "next/navigation";
import {
  ChevronUp, ChevronDown, MoreHorizontal, Plus, Search, X, ShoppingCart, FolderOpen,
  Pencil, Settings2, Download, Pause, Play, Trash2, Info, CheckCircle, AlertCircle, Languages,
} from "lucide-react";
import {
  COUNTRIES as ALL_COUNTRIES, LANGUAGES as ALL_LANGUAGES, ALL_TIMEZONES,
  tzLabel, tzOffset, timezoneForCountryName, languageForCountryName,
} from "../lib/setup-types";

/** Circular country flag (matches the setup wizard). Falls back to the country
 *  code if the SVG fails to load — emoji flags don't render on Windows. */
function CircleFlag({ code, size = 18 }: { code: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!code) return null;
  if (err) {
    return (
      <span style={{ width: size, height: size, borderRadius: "50%", background: "#f1f5f9", color: "#64748b", fontSize: 9, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {code.toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={`https://hatscripts.github.io/circle-flags/flags/${code.toLowerCase()}.svg`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, display: "block" }}
    />
  );
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface ProjectRow {
  id: string;
  name: string;
  brandName?: string | null;
  domain: string | null;
  allocatedPrompts: number;
  allocatedCredits: number;
  frequency: string;
  status: string;
  projectType: string;
  color: string | null;
  models: string[] | null;
  location?: string | null;
  language?: string | null;
  timezone?: string | null;
  createdAt: Date;
  usedPrompts: number;
  usedCredits: number;
}

export interface WorkspaceStats {
  totalUsedCredits: number;
  totalAllocatedCredits: number;
  totalUsedPrompts: number;
  totalAllocatedPrompts: number;
}

interface Props {
  initialProjects: ProjectRow[];
  workspaceStats: WorkspaceStats;
  updateProjectAction: (id: string, data: Partial<ProjectRow>) => Promise<void>;
  toggleStatusAction: (id: string) => Promise<void>;
  deleteProjectAction: (id: string) => Promise<void>;
  canDelete?: boolean;
}

interface ToastItem {
  id: number;
  type: "success" | "error";
  message: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const PROJECT_COLORS = [
  "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#3b82f6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#d946ef", "#0ea5e9", "#78716c", "#a3e635",
];

const MODEL_LIST = [
  { name: "ChatGPT",          credits: 30,  color: "#10a37f", info: false },
  { name: "AI Overview",      credits: 30,  color: "#ea4335", info: false },
  { name: "AI Mode",          credits: 30,  color: "#34a853", info: false },
  { name: "Gemini",           credits: 30,  color: "#4285f4", info: false },
  { name: "Perplexity",       credits: 30,  color: "#5865f2", info: false },
  { name: "Grok",             credits: 30,  color: "#1a1a1a", info: false },
  { name: "Copilot",          credits: 30,  color: "#0078d4", info: false },
  { name: "DeepSeek API",     credits: 150, color: "#6366f1", info: true  },
  { name: "Qwen API",         credits: 180, color: "#f59e0b", info: true  },
  { name: "Claude Haiku",     credits: 180, color: "#d97706", info: false },
  { name: "OpenAI Search API",credits: 450, color: "#10a37f", info: true  },
  { name: "Claude Sonnet",    credits: 450, color: "#d97706", info: false },
];

const ENGINE_COLORS: Record<string, string> = Object.fromEntries(
  MODEL_LIST.map((m) => [m.name, m.color])
);

const ALL_ENGINES = MODEL_LIST.map((m) => m.name);

const MODEL_COSTS_WEB = [
  { name: "ChatGPT", daily: 30, weekly: 10 },
  { name: "Perplexity", daily: 30, weekly: 10 },
  { name: "AI Overview", daily: 30, weekly: 10 },
  { name: "AI Mode", daily: 30, weekly: 10 },
];
const MODEL_COSTS_API = [
  { name: "ChatGPT", daily: 15, weekly: 5 },
  { name: "Perplexity", daily: 15, weekly: 5 },
  { name: "AI Overview", daily: 15, weekly: 5 },
  { name: "AI Mode", daily: 15, weekly: 5 },
];

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function getModelColor(name: string): string {
  return ENGINE_COLORS[name] ?? "#a1a1aa";
}

const ENGINE_DOMAINS: Record<string, string> = {
  "ChatGPT":       "chatgpt.com",
  "Claude":        "claude.ai",
  "Perplexity":    "perplexity.ai",
  "Gemini":        "gemini.google.com",
  "AI Overview":   "google.com",
  "AI Mode":       "google.com",
  "Grok":          "grok.com",
  "Groq":          "groq.com",
  "Claude Sonnet": "claude.ai",
};

function EngineIconSmall({ name }: { name: string }) {
  const domain = ENGINE_DOMAINS[name] ?? "google.com";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`}
      alt={name}
      width={16}
      height={16}
      style={{ borderRadius: 3, flexShrink: 0 }}
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        el.style.display = "none";
      }}
    />
  );
}

function getModelCredits(name: string): number {
  return MODEL_LIST.find((m) => m.name === name)?.credits ?? 30;
}

// ── Toast System ───────────────────────────────────────────────────────────
function ToastManager({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: number) => void }) {
  return (
    <div className="proj-toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`proj-toast proj-toast-${t.type}`}>
          {t.type === "success"
            ? <CheckCircle size={14} className="proj-toast-icon" />
            : <AlertCircle size={14} className="proj-toast-icon" />}
          <span className="proj-toast-msg">{t.message}</span>
          <button className="proj-toast-close" onClick={() => onRemove(t.id)}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const addToast = (type: "success" | "error", message: string) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  };

  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, addToast, removeToast };
}

// ── Portal dropdown helper ─────────────────────────────────────────────────
function useDropdownPos(open: boolean, btnRef: React.RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
  }, [open, btnRef]);
  return pos;
}

// ── ModelIconsCell ─────────────────────────────────────────────────────────
function ModelIconsCell({
  project,
  onUpdate,
  addToast,
}: {
  project: ProjectRow;
  onUpdate: (data: Partial<ProjectRow>) => Promise<void>;
  addToast: (type: "success" | "error", message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(project.models ?? ALL_ENGINES);
  const [saving, setSaving] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPos(open, btnRef);

  useEffect(() => { setSelected(project.models ?? ALL_ENGINES); }, [project.models]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const shown = selected.slice(0, 3);
  const rest = selected.length - shown.length;

  const toggle = (name: string) =>
    setSelected((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({ models: selected.length > 0 ? selected : null });
      addToast("success", "Models updated successfully");
      setOpen(false);
    } catch {
      addToast("error", "Failed to update models");
    } finally {
      setSaving(false);
    }
  };

  const availableCredits = Math.max(0, project.allocatedCredits - project.usedCredits);
  const creditsPerPrompt = selected.reduce((sum, name) => sum + getModelCredits(name), 0);

  const dropdown = open && typeof document !== "undefined" ? ReactDOM.createPortal(
    <div
      ref={dropRef}
      className="proj-model-dropdown"
      style={{ position: "absolute", top: pos.top, left: pos.left }}
    >
      <div className="proj-model-dropdown-tip">
        <Info size={11} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Model choice affects your prompt limit and credit usage.</span>
      </div>
      <div className="proj-model-dropdown-list">
        {MODEL_LIST.map((m) => {
          const checked = selected.includes(m.name);
          return (
            <button
              key={m.name}
              className={`proj-model-dropdown-item ${checked ? "checked" : ""}`}
              onClick={() => toggle(m.name)}
            >
              <span className="proj-model-dropdown-dot" style={{ background: m.color }} />
              <span className="proj-model-dropdown-name">{m.name}</span>
              {m.info && <Info size={11} className="proj-model-info-icon" />}
              <span className="proj-model-dropdown-cost">{m.credits} cr/prompt</span>
              {checked && <span className="proj-model-dropdown-check">✓</span>}
            </button>
          );
        })}
      </div>
      <div className="proj-model-dropdown-footer">
        <div className="proj-model-dropdown-avail">
          Available credits: <strong>{fmtNum(availableCredits)}</strong>
        </div>
        {creditsPerPrompt > 0 && (
          <div className="proj-model-dropdown-cost-total">
            {creditsPerPrompt} cr/prompt ({selected.length} models)
          </div>
        )}
      </div>
      <div className="proj-model-dropdown-actions">
        <button className="proj-btn-cancel" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setOpen(false)}>Cancel</button>
        <button className="proj-btn-primary" style={{ fontSize: 12, padding: "5px 14px" }} onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Apply"}
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="proj-model-icons-wrap">
      <button ref={btnRef} className="proj-model-icons-btn" onClick={() => setOpen((v) => !v)}>
        <div className="proj-model-icons">
          {shown.map((m) => (
            <div key={m} className="proj-model-dot" style={{ background: getModelColor(m) }} title={m}>
              {m[0]}
            </div>
          ))}
          {rest > 0 && <span className="proj-model-more">+{rest}</span>}
        </div>
      </button>
      {dropdown}
    </div>
  );
}

// ── FreqBadge ──────────────────────────────────────────────────────────────
function FreqBadge({ freq }: { freq: string }) {
  const cls =
    freq === "Daily" ? "proj-freq-daily" :
    freq === "Weekly" ? "proj-freq-weekly" :
    "proj-freq-monthly";
  return <span className={`proj-freq-badge ${cls}`}>{freq}</span>;
}

// ── StatusBadge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span className={`proj-status-badge ${active ? "proj-status-active" : "proj-status-paused"}`}>
      {active ? "Active" : "Paused"}
    </span>
  );
}

// ── RowMenu ────────────────────────────────────────────────────────────────
function RowMenu({
  project,
  onEditDetails,
  onTrackingSetup,
  onExport,
  onToggle,
  onDelete,
}: {
  project: ProjectRow;
  onEditDetails: () => void;
  onTrackingSetup: () => void;
  onExport: () => void;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPos(open, btnRef);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const close = () => setOpen(false);

  const dropdown = open && typeof document !== "undefined" ? ReactDOM.createPortal(
    <div
      ref={dropRef}
      className="proj-row-menu-dropdown"
      style={{ position: "absolute", top: pos.top, left: pos.left - 100 }}
    >
      <button className="proj-row-menu-item" onClick={() => { onEditDetails(); close(); }}>
        <Pencil size={13} /> Edit Details
      </button>
      <button className="proj-row-menu-item" onClick={() => { onTrackingSetup(); close(); }}>
        <Settings2 size={13} /> Tracking Setup
      </button>
      <button className="proj-row-menu-item" onClick={() => { onExport(); close(); }}>
        <Download size={13} /> Export Chats
      </button>
      <div className="proj-row-menu-divider" />
      <button className="proj-row-menu-item" onClick={() => { onToggle(); close(); }}>
        {project.status === "active"
          ? <><Pause size={13} /> Pause Project</>
          : <><Play size={13} /> Resume Project</>}
      </button>
      {onDelete && (
        <button className="proj-row-menu-item danger" onClick={() => { onDelete(); close(); }}>
          <Trash2 size={13} /> Delete Project
        </button>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className="proj-row-menu-wrap">
      <button ref={btnRef} className="proj-row-menu-btn" onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal size={15} />
      </button>
      {dropdown}
    </div>
  );
}

// ── Constants for Edit Details fields ──────────────────────────────────────
// Sourced from the `countries-list` package + the runtime Intl time-zone
// catalogue, shared with the setup wizard.
const COUNTRIES = ALL_COUNTRIES.map((c) => ({ code: c.code, label: c.name }));
const LANGUAGES = ALL_LANGUAGES.map((l) => l.name);
const TIMEZONES = ALL_TIMEZONES.map((tz) => ({ tz, label: tzLabel(tz), offset: tzOffset(tz) }));

// ── EditDetailsModal ───────────────────────────────────────────────────────
function EditDetailsModal({
  project,
  onClose,
  onSave,
}: {
  project: ProjectRow;
  onClose: () => void;
  onSave: (data: Partial<ProjectRow>) => Promise<void>;
}) {
  const [name, setName] = useState(project.name);
  const [brandName, setBrandName] = useState(project.brandName ?? project.name);
  const [domain, setDomain] = useState(project.domain ?? "");
  const [location, setLocation] = useState(project.location ?? "United States");
  const [language, setLanguage] = useState(project.language ?? "English");
  const [timezone, setTimezone] = useState(project.timezone ?? "America/New_York");
  const [saving, setSaving] = useState(false);

  const selectedCountry = COUNTRIES.find((c) => c.label === location) ?? COUNTRIES[0];

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      brandName: brandName.trim() || null,
      domain: domain.trim() || null,
      location,
      language,
      timezone,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="proj-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="proj-edit-modal">
        <div className="proj-edit-modal-header">
          <div>
            <div className="proj-edit-modal-title">Edit Project Details</div>
            <div className="proj-edit-modal-subtitle">Update your project details</div>
          </div>
          <button className="proj-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="proj-edit-modal-body">
          <div className="proj-form-field">
            <label className="proj-form-label">Project Name</label>
            <input
              className="proj-form-input proj-edit-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="proj-form-field">
            <label className="proj-form-label">Brand Name</label>
            <input
              className="proj-form-input proj-edit-input"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Your brand name"
            />
          </div>
          <div className="proj-form-field">
            <label className="proj-form-label">Brand Domain</label>
            <div className="proj-edit-domain-wrap">
              <span className="proj-edit-domain-prefix">https://</span>
              <input
                className="proj-edit-domain-input"
                value={domain}
                onChange={(e) => setDomain(e.target.value.replace(/^https?:\/\//, "").replace(/^www\./, ""))}
                placeholder="www.example.com"
              />
            </div>
          </div>
          <div className="proj-form-row">
            <div className="proj-form-field">
              <label className="proj-form-label">Location</label>
              <div className="proj-edit-select-wrap">
                <span className="proj-edit-select-flag"><CircleFlag code={selectedCountry.code} size={18} /></span>
                <select
                  className="proj-edit-select-native"
                  value={location}
                  onChange={(e) => {
                    const newLoc = e.target.value;
                    setLocation(newLoc);
                    // Auto-select that country's time zone + language; user can still change them.
                    const tz = timezoneForCountryName(newLoc);
                    if (tz) setTimezone(tz);
                    const lang = languageForCountryName(newLoc);
                    if (lang) setLanguage(lang);
                  }}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.label}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="proj-edit-select-chevron" />
              </div>
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">Language</label>
              <div className="proj-edit-select-wrap">
                <span className="proj-edit-select-lang-icon"><Languages size={14} /></span>
                <select
                  className="proj-edit-select-native"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="proj-edit-select-chevron" />
              </div>
            </div>
          </div>
          <div className="proj-form-field">
            <label className="proj-form-label">Timezone</label>
            <div className="proj-edit-select-wrap">
              <select
                className="proj-edit-select-native proj-edit-tz-select"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map((t) => (
                  <option key={t.tz} value={t.tz}>
                    {t.label} {t.offset}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="proj-edit-select-chevron" />
            </div>
          </div>
        </div>
        <div className="proj-edit-modal-footer">
          <button className="proj-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="proj-btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Updating..." : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TrackingSetupModal ─────────────────────────────────────────────────────
function TrackingSetupModal({
  project,
  onClose,
  onSave,
}: {
  project: ProjectRow;
  onClose: () => void;
  onSave: (data: Partial<ProjectRow>) => Promise<void>;
}) {
  const [frequency, setFrequency] = useState(project.frequency);
  const [allocatedPrompts, setAllocatedPrompts] = useState(project.allocatedPrompts);
  const [selectedModels, setSelectedModels] = useState<string[]>(project.models ?? ALL_ENGINES);
  const [saving, setSaving] = useState(false);

  const toggleModel = (name: string) => {
    setSelectedModels((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  };

  const creditsPerPrompt = selectedModels.reduce((sum, name) => sum + getModelCredits(name), 0);
  const creditsNeeded = allocatedPrompts * creditsPerPrompt;
  const availableCredits = Math.max(0, project.allocatedCredits - project.usedCredits);
  const isOverBudget = creditsNeeded > availableCredits;

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      frequency,
      allocatedPrompts,
      models: selectedModels.length > 0 ? selectedModels : null,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="proj-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="proj-tracking-modal">
        <div className="proj-tracking-body">

          {/* Left panel — config */}
          <div className="proj-tracking-left">
            <div className="proj-tracking-left-header">
              <div className="proj-tracking-modal-title">Update Tracking Setup</div>
              <div className="proj-tracking-modal-subtitle">Configure prompts, models, and frequency</div>
            </div>

            <div className="proj-form-field">
              <label className="proj-form-label">Frequency</label>
              <div className="proj-tracking-select-wrap">
                <select
                  className="proj-tracking-select"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
                <ChevronDown size={14} className="proj-tracking-select-chevron" />
              </div>
            </div>

            <div className="proj-form-field">
              <label className="proj-form-label">No. of prompts</label>
              <input
                className="proj-form-input proj-tracking-input"
                type="number"
                min={1}
                value={allocatedPrompts}
                onChange={(e) => setAllocatedPrompts(Math.max(1, Number(e.target.value)))}
              />
              <span className="proj-form-hint">Prompts run per {frequency.toLowerCase()} scan</span>
            </div>

            <div className="proj-form-field">
              <label className="proj-form-label">Models</label>
              <div className="proj-tracking-models-grid">
                {MODEL_LIST.map((m) => {
                  const checked = selectedModels.includes(m.name);
                  return (
                    <button
                      key={m.name}
                      className={`proj-tracking-model-card ${checked ? "selected" : ""}`}
                      onClick={() => toggleModel(m.name)}
                      type="button"
                    >
                      <span className={`proj-tracking-checkbox ${checked ? "checked" : ""}`}>
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                      <span className="proj-tracking-card-info">
                        <span className="proj-tracking-card-name">{m.name}</span>
                        <span className="proj-tracking-card-cost">{m.credits} credits</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right panel — Summary */}
          <div className="proj-tracking-right">
            <div className="proj-tracking-right-top">
              <span className="proj-tracking-summary-title">Summary</span>
              <button className="proj-modal-close" onClick={onClose}><X size={15} /></button>
            </div>

            <div className="proj-tracking-summary-rows">
              <div className="proj-tracking-summary-row">
                <span className="proj-tracking-summary-label">Current credit balance</span>
                <span className="proj-tracking-summary-val">{fmtNum(project.allocatedCredits)}</span>
              </div>
              <div className="proj-tracking-summary-row">
                <span className="proj-tracking-summary-label">No. of prompts</span>
                <span className="proj-tracking-summary-val">{fmtNum(allocatedPrompts)}</span>
              </div>
              <div className="proj-tracking-summary-row">
                <span className="proj-tracking-summary-label">Frequency</span>
                <span className="proj-tracking-summary-val">{frequency}</span>
              </div>
              <div className="proj-tracking-summary-row">
                <span className="proj-tracking-summary-label">Models</span>
                <span className="proj-tracking-summary-models">
                  {selectedModels.slice(0, 5).map((m) => (
                    <span
                      key={m}
                      className="proj-tracking-summary-model-dot"
                      style={{ background: getModelColor(m) }}
                      title={m}
                    />
                  ))}
                  {selectedModels.length > 5 && (
                    <span className="proj-tracking-summary-more">+{selectedModels.length - 5}</span>
                  )}
                  {selectedModels.length === 0 && (
                    <span style={{ color: "#a1a1aa", fontSize: 12 }}>None</span>
                  )}
                </span>
              </div>
              <div className="proj-tracking-summary-divider" />
              <div className="proj-tracking-summary-row">
                <span className="proj-tracking-summary-label">Credits needed</span>
                <span
                  className="proj-tracking-summary-val-bold"
                  style={{ color: isOverBudget ? "#ef4444" : "#18181b" }}
                >
                  {fmtNum(creditsNeeded)}
                </span>
              </div>
              {isOverBudget && (
                <div className="proj-tracking-summary-warning">
                  ⚠ Insufficient credits. Buy more or reduce prompts/models.
                </div>
              )}
            </div>

            <button
              className="proj-tracking-update-btn"
              onClick={handleSave}
              disabled={saving || selectedModels.length === 0}
            >
              {saving ? "Updating..." : "Update"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirm ──────────────────────────────────────────────────────────
function DeleteConfirm({
  project, onClose, onConfirm,
}: {
  project: ProjectRow;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="proj-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="proj-del-modal">
        <div className="proj-del-title">Delete "{project.name}"?</div>
        <div className="proj-del-body">
          This will permanently delete the project and all associated prompts, chats, and data.
          This action cannot be undone.
        </div>
        <div className="proj-del-actions">
          <button className="proj-btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="proj-btn-danger"
            onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false); }}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete project"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── WorkspaceUsageBar ──────────────────────────────────────────────────────
function WorkspaceUsageBar({ projects, stats }: { projects: ProjectRow[]; stats: WorkspaceStats }) {
  const total = Math.max(stats.totalAllocatedCredits, 1);

  return (
    <div className="proj-usage-section">
      <div className="proj-usage-label">Usage · Track prompt and credit usage across projects</div>
      <div className="proj-usage-title-row">
        <div className="proj-usage-total">
          {fmtNum(stats.totalUsedCredits)}{" "}
          <span style={{ fontSize: 16, color: "#a1a1aa", fontWeight: 400 }}>
            / {fmtNum(stats.totalAllocatedCredits)}
          </span>
        </div>
        <a href="#" className="proj-buy-link">
          <ShoppingCart size={12} /> Buy more credits
        </a>
      </div>
      <div className="proj-usage-bar">
        {projects.map((p, i) => {
          const color = p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length];
          const pct = total > 0 ? (p.usedCredits / total) * 100 : 0;
          if (pct < 0.1) return null;
          return (
            <div
              key={p.id}
              className="proj-usage-segment"
              style={{ width: `${pct}%`, background: color }}
            >
              <div className="proj-usage-tooltip">
                <div className="proj-usage-tooltip-name">{p.name}</div>
                <div className="proj-usage-tooltip-row">
                  <span>Used credits</span>
                  <span className="proj-usage-tooltip-val">{fmtNum(p.usedCredits)}</span>
                </div>
                <div className="proj-usage-tooltip-row">
                  <span>Allocated credits</span>
                  <span className="proj-usage-tooltip-val">{fmtNum(p.allocatedCredits)}</span>
                </div>
                <div className="proj-usage-tooltip-row">
                  <span>Used prompts</span>
                  <span className="proj-usage-tooltip-val">{fmtNum(p.usedPrompts)}</span>
                </div>
                <div className="proj-usage-tooltip-row">
                  <span>Allocated prompts</span>
                  <span className="proj-usage-tooltip-val">{fmtNum(p.allocatedPrompts)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ flex: 1, background: "#f4f4f5", minWidth: 4 }} />
      </div>
    </div>
  );
}

// ── PromptsCard ────────────────────────────────────────────────────────────
function PromptsCard({ stats }: { stats: WorkspaceStats }) {
  const pct = stats.totalAllocatedPrompts > 0
    ? Math.min(100, (stats.totalUsedPrompts / stats.totalAllocatedPrompts) * 100)
    : 0;
  const available = Math.max(0, stats.totalAllocatedPrompts - stats.totalUsedPrompts);
  return (
    <div className="proj-card">
      <div className="proj-card-title">Used / Max prompts</div>
      <div>
        <span className="proj-card-num">{fmtNum(stats.totalUsedPrompts)}</span>
        <span className="proj-card-denom"> / {fmtNum(stats.totalAllocatedPrompts)}</span>
      </div>
      <div className="proj-prompts-bar-wrap">
        <div className="proj-prompts-bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="proj-prompts-footer">
        <span>{fmtNum(stats.totalUsedPrompts)} used prompts</span>
        <span>{fmtNum(available)} prompts available</span>
      </div>
    </div>
  );
}

// ── ModelsCostCard ─────────────────────────────────────────────────────────
function ModelsCostCard() {
  const [tab, setTab] = useState<"web" | "api">("web");
  const rows = tab === "web" ? MODEL_COSTS_WEB : MODEL_COSTS_API;
  return (
    <div className="proj-card">
      <div className="proj-card-title">Models cost per prompt</div>
      <div className="proj-models-tabs">
        <button className={`proj-models-tab ${tab === "web" ? "active" : ""}`} onClick={() => setTab("web")}>
          Web UI scraping
        </button>
        <button className={`proj-models-tab ${tab === "api" ? "active" : ""}`} onClick={() => setTab("api")}>
          API access
        </button>
      </div>
      <table className="proj-models-table">
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th>
            <th>Models cost per prompt</th>
            <th className="num">Daily</th>
            <th className="num">Weekly</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name}>
              <td style={{ color: "#a1a1aa" }}>{i + 1}</td>
              <td>
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <EngineIconSmall name={r.name} />
                  {r.name}
                </span>
              </td>
              <td className="num">{r.daily}</td>
              <td className="num">{r.weekly}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sort helpers ───────────────────────────────────────────────────────────
type SortCol = "name" | "domain" | "usedPrompts" | "usedCredits" | "allocatedCredits" | "frequency" | "createdAt" | "status";

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: "asc" | "desc" }) {
  if (col !== sortCol) return <span className="proj-sort-icon" style={{ opacity: 0.3 }}>↕</span>;
  return <span className="proj-sort-icon">{sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />}</span>;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ProjectsClient({
  initialProjects,
  workspaceStats,
  updateProjectAction,
  toggleStatusAction,
  deleteProjectAction,
  canDelete = true,
}: Props) {
  const router = useRouter();
  const { toasts, addToast, removeToast } = useToast();

  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);
  const [stats, setStats] = useState<WorkspaceStats>(workspaceStats);

  useEffect(() => { setProjects(initialProjects); }, [initialProjects]);
  useEffect(() => { setStats(workspaceStats); }, [workspaceStats]);

  const [activeTab, setActiveTab] = useState<"Customer" | "Pitch">("Customer");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [editDetailsProject, setEditDetailsProject] = useState<ProjectRow | null>(null);
  const [trackingProject, setTrackingProject] = useState<ProjectRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);

  const filtered = useMemo(() => {
    let list = projects.filter((p) => p.projectType === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.domain ?? "").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sortCol) {
        case "name": va = a.name; vb = b.name; break;
        case "domain": va = a.domain ?? ""; vb = b.domain ?? ""; break;
        case "usedPrompts": va = a.usedPrompts; vb = b.usedPrompts; break;
        case "usedCredits": va = a.usedCredits; vb = b.usedCredits; break;
        case "allocatedCredits": va = a.allocatedCredits; vb = b.allocatedCredits; break;
        case "frequency": va = a.frequency; vb = b.frequency; break;
        case "status": va = a.status; vb = b.status; break;
        case "createdAt": va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime(); break;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [projects, activeTab, search, sortCol, sortDir]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const handleUpdate = async (id: string, data: Partial<ProjectRow>) => {
    await updateProjectAction(id, data);
    router.refresh();
  };

  const handleToggle = async (id: string) => {
    await toggleStatusAction(id);
    addToast("success", "Project status updated");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteProjectAction(deleteTarget.id);
    addToast("success", `"${deleteTarget.name}" deleted`);
    setDeleteTarget(null);
    router.refresh();
  };

  const handleExport = (p: ProjectRow) => {
    addToast("success", `Exporting chats for "${p.name}"…`);
  };

  return (
    <div className="proj-page">
      <ToastManager toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="proj-header">
        <div className="proj-header-left">
          <div className="proj-header-icon"><FolderOpen size={15} /></div>
          <span className="proj-header-title">Projects</span>
        </div>
        <button className="proj-add-btn" onClick={() => router.push("/setup")}>
          <Plus size={14} /> Add new project
        </button>
      </div>

      {/* Usage bar */}
      <WorkspaceUsageBar projects={projects} stats={stats} />

      {/* Stats cards */}
      <div className="proj-stats-row">
        <PromptsCard stats={stats} />
        <ModelsCostCard />
      </div>

      {/* Projects table */}
      <div className="proj-table-section">
        <div className="proj-table-header">
          <div>
            <div className="proj-table-title">Projects</div>
            <div className="proj-table-subtitle">Manage your projects</div>
          </div>
        </div>
        <div className="proj-table-controls">
          <div className="proj-tabs">
            {(["Customer", "Pitch"] as const).map((tab) => (
              <button
                key={tab}
                className={`proj-tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="proj-controls-right">
            <div className="proj-search-wrap">
              <Search size={13} className="proj-search-icon" />
              <input
                placeholder="Search projects"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="proj-table-add-btn" onClick={() => router.push("/setup")}>
              <Plus size={13} /> Add new project
            </button>
          </div>
        </div>

        <div className="proj-table-wrap">
          <table className="proj-table">
            <thead>
              <tr>
                <th onClick={() => handleSort("name")}>Project <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} /></th>
                <th onClick={() => handleSort("domain")}>Domain <SortIcon col="domain" sortCol={sortCol} sortDir={sortDir} /></th>
                <th onClick={() => handleSort("usedPrompts")}>Used / Allocated Prompts <SortIcon col="usedPrompts" sortCol={sortCol} sortDir={sortDir} /></th>
                <th>Models</th>
                <th onClick={() => handleSort("usedCredits")}>Used Credits <SortIcon col="usedCredits" sortCol={sortCol} sortDir={sortDir} /></th>
                <th onClick={() => handleSort("allocatedCredits")}>Allocated Credits <SortIcon col="allocatedCredits" sortCol={sortCol} sortDir={sortDir} /></th>
                <th onClick={() => handleSort("frequency")}>Frequency <SortIcon col="frequency" sortCol={sortCol} sortDir={sortDir} /></th>
                <th onClick={() => handleSort("createdAt")}>Created <SortIcon col="createdAt" sortCol={sortCol} sortDir={sortDir} /></th>
                <th onClick={() => handleSort("status")}>Status <SortIcon col="status" sortCol={sortCol} sortDir={sortDir} /></th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="proj-empty">
                    {search ? "No projects match your search." : "No projects yet — click \"Add new project\" to get started."}
                  </td>
                </tr>
              )}
              {filtered.map((p, i) => {
                const color = p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length];
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="proj-name-cell">
                        <span className="proj-color-dot" style={{ background: color }} />
                        <span className="proj-name-text">{p.name}</span>
                      </div>
                    </td>
                    <td><span className="proj-domain">{p.domain ?? "—"}</span></td>
                    <td>
                      <span className="proj-prompts-cell">
                        <span className="proj-prompts-used">{p.usedPrompts}</span>
                        <span className="proj-prompts-sep"> / </span>
                        <span className="proj-prompts-alloc">{p.allocatedPrompts}</span>
                      </span>
                    </td>
                    <td>
                      <ModelIconsCell
                        project={p}
                        onUpdate={(data) => handleUpdate(p.id, data)}
                        addToast={addToast}
                      />
                    </td>
                    <td className="proj-credits">{fmtNum(p.usedCredits)}</td>
                    <td className="proj-credits">{fmtNum(p.allocatedCredits)}</td>
                    <td><FreqBadge freq={p.frequency} /></td>
                    <td style={{ color: "#71717a", fontSize: 12 }}>{timeAgo(p.createdAt)}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>
                      <RowMenu
                        project={p}
                        onEditDetails={() => setEditDetailsProject(p)}
                        onTrackingSetup={() => setTrackingProject(p)}
                        onExport={() => handleExport(p)}
                        onToggle={() => handleToggle(p.id)}
                        onDelete={canDelete ? () => setDeleteTarget(p) : undefined}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Details modal */}
      {editDetailsProject && (
        <EditDetailsModal
          project={editDetailsProject}
          onClose={() => setEditDetailsProject(null)}
          onSave={async (data) => {
            await handleUpdate(editDetailsProject.id, data);
            addToast("success", "Project details updated");
            setEditDetailsProject(null);
          }}
        />
      )}

      {/* Tracking Setup modal */}
      {trackingProject && (
        <TrackingSetupModal
          project={trackingProject}
          onClose={() => setTrackingProject(null)}
          onSave={async (data) => {
            await handleUpdate(trackingProject.id, data);
            addToast("success", "Tracking setup updated");
            setTrackingProject(null);
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirm
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
