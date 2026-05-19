"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { BrandProfile, COUNTRY_OPTIONS, TRAIT_SUGGESTIONS } from "../../lib/brand-profile-types";
import TagInput from "../profile/TagInput";
import IndustrySelect from "../profile/IndustrySelect";
import AudienceSliders from "../profile/AudienceSliders";
import ServicesEditor from "../profile/ServicesEditor";

interface Props {
  profile: BrandProfile;
  onChange: (next: BrandProfile) => void;
  onBack: () => void;
  onNext: () => void;
  error?: string | null;
}

export default function BrandProfileStep({ profile, onChange, onBack, onNext, error }: Props) {
  const update = <K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) => {
    onChange({ ...profile, [key]: value });
  };

  const charCount = profile.description.length;
  const overLimit = charCount > 500;

  // Country name <-> alpha-2 helpers
  const nameByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of COUNTRY_OPTIONS) m.set(c.code, c.name);
    return m;
  }, []);
  const codeByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of COUNTRY_OPTIONS) m.set(c.name.toLowerCase(), c.code);
    return m;
  }, []);

  const addMarket = (codeOrName: string) => {
    const norm = codeOrName.trim();
    if (!norm) return;
    // Accept either an alpha-2 code (case-insensitive) or a country name.
    const upper = norm.toUpperCase();
    let code = nameByCode.has(upper) ? upper : codeByName.get(norm.toLowerCase());
    if (!code) return;
    if (profile.targetMarkets.includes(code)) return;
    update("targetMarkets", [...profile.targetMarkets, code]);
  };

  const removeMarket = (code: string) => {
    update("targetMarkets", profile.targetMarkets.filter((c) => c !== code));
  };

  const suggestedMarkets = useMemo(() => {
    const taken = new Set(profile.targetMarkets);
    const popular = ["CA", "GB", "DE", "FR", "ES", "IT", "AU", "IN", "JP"];
    return popular.filter((c) => !taken.has(c)).slice(0, 6);
  }, [profile.targetMarkets]);

  return (
    <div className="step2">
      <div className="step2-field">
        <label className="step2-label">Description</label>
        <p className="step2-hint">Context of your brand.</p>
        <textarea
          className={`step2-textarea ${overLimit ? "step2-error" : ""}`}
          value={profile.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Brand description..."
          rows={3}
          maxLength={520}
        />
      </div>

      <div className="step2-field">
        <label className="step2-label">Industry</label>
        <p className="step2-hint">Industry your brand.</p>
        <IndustrySelect
          value={profile.industry}
          onChange={(v) => update("industry", v)}
        />
      </div>

      <div className="step2-field">
        <label className="step2-label">Brand identity</label>
        <p className="step2-hint">The name of your project.</p>
        <TagInput
          value={profile.identityTraits}
          onChange={(v) => update("identityTraits", v)}
          placeholder="Add"
          maxTags={10}
          suggestions={TRAIT_SUGGESTIONS}
        />
      </div>

      <div className="step2-field">
        <label className="step2-label">Products & Services</label>
        <p className="step2-hint">What your brand offers.</p>
        <ServicesEditor
          value={profile.services}
          onChange={(v) => update("services", v)}
        />
      </div>

      <div className="step2-field">
        <label className="step2-label">Target markets</label>
        <p className="step2-hint">Where your brand operates.</p>
        <div className="bp-taginput">
          <div className="bp-taginput-row">
            {profile.targetMarkets.map((code) => (
              <span key={code} className="bp-tag">
                <span className="bp-map-chip-code" style={{ marginRight: 2 }}>{code}</span>
                {nameByCode.get(code) ?? code}
                <button
                  type="button"
                  className="bp-tag-remove"
                  onClick={() => removeMarket(code)}
                  aria-label={`Remove ${nameByCode.get(code) ?? code}`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <select
              className="bp-input"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  addMarket(e.target.value);
                  e.target.value = "";
                }
              }}
              style={{ width: "auto", minWidth: 140 }}
            >
              <option value="">Add region…</option>
              {COUNTRY_OPTIONS.filter((c) => !profile.targetMarkets.includes(c.code)).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {suggestedMarkets.length > 0 && (
            <div className="bp-taginput-suggestions">
              <span className="bp-taginput-suggestions-label">Suggestions:</span>
              {suggestedMarkets.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="bp-taginput-suggestion"
                  onClick={() => addMarket(c)}
                >
                  + {nameByCode.get(c)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="step2-field">
        <label className="step2-label">Audience distribution</label>
        <p className="step2-hint">Define your audience across user types.</p>
        <AudienceSliders
          value={profile.audienceDistribution}
          onChange={(v) => update("audienceDistribution", v)}
        />
      </div>

      {error && <div className="step1-error">{error}</div>}

      <div className="setup-nav setup-nav--row">
        <button type="button" className="setup-btn setup-btn--ghost" onClick={onBack}>Back</button>
        <button
          type="button"
          className="setup-btn setup-btn--primary"
          onClick={onNext}
          disabled={overLimit}
        >
          Next
        </button>
      </div>
    </div>
  );
}
