"use client";

import { useState } from "react";
import { Building2, Palette } from "lucide-react";

interface Props {
  companyName: string;
  domain: string;
  bannerColor: string;
  industry: string;
  onCompanyNameChange: (v: string) => void;
  onDomainChange: (v: string) => void;
  onBannerColorChange: (v: string) => void;
}

const BANNER_PRESETS = [
  "#a16f3f", "#4f46e5", "#0f766e", "#be185d", "#0f172a",
  "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
  "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
];

function normalizeDomain(input: string): string {
  if (!input) return "";
  return input.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function faviconUrl(domain: string): string | null {
  const d = normalizeDomain(domain);
  if (!d || !d.includes(".")) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`;
}

export default function BannerHero({
  companyName, domain, bannerColor, industry,
  onCompanyNameChange, onDomainChange, onBannerColorChange,
}: Props) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingName, setEditingName]         = useState(false);
  const [editingDomain, setEditingDomain]     = useState(false);
  const [imgFailed, setImgFailed]             = useState(false);

  const favicon = faviconUrl(domain);

  return (
    <div className="bp-hero-card">

      {/* ── Banner ─────────────────────────────────────────────── */}
      <div className="bp-hero-banner" style={{ background: bannerColor }}>
        <div className="bp-hero-banner-actions">
          <button
            type="button"
            className="bp-hero-action-btn"
            onClick={() => setShowColorPicker(!showColorPicker)}
          >
            <Palette size={13} />
            <span>Banner</span>
          </button>
        </div>
        {showColorPicker && (
          <div className="bp-color-picker">
            {BANNER_PRESETS.map((bg) => (
              <button
                key={bg}
                type="button"
                className={`bp-color-swatch ${bg === bannerColor ? "active" : ""}`}
                style={{ background: bg }}
                onClick={() => { onBannerColorChange(bg); setShowColorPicker(false); }}
              />
            ))}
            <input
              type="color"
              value={bannerColor.startsWith("#") ? bannerColor : "#a16f3f"}
              onChange={(e) => onBannerColorChange(e.target.value)}
              className="bp-color-custom"
              title="Custom color"
            />
          </div>
        )}
      </div>

      {/* ── Footer: logo overlaps banner, name + domain below ───── */}
      <div className="bp-hero-footer">

        {/* Logo — block element, negative margin pulls it up into banner */}
        <div className="bp-hero-logo">
          {favicon && !imgFailed ? (
            <img
              src={favicon}
              alt={`${normalizeDomain(domain)} favicon`}
              onError={() => setImgFailed(true)}
              onLoad={() => setImgFailed(false)}
            />
          ) : (
            <Building2 size={28} className="bp-hero-logo-fallback" />
          )}
        </div>

        {/* Company name */}
        {editingName ? (
          <input
            type="text"
            className="bp-hero-name-edit"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
            autoFocus
            maxLength={120}
            placeholder="Your brand name"
          />
        ) : (
          <h2 className="bp-hero-name" onClick={() => setEditingName(true)} title="Click to edit">
            {companyName || <span className="bp-placeholder">Untitled brand</span>}
          </h2>
        )}

        {/* Domain */}
        {editingDomain ? (
          <input
            type="text"
            className="bp-hero-domain-edit"
            value={domain}
            onChange={(e) => { onDomainChange(e.target.value); setImgFailed(false); }}
            onBlur={() => setEditingDomain(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingDomain(false)}
            autoFocus
            placeholder="example.com"
          />
        ) : (
          <span className="bp-hero-domain" onClick={() => setEditingDomain(true)} title="Click to edit">
            {domain ? normalizeDomain(domain) : <span className="bp-placeholder">Add domain</span>}
          </span>
        )}
      </div>
    </div>
  );
}
