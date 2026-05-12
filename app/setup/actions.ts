"use server";

import { db } from "../../db";
import { projects, topics, prompts, brands, brandProfiles } from "../../db/schema";
import { WORKSPACE } from "../../lib/project-context";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { BrandProfile, COUNTRY_OPTIONS, EMPTY_BRAND_PROFILE } from "../../lib/brand-profile-types";
import { SetupTopic, SetupPrompt } from "../../lib/setup-types";

const ACTIVE_PROJECT_COOKIE = "active_project_id";

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function cleanDomain(url: string): string {
  return url.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

/**
 * Generate a brand profile from a URL + brand name.
 * Stubbed: returns deterministic content. In production this would scrape the
 * URL and call an LLM via lib/ai-clients.ts.
 */
export async function generateBrandProfile(args: {
  url: string;
  brandName: string;
}): Promise<{ ok: true; profile: BrandProfile } | { ok: false; error: string }> {
  const domain = cleanDomain(args.url);
  if (!domain || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
    return { ok: false, error: "Enter a valid URL" };
  }
  if (!args.brandName.trim()) {
    return { ok: false, error: "Brand name is required" };
  }

  // Simulate ~1.5s LLM round-trip so the loading screen feels real
  await new Promise((r) => setTimeout(r, 1500));

  const name = args.brandName.trim();
  const inferred: BrandProfile = {
    ...EMPTY_BRAND_PROFILE,
    companyName: name,
    domain,
    description: `${name} helps customers achieve measurable outcomes through a focused, modern product offering.`,
    industry: "Marketing",
    identityTraits: ["Innovative", "Reliable", "Customer-focused"],
    services: [
      {
        id: uid(),
        name: "Core product",
        category: "SaaS",
        description: "Primary offering for end users.",
        keywords: [name.toLowerCase()],
      },
    ],
    targetMarkets: ["US"],
  };
  return { ok: true, profile: inferred };
}

// Translate any leftover region names (legacy `regions` field) into alpha-2
// codes so the saved profile always uses the canonical `targetMarkets` field.
function migrateRegionsToMarkets(profile: BrandProfile): BrandProfile {
  if (profile.targetMarkets.length > 0) return profile;
  if (!profile.regions || profile.regions.length === 0) return profile;
  const nameToCode = new Map<string, string>();
  for (const c of COUNTRY_OPTIONS) nameToCode.set(c.name.toLowerCase(), c.code);
  const migrated: string[] = [];
  for (const r of profile.regions) {
    const code = nameToCode.get(r.toLowerCase());
    if (code && !migrated.includes(code)) migrated.push(code);
  }
  return migrated.length > 0 ? { ...profile, targetMarkets: migrated } : profile;
}

/**
 * Suggest 10 topic clusters based on the brand profile. Stubbed list — in
 * production an LLM would derive these from description + services.
 */
export async function generateTopics(profile: BrandProfile): Promise<{
  ok: true;
  topics: SetupTopic[];
}> {
  await new Promise((r) => setTimeout(r, 900));

  // Base topics that work for any brand
  const baseNames = [
    "Content Marketing Platforms",
    "Digital Marketing Agencies",
    "Marketing Automation Software",
    "SEO Analytics Services",
    "Social Media Management Tools",
    "Customer Data Platforms",
    "Conversion Optimization Tools",
    "Email Marketing Software",
    "Influencer Marketing Platforms",
    "Affiliate Marketing Networks",
  ];

  // Slightly bias based on industry / services if present
  const industry = profile.industry?.toLowerCase() ?? "";
  if (industry.includes("ecommerce")) {
    baseNames.unshift("E-commerce Platforms", "Shopping Cart Software");
  } else if (industry.includes("saas")) {
    baseNames.unshift("SaaS Tools", "Product Analytics Platforms");
  } else if (industry.includes("health")) {
    baseNames.unshift("Healthcare Platforms", "Telemedicine Software");
  }

  const topicList: SetupTopic[] = baseNames.slice(0, 10).map((name) => ({
    id: uid(),
    name,
    selected: true,
    prompts: generatePromptsForTopic(name, profile),
  }));

  return { ok: true, topics: topicList };
}

function generatePromptsForTopic(topic: string, _profile: BrandProfile): SetupPrompt[] {
  const t = topic.toLowerCase();
  const stems = [
    `Identify ${t} with strong editorial calendar features.`,
    `Show me easy tools to manage my ${t.replace(/ platforms?$/, "")}.`,
    `Suggest reliable ${t} offering advanced analytics.`,
    `Recommend simple ${t} for beginners.`,
    `Compare enterprise-grade ${t} for scaling digital campaigns.`,
    `List top ${t} that are free to use.`,
    `Find ${t} with affordable monthly subscriptions.`,
    `Which ${t} are best for small teams?`,
  ];
  return stems.map((text) => ({ id: uid(), text, selected: true }));
}

/**
 * Final commit. Creates a project + brand_profile + topics + prompts + an
 * own brand row, sets the new project as active, returns the project id so
 * the client can redirect to the dashboard.
 */
export async function finalizeSetup(args: {
  brandName: string;
  url: string;
  location: string;
  language: string;
  timezone: string;
  profile: BrandProfile;
  topics: SetupTopic[];
}): Promise<{ ok: boolean; projectId?: string; error?: string }> {
  if (!args.brandName.trim()) return { ok: false, error: "Brand name is required" };
  const selectedTopics = args.topics.filter((t) => t.selected);
  if (selectedTopics.length === 0) return { ok: false, error: "Select at least one topic" };
  if (selectedTopics.every((t) => !t.prompts.some((p) => p.selected))) {
    return { ok: false, error: "Select at least one prompt" };
  }

  // 1. Create project
  const [project] = await db
    .insert(projects)
    .values({ workspaceId: WORKSPACE, name: args.brandName.trim() })
    .returning();

  // 2. Brand profile (jsonb) — migrate legacy `regions` into `targetMarkets`
  // so the profile page sees the selected countries.
  const migratedProfile = migrateRegionsToMarkets(args.profile);
  await db.insert(brandProfiles).values({
    workspaceId: WORKSPACE,
    projectId: project.id,
    data: {
      ...migratedProfile,
      companyName: args.brandName.trim(),
      domain: cleanDomain(args.url),
    },
  });

  // 3. Own brand row (so the brand appears in dropdowns as "You")
  await db.insert(brands).values({
    workspaceId: WORKSPACE,
    projectId: project.id,
    name: args.brandName.trim(),
    isOwn: true,
    aliases: [],
    domains: [cleanDomain(args.url)],
  });

  // 4. Topics + prompts (only selected ones)
  for (const topic of selectedTopics) {
    const [topicRow] = await db
      .insert(topics)
      .values({
        workspaceId: WORKSPACE,
        projectId: project.id,
        name: topic.name,
      })
      .returning();

    const selectedPrompts = topic.prompts.filter((p) => p.selected);
    if (selectedPrompts.length === 0) continue;

    await db.insert(prompts).values(
      selectedPrompts.map((p) => ({
        workspaceId: WORKSPACE,
        projectId: project.id,
        topicId: topicRow.id,
        query: p.text,
        volumeTier: "Medium",
      })),
    );
  }

  // 5. Switch active project cookie
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROJECT_COOKIE, project.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");

  return { ok: true, projectId: project.id };
}
