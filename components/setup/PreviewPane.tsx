"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { SetupState } from "../../lib/setup-types";

interface Props {
  state: SetupState;
}

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

function PreviewFavicon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false);
  const url = faviconUrl(domain);
  // Reset failure when domain changes so a previously-failed URL retries
  // after the user edits the input.
  // (useState key trick via key prop on the img element below.)
  if (!url || failed) {
    return <Building2 size={20} className="pv-mock-card-logo-fallback" />;
  }
  return (
    <img
      key={url}
      src={url}
      alt={`${normalizeDomain(domain)} favicon`}
      onError={() => setFailed(true)}
    />
  );
}

// Right-side mock preview that reflects the data being entered. The visual is
// intentionally skeleton-like so it reads as a placeholder rather than an
// active dashboard.
export default function PreviewPane({ state }: Props) {
  const { step, brandName, profile, topics, url } = state;

  if (step === 1) {
    return (
      <div className="pv-mock">
        <div className="pv-mock-projectchip">
          <span>📁</span>
          <span>{brandName || "Project"}</span>
        </div>
        <div className="pv-mock-row pv-mock-row--narrow">
          <span className="pv-skel pv-skel-line" style={{ width: "30%" }} />
          <span className="pv-skel pv-skel-line" style={{ width: "60%" }} />
        </div>
        <div className="pv-mock-chips">
          <span className="pv-skel pv-skel-chip" />
          <span className="pv-skel pv-skel-chip" />
          <span className="pv-skel pv-skel-chip" />
          <span className="pv-skel pv-skel-chip" />
          <span className="pv-skel pv-skel-chip" />
        </div>
        <div className="pv-mock-chart">
          <svg viewBox="0 0 400 100" preserveAspectRatio="none">
            <path
              d="M 0 60 C 60 70 100 30 200 50 C 300 70 360 30 400 60"
              stroke="#e2e8f0"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>
        <div className="pv-mock-rows">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="pv-mock-rowline">
              <span className="pv-skel pv-skel-square" />
              <span className="pv-skel pv-skel-line" style={{ width: `${50 + (i % 3) * 15}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 2 || step === "generating") {
    return (
      <div className="pv-mock pv-mock--profile">
        <h3 className="pv-mock-title">Brand profile</h3>
        <p className="pv-mock-subtitle">Define your brand's identity, location, and positioning.</p>

        <div className="pv-mock-card">
          <div className="pv-mock-card-banner" style={{ background: profile.bannerColor }} />
          <div className="pv-mock-card-logo">
            <PreviewFavicon domain={profile.domain || url} />
          </div>
        </div>

        <h4 className="pv-mock-brandname">{brandName || "Brand name"}</h4>
        <p className="pv-mock-domain">
          {normalizeDomain(profile.domain || url) || "domain.com"}
        </p>

        <div className="pv-mock-field">
          <label>Brand name</label>
          <div className="pv-mock-input">{brandName || <span className="pv-skel-text" />}</div>
        </div>

        <div className="pv-mock-field">
          <label>Description</label>
          <div className="pv-mock-input pv-mock-input--tall">
            {profile.description || <span className="pv-skel-text" />}
          </div>
        </div>

        <div className="pv-mock-field">
          <label>Industry</label>
          <div className="pv-mock-input">{profile.industry || <span className="pv-skel-text" />}</div>
        </div>

        <div className="pv-mock-field">
          <label>Brand identity</label>
          <div className="pv-mock-chips">
            {profile.identityTraits.length === 0 ? (
              <span className="pv-mock-add">Add +</span>
            ) : (
              profile.identityTraits.map((t) => (
                <span key={t} className="pv-mock-chip">{t}</span>
              ))
            )}
          </div>
        </div>

        <div className="pv-mock-field">
          <label>Products & Services</label>
          <div className="pv-mock-chips">
            {profile.services.length === 0 ? (
              <span className="pv-mock-add">Add +</span>
            ) : (
              profile.services.map((s) => (
                <span key={s.id} className="pv-mock-chip">{s.name || "Service"}</span>
              ))
            )}
          </div>
        </div>

        <div className="pv-mock-divider" />

        <h4 className="pv-mock-section-title">Audience distribution</h4>
        <p className="pv-mock-subtitle">Define your audience across user types.</p>
        <div className="pv-mock-audience-note">
          <span>ⓘ</span>
          <div>
            <strong>Who is this project for?</strong>
            <span>
              Select your audience to get more relevant prompt suggestions. Percentages must total 100%.
            </span>
          </div>
        </div>
        {profile.audienceDistribution.map((a) => (
          <div key={a.id} className="pv-mock-audience-row">
            <span className={`pv-mock-toggle ${a.enabled ? "on" : ""}`}>
              <span className="pv-mock-toggle-knob" />
            </span>
            <div className="pv-mock-audience-meta">
              <strong>{a.label}</strong>
              <small>{a.description}</small>
            </div>
            <span className="pv-mock-audience-pct">{a.weight}%</span>
          </div>
        ))}
      </div>
    );
  }

  if (step === 3 || step === 4) {
    return (
      <div className="pv-mock">
        <h3 className="pv-mock-title">Prompts</h3>
        <div className="pv-mock-chips" style={{ marginBottom: 16 }}>
          {[...Array(6)].map((_, i) => (
            <span key={i} className="pv-skel pv-skel-chip" />
          ))}
        </div>

        <div className="pv-mock-twocol">
          <div className="pv-mock-twocol-left">
            <div className="pv-mock-twocol-header">
              <span>📁</span>
              <span>Topics</span>
            </div>
            <div className="pv-mock-twocol-row pv-mock-twocol-row--muted">
              <span>📁</span>
              <span>All topics</span>
            </div>
            <div className="pv-mock-twocol-row pv-mock-twocol-row--muted">
              <span>+</span>
              <span>Add topic</span>
            </div>
            <div className="pv-mock-twocol-divider" />
            {topics.filter((t) => t.selected).slice(0, 6).map((t) => (
              <div key={t.id} className="pv-mock-twocol-row">
                {t.name.length > 22 ? t.name.slice(0, 22) + "…" : t.name}
              </div>
            ))}
            {topics.filter((t) => t.selected).length === 0 &&
              [...Array(5)].map((_, i) => (
                <div key={i} className="pv-mock-twocol-row">
                  <span className="pv-skel pv-skel-line" style={{ width: "80%" }} />
                </div>
              ))}
          </div>
          <div className="pv-mock-twocol-right">
            <div className="pv-mock-twocol-header">
              <span>📁</span>
              {step === 4 ? (
                <span>{topics.find((t) => t.selected)?.name || "Topic"}</span>
              ) : (
                <span className="pv-skel pv-skel-line" style={{ width: 120 }} />
              )}
            </div>
            <div className="pv-mock-search">
              <span>🔍</span>
              <span>Search prompts</span>
            </div>
            {step === 4 && topics.find((t) => t.selected)?.prompts.filter((p) => p.selected).slice(0, 8).map((p) => (
              <div key={p.id} className="pv-mock-prompt-row">
                {p.text}
              </div>
            ))}
            {step === 3 && [...Array(6)].map((_, i) => (
              <div key={i} className="pv-mock-prompt-row">
                <span className="pv-skel pv-skel-line" style={{ width: `${60 + (i % 3) * 15}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
