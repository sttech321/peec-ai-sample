"use client";

import { BrandProfile, TRAIT_SUGGESTIONS } from "../../lib/brand-profile-types";
import TagInput from "../profile/TagInput";
import IndustrySelect from "../profile/IndustrySelect";
import AudienceSliders from "../profile/AudienceSliders";
import ServicesEditor from "../profile/ServicesEditor";
import TargetMarketsMap from "../profile/TargetMarketsMap";

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

  return (
    <div className="step2">
      <div className="step2-field">
        <label className="step2-label">Description</label>
        <p className="step2-hint">Provide context about your brand and what it does.</p>
        <textarea
          className={`step2-textarea ${overLimit ? "step2-error" : ""}`}
          value={profile.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Brand description..."
          rows={3}
          maxLength={520}
        />
        <span style={{ fontSize: 11, color: overLimit ? "#dc2626" : "#94a3b8", textAlign: "right", display: "block", marginTop: 2 }}>
          {charCount}/500
        </span>
      </div>

      <div className="step2-field">
        <label className="step2-label">Industry</label>
        <p className="step2-hint">The primary industry your brand operates in.</p>
        <IndustrySelect
          value={profile.industry}
          onChange={(v) => update("industry", v)}
        />
      </div>

      <div className="step2-field">
        <label className="step2-label">Brand identity</label>
        <p className="step2-hint">Traits that define how your brand is perceived.</p>
        <TagInput
          value={profile.identityTraits}
          onChange={(v) => update("identityTraits", v)}
          placeholder="Add trait"
          maxTags={10}
          suggestions={TRAIT_SUGGESTIONS}
        />
      </div>

      <div className="step2-field">
        <label className="step2-label">Products &amp; Services</label>
        <p className="step2-hint">What your brand offers to customers.</p>
        <ServicesEditor
          value={profile.services}
          onChange={(v) => update("services", v)}
        />
      </div>

      <div className="step2-field">
        <label className="step2-label">Target markets</label>
        <p className="step2-hint">Countries or regions where your brand operates.</p>
        <TargetMarketsMap
          value={profile.targetMarkets}
          onChange={(v) => update("targetMarkets", v)}
        />
      </div>

      <div className="step2-field">
        <label className="step2-label">Audience distribution</label>
        <p className="step2-hint">Define your audience across user types. Percentages must total 100%.</p>
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
