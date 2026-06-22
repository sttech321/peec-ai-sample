"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  BrandProfile,
  BrandService,
  TRAIT_SUGGESTIONS,
} from "../lib/brand-profile-types";
import { saveBrandProfile } from "../app/actions/profile";

import SectionCard from "./profile/SectionCard";
import TagInput from "./profile/TagInput";
import IndustrySelect from "./profile/IndustrySelect";
import BannerHero from "./profile/BannerHero";
import AudienceSliders from "./profile/AudienceSliders";
import TargetMarketsMap from "./profile/TargetMarketsMap";
import SaveBar from "./profile/SaveBar";

interface Props {
  initialProfile: BrandProfile;
}

const AUTOSAVE_DEBOUNCE_MS = 1500;

const SERVICE_SUGGESTIONS = [
  "SEO",
  "Paid Media",
  "Content Marketing",
  "Web Design",
  "Email Marketing",
  "Social Media",
  "Analytics",
  "Conversion Rate Optimization",
];

// services[] is BrandService[]; the profile page shows them as simple tags.
function servicesToTags(services: BrandService[]): string[] {
  return services.map((s) => s.name).filter(Boolean);
}

function tagsToServices(tags: string[], previous: BrandService[]): BrandService[] {
  return tags.map((name) => {
    const existing = previous.find((p) => p.name === name);
    return (
      existing ?? {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `svc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        category: "",
        description: "",
        keywords: [],
      }
    );
  });
}

export default function BrandProfileClient({ initialProfile }: Props) {
  const [profile, setProfile] = useState<BrandProfile>(initialProfile);
  const [savedSnapshot, setSavedSnapshot] = useState<BrandProfile>(initialProfile);
  const [saving, startSaving] = useTransition();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(savedSnapshot),
    [profile, savedSnapshot],
  );

  const update = <K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }));
  };

  const persist = useCallback((p: BrandProfile) => {
    startSaving(async () => {
      setError(null);
      const res = await saveBrandProfile(p);
      if (!res.ok) {
        setError(res.error ?? "Failed to save");
        return;
      }
      setSavedSnapshot(p);
      setLastSaved(new Date());
    });
  }, []);

  // Autosave (debounced)
  useEffect(() => {
    if (!dirty) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => persist(profile), AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [profile, dirty, persist]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleManualSave = () => persist(profile);
  const handleDiscard = () => {
    setProfile(savedSnapshot);
    setError(null);
  };

  const serviceTags = servicesToTags(profile.services);

  return (
    <div className="bp-page max-w-[728px]">
      <header className="bp-page-header">
        <h1 className="bp-page-title">Brand profile</h1>
        <p className="bp-page-subtitle">
          Define your brand’s identity, audience, and positioning. Changes will be used to
          generate prompt suggestions.
        </p>
      </header>

      <BannerHero
        companyName={profile.companyName}
        domain={profile.domain}
        bannerColor={profile.bannerColor}
        industry={profile.industry}
        onCompanyNameChange={(v) => update("companyName", v)}
        onDomainChange={(v) => update("domain", v)}
        onBannerColorChange={(v) => update("bannerColor", v)}
      />

      <SectionCard title="Description" description="Context of your brand.">
        <textarea
          className="bp-textarea"
          value={profile.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Describe your company, positioning, products, and audience…"
          rows={3}
          maxLength={520}
        />
      </SectionCard>

      <SectionCard title="Industry" description="Industry of your brand.">
        <IndustrySelect
          value={profile.industry}
          onChange={(v) => update("industry", v)}
        />
      </SectionCard>

      <SectionCard title="Brand identity" description="Adjectives that define your brand.">
        <TagInput
          value={profile.identityTraits}
          onChange={(v) => update("identityTraits", v)}
          placeholder="Add"
          maxTags={10}
          suggestions={TRAIT_SUGGESTIONS}
        />
      </SectionCard>

      <SectionCard title="Products & Services" description="What your brand offers.">
        <TagInput
          value={serviceTags}
          onChange={(tags) => update("services", tagsToServices(tags, profile.services))}
          placeholder="Add"
          maxTags={20}
          suggestions={SERVICE_SUGGESTIONS}
        />
      </SectionCard>

      <SectionCard title="Target markets" description="Where your brand operates.">
        <TargetMarketsMap
          value={profile.targetMarkets}
          onChange={(v) => update("targetMarkets", v)}
        />
      </SectionCard>

      <SectionCard
        title="Audience distribution"
        description="Define your audience across user types."
      >
        <AudienceSliders
          value={profile.audienceDistribution}
          onChange={(v) => update("audienceDistribution", v)}
        />
      </SectionCard>

      <SaveBar
        dirty={dirty}
        saving={saving}
        lastSaved={lastSaved}
        error={error}
        onSave={handleManualSave}
        onDiscard={handleDiscard}
      />
    </div>
  );
}
