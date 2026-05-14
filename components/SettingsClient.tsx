"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Save, Check } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProjectProp {
  id: string;
  name: string;
  domain: string | null;
}

// ── Early access features ─────────────────────────────────────────────────────

const EARLY_ACCESS_FEATURES = [
  {
    id: "synthetic-query-fanout",
    title: "Synthetic Query Fanout",
    description: "Predict follow-up queries that may be generated from a user's original search.",
  },
  {
    id: "command-palette",
    title: "Command Palette",
    description: "Jump to any page, prompt, domain, or URL from a single keyboard-driven command palette (Ctrl+K).",
  },
  {
    id: "chats-page",
    title: "Chats Page",
    description: "A dedicated chats page to browse, search, and filter all chats by keyword, date, model, country, tag, or topic.",
  },
  {
    id: "gaps-page",
    title: "Gaps Page",
    description: "A dedicated page to surface domains, URLs where competitors are mentioned but your brand is not.",
  },
];

const LS_COMPANY      = "st_company_settings";
const LS_TOGGLES      = "st_email_toggles";
const LS_EARLY_ACCESS = "st_early_access";

// Color palette for avatars — deterministic from project name
const AVATAR_COLORS = [
  "#6366f1", "#10b981", "#f43f5e", "#0ea5e9", "#3b82f6",
  "#f59e0b", "#8b5cf6", "#64748b", "#ec4899", "#14b8a6",
  "#ef4444", "#84cc16", "#f97316", "#06b6d4", "#a855f7",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function avatarInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function loadFromLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <label className="st-toggle-wrap" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="st-toggle-input"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="st-toggle-track" />
    </label>
  );
}

// ── Project avatar ─────────────────────────────────────────────────────────────

function ProjectAvatar({ name, domain }: { name: string; domain: string | null }) {
  const [imgError, setImgError] = useState(false);
  const color = avatarColor(name);
  const initials = avatarInitials(name);

  if (domain && !imgError) {
    return (
      <div className="st-avatar" style={{ background: "#f4f4f5" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4 }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className="st-avatar" style={{ background: color }}>
      {initials}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div className="st-toast">
      <Check size={14} className="st-toast-success" />
      {message}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsClient({ projects }: { projects: ProjectProp[] }) {
  const defaultCompany = { name: "Thrive Internet Marketing", domain: "thriveagency.com" };

  const [name, setName]       = useState(defaultCompany.name);
  const [domain, setDomain]   = useState(defaultCompany.domain);
  const [savedName, setSavedName]     = useState(defaultCompany.name);
  const [savedDomain, setSavedDomain] = useState(defaultCompany.domain);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultToggles = Object.fromEntries(projects.map(p => [p.id, false]));
  const [toggles, setToggles] = useState<Record<string, boolean>>(defaultToggles);
  const [activateAll, setActivateAll] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    const saved = loadFromLS<typeof defaultCompany>(LS_COMPANY, defaultCompany);
    setName(saved.name);
    setDomain(saved.domain);
    setSavedName(saved.name);
    setSavedDomain(saved.domain);
    const savedToggles = loadFromLS<Record<string, boolean>>(LS_TOGGLES, defaultToggles);
    setToggles(prev => ({ ...prev, ...savedToggles }));
    setActivateAll(loadFromLS<boolean>(LS_EARLY_ACCESS, false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirty = name !== savedName || domain !== savedDomain;

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  async function handleSave() {
    if (!isDirty || saving) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 650));
    setSavedName(name);
    setSavedDomain(domain);
    localStorage.setItem(LS_COMPANY, JSON.stringify({ name, domain }));
    setSaving(false);
    showToast("Company settings saved");
  }

  function handleToggle(id: string, value: boolean) {
    const next = { ...toggles, [id]: value };
    setToggles(next);
    localStorage.setItem(LS_TOGGLES, JSON.stringify(next));
  }

  function handleActivateAll(value: boolean) {
    setActivateAll(value);
    localStorage.setItem(LS_EARLY_ACCESS, JSON.stringify(value));
  }

  return (
    <div className="st-page">
      {/* Page header */}
      <div className="st-page-header">
        <span className="st-page-header-icon">
          <Building2 size={15} />
        </span>
        <h1 className="st-page-title">Company</h1>
      </div>

      {/* ── Edit Company card ─────────────────────────────────────────────── */}
      <div className="st-card">
        <div className="st-card-inner">
          <h2 className="st-card-title">Edit Company</h2>
          <div className="st-fields">
            <div className="st-field">
              <label className="st-label" htmlFor="st-name">Name</label>
              <input
                id="st-name"
                className="st-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Company name"
              />
            </div>
            <div className="st-field">
              <label className="st-label" htmlFor="st-domain">Domain</label>
              <input
                id="st-domain"
                className="st-input"
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="yourdomain.com"
              />
            </div>
          </div>
        </div>
        <div className="st-card-footer">
          <button
            className="st-save-btn"
            disabled={!isDirty || saving}
            onClick={handleSave}
          >
            {saving ? (
              <span className="st-save-btn-spinner" />
            ) : (
              <Save size={13} />
            )}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* ── Email preferences card ────────────────────────────────────────── */}
      <div className="st-card">
        <div className="st-card-inner">
          <h2 className="st-card-title">Email preferences</h2>
          <p className="st-email-subtitle">
            Choose which projects send you a bi-weekly performance report.
          </p>
          <div className="st-divider" />
          <div className="st-project-list">
            {projects.length === 0 ? (
              <div className="st-empty-projects">No projects found.</div>
            ) : (
              projects.map(p => (
                <div key={p.id} className="st-project-row">
                  <ToggleSwitch
                    id={`toggle-${p.id}`}
                    checked={toggles[p.id] ?? false}
                    onChange={v => handleToggle(p.id, v)}
                  />
                  <ProjectAvatar name={p.name} domain={p.domain} />
                  <span className="st-project-name">{p.name}</span>
                  {p.domain && (
                    <span className="st-project-domain">{p.domain}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Early access card ─────────────────────────────────────────────── */}
      <div className="st-card">
        <div className="st-card-inner">
          <h2 className="st-card-title">Early access</h2>

          <div className="st-ea-activate-row">
            <ToggleSwitch
              id="toggle-activate-all"
              checked={activateAll}
              onChange={handleActivateAll}
            />
            <span className="st-ea-activate-label">Activate all</span>
          </div>

          <div className="st-divider st-divider-ea" />

          <div className="st-ea-features">
            {EARLY_ACCESS_FEATURES.map(f => (
              <div key={f.id} className="st-ea-feature">
                <div className="st-ea-feature-title">{f.title}</div>
                <div className="st-ea-feature-desc">{f.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}
