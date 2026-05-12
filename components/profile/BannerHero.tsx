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
  "#a16f3f", // brown (matches Peec)
  "#4f46e5", // indigo
  "#0f766e", // teal
  "#be185d", // pink
  "#0f172a", // slate-900
  "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
  "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
];

function normalizeDomain(input: string): string {
  if (!input) return "";
  return input
    .trim()
    .toLowerCase()
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
  const [editingName, setEditingName] = useState(false);
  const [editingDomain, setEditingDomain] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const favicon = faviconUrl(domain);

  return (
    <div className="bp-hero">
      <div
        className="bp-hero-banner"
        style={{ background: bannerColor }}
      >
        <div className="bp-hero-banner-actions">
          <button
            type="button"
            className="bp-hero-action-btn"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Change banner color"
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
                onClick={() => {
                  onBannerColorChange(bg);
                  setShowColorPicker(false);
                }}
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

      <div className="bp-hero-info">
        <div className="bp-hero-logo-wrapper">
          <div className="bp-hero-logo" title={domain ? `Favicon for ${normalizeDomain(domain)}` : "Add a domain to fetch favicon"}>
            {favicon && !imgFailed ? (
              <img
                src={favicon}
                alt={`${normalizeDomain(domain)} favicon`}
                onError={() => setImgFailed(true)}
                onLoad={() => setImgFailed(false)}
              />
            ) : (
              <Building2 size={32} className="bp-hero-logo-fallback" />
            )}
          </div>
        </div>

        <div className="bp-hero-meta">
          {editingName ? (
            <input
              type="text"
              className="bp-hero-name-input"
              value={companyName}
              onChange={(e) => onCompanyNameChange(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
              autoFocus
              maxLength={120}
            />
          ) : (
            <h2
              className="bp-hero-name"
              onClick={() => setEditingName(true)}
              title="Click to edit"
            >
              {companyName || <span className="bp-placeholder">Untitled brand</span>}
            </h2>
          )}

          {editingDomain ? (
            <input
              type="text"
              className="bp-hero-domain-input"
              value={domain}
              onChange={(e) => {
                onDomainChange(e.target.value);
                setImgFailed(false);
              }}
              onBlur={() => setEditingDomain(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingDomain(false)}
              autoFocus
              placeholder="example.com"
            />
          ) : (
            <span
              className="bp-hero-domain"
              onClick={() => setEditingDomain(true)}
              title="Click to edit"
            >
              {domain ? normalizeDomain(domain) : <span className="bp-placeholder">Add domain</span>}
            </span>
          )}

          {industry && <span className="bp-hero-industry-badge">{industry}</span>}
        </div>
      </div>
    </div>
  );
}
