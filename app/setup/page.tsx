"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { INITIAL_SETUP_STATE, SetupState, SetupStep, SetupTopic, timezoneForCountryName } from "../../lib/setup-types";
import { BrandProfile } from "../../lib/brand-profile-types";
import {
  generateBrandProfile,
  generateTopics,
  finalizeSetup,
} from "./actions";

import SetupShell from "../../components/setup/SetupShell";
import WizardStepper from "../../components/setup/WizardStepper";
import PreviewPane from "../../components/setup/PreviewPane";
import ProjectDetailsStep from "../../components/setup/ProjectDetailsStep";
import BrandProfileStep from "../../components/setup/BrandProfileStep";
import GeneratingStep from "../../components/setup/GeneratingStep";
import TopicsStep from "../../components/setup/TopicsStep";
import PromptsStep from "../../components/setup/PromptsStep";

const STORAGE_KEY = "tv_setup_state_v1";

function loadState(): SetupState {
  if (typeof window === "undefined") return INITIAL_SETUP_STATE;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_SETUP_STATE;
    const parsed = JSON.parse(raw);
    return { ...INITIAL_SETUP_STATE, ...parsed };
  } catch {
    return INITIAL_SETUP_STATE;
  }
}

function persistState(s: SetupState) {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export default function SetupPage() {
  const router = useRouter();
  const [state, setState] = useState<SetupState>(INITIAL_SETUP_STATE);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Hydrate from sessionStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    setState(loadState());
  }, []);

  // Persist every state change
  useEffect(() => {
    persistState(state);
  }, [state]);

  const patch = (p: Partial<SetupState>) => setState((s) => ({ ...s, ...p }));
  const patchProfile = (next: BrandProfile) => patch({ profile: next });
  const goto = (step: SetupStep) => {
    setError(null);
    patch({ step });
  };

  // ── Step transitions ──────────────────────────────────────────────
  const handleStep1Next = () => {
    setError(null);
    patch({ step: "generating" });
    startTransition(async () => {
      const res = await generateBrandProfile({ url: state.url, brandName: state.brandName });
      if (!res.ok) {
        setError(res.error);
        patch({ step: 1 });
        return;
      }
      patch({
        profile: {
          ...res.profile,
          companyName: state.brandName,
        },
        step: 2,
      });
    });
  };

  const handleStep2Next = () => {
    setError(null);
    patch({ step: "generating" });
    startTransition(async () => {
      const res = await generateTopics(state.profile, state.language);
      if (!res.ok) {
        setError("Failed to generate topics");
        patch({ step: 2 });
        return;
      }
      patch({ topics: res.topics, step: 3 });
    });
  };

  // Show different label on generating screen depending on direction
  const generatingLabel = state.topics.length === 0
    ? "Generating brand profile..."
    : "Generating topics & prompts...";

  const handleFinish = () => {
    setError(null);
    startTransition(async () => {
      const res = await finalizeSetup({
        brandName: state.brandName,
        url: state.url,
        location: state.location,
        language: state.language,
        timezone: state.timezone,
        profile: state.profile,
        topics: state.topics,
      });
      if (!res.ok) {
        setError(res.error ?? "Failed to create project");
        return;
      }
      sessionStorage.removeItem(STORAGE_KEY);
      // Store new prompts so prompts page can auto-crawl them on first load
      if (res.newPrompts && res.newPrompts.length > 0) {
        sessionStorage.setItem("setup_auto_crawl", JSON.stringify(res.newPrompts));
      }
      window.location.replace("/prompts");
    });
  };

  const handleLogout = async () => {
    sessionStorage.removeItem(STORAGE_KEY);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/landing";
  };

  // ── Render the current step ───────────────────────────────────────
  let leftPane: React.ReactNode;
  if (state.step === 1) {
    leftPane = (
      <>
        <WizardStepper
          step={1}
          total={5}
          title="Add project details"
          subtitle="Track your brand visibility in AI responses. Project details will not be used for tracking."
        />
        <ProjectDetailsStep
          url={state.url}
          brandName={state.brandName}
          location={state.location}
          language={state.language}
          timezone={state.timezone}
          onUrlChange={(v) => patch({ url: v })}
          onBrandNameChange={(v) => patch({ brandName: v })}
          onLocationChange={(v) => {
            // Auto-select that country's time zone; the user can still change it.
            const tz = timezoneForCountryName(v);
            patch(tz ? { location: v, timezone: tz } : { location: v });
          }}
          onLanguageChange={(v) => patch({ language: v })}
          onTimezoneChange={(v) => patch({ timezone: v })}
          onNext={handleStep1Next}
          loading={pending}
          error={error}
        />
      </>
    );
  } else if (state.step === 2) {
    leftPane = (
      <>
        <WizardStepper
          step={2}
          total={5}
          title="Verify brand profile"
          subtitle="Define your brand's identity, location, and positioning."
        />
        <BrandProfileStep
          profile={state.profile}
          onChange={patchProfile}
          onBack={() => goto(1)}
          onNext={handleStep2Next}
          error={error}
        />
      </>
    );
  } else if (state.step === "generating") {
    leftPane = <GeneratingStep label={generatingLabel} />;
  } else if (state.step === 3) {
    leftPane = (
      <>
        <WizardStepper
          step={3}
          total={5}
          title="Review Topics"
          subtitle="We'll create specific prompts for each topic and will provide insight how AI relates these areas to your brand. You can add more topics later."
        />
        <TopicsStep
          topics={state.topics}
          onChange={(t: SetupTopic[]) => patch({ topics: t })}
          onBack={() => goto(2)}
          onNext={() => goto(4)}
        />
      </>
    );
  } else if (state.step === 4) {
    leftPane = (
      <>
        <WizardStepper
          step={4}
          total={5}
          title="Review Prompts"
          subtitle="We'll create specific prompts for each topic and will provide insight how AI relates these areas to your brand. You can add more prompts later."
        />
        <PromptsStep
          topics={state.topics}
          onChange={(t: SetupTopic[]) => patch({ topics: t })}
          onBack={() => goto(3)}
          onFinish={handleFinish}
          loading={pending}
          error={error}
        />
      </>
    );
  }

  return (
    <SetupShell
      left={leftPane}
      right={<PreviewPane state={state} />}
      onLogout={handleLogout}
    />
  );
}
