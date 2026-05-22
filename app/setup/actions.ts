"use server";

import { db } from "../../db";
import { projects, topics, prompts, brands, brandProfiles } from "../../db/schema";
import { getWorkspaceId } from "../../lib/project-context";
import { SETUP_DONE_COOKIE } from "../../lib/session";
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

const BRAND_PROFILE_SYSTEM = `You are a brand intelligence analyst. Given a brand name and domain, generate a realistic brand profile.

Return ONLY a valid JSON object with exactly these fields:
{
  "description": "2-3 sentence description of what the company does and its value proposition",
  "industry": "single industry label (e.g. Consumer Electronics, SaaS, Healthcare, Ecommerce, Finance, Marketing, AI, Cybersecurity, Education, Logistics, Travel, Media)",
  "identityTraits": ["4 to 6 single-word or short-phrase brand traits from: Premium, Innovative, Reliable, User-centric, Integrated ecosystem, Privacy-focused, Strategy-first, Results-driven, Technical, Friendly, Authoritative, Data-driven, Agile, Bold, Transparent"],
  "services": [
    {
      "name": "product or service name",
      "category": "category label",
      "description": "one short sentence",
      "keywords": ["2-4 relevant keywords"]
    }
  ],
  "targetMarkets": ["2-letter ISO country codes for top markets, e.g. US, GB, DE, JP, AU — list 2-5"]
}

services should list 3-6 real products/services the brand is known for. Return ONLY the JSON, no other text.`;

async function generateProfileWithLLM(
  brandName: string,
  domain: string,
): Promise<Partial<BrandProfile> | null> {
  const { keyState } = await import("../../lib/ai-clients");
  const userMsg = `Brand name: ${brandName}\nDomain: ${domain}\n\nGenerate a realistic brand profile for this company.`;

  // Try Anthropic first (fastest, with prompt caching)
  if (keyState(process.env.ANTHROPIC_API_KEY, ["sk-ant-"]).ok) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: [{ type: "text", text: BRAND_PROFILE_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMsg }],
      });
      const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (e) {
      console.error("[brand-profile] Anthropic failed:", (e as Error)?.message);
    }
  }

  // Fallback to OpenAI
  if (keyState(process.env.OPENAI_API_KEY, ["sk-"]).ok) {
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      const r = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: BRAND_PROFILE_SYSTEM },
          { role: "user", content: userMsg },
        ],
      });
      const raw = r.choices[0]?.message?.content ?? "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (e) {
      console.error("[brand-profile] OpenAI failed:", (e as Error)?.message);
    }
  }

  // Fallback to Groq
  if (keyState(process.env.GROQ_API_KEY, ["gsk_"]).ok) {
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({
        apiKey: process.env.GROQ_API_KEY!,
        baseURL: "https://api.groq.com/openai/v1",
      });
      const r = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: BRAND_PROFILE_SYSTEM },
          { role: "user", content: userMsg },
        ],
      });
      const raw = r.choices[0]?.message?.content ?? "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (e) {
      console.error("[brand-profile] Groq failed:", (e as Error)?.message);
    }
  }

  return null;
}

/**
 * Generate a brand profile from a URL + brand name.
 * Calls an LLM (Claude → OpenAI → Groq) to infer industry, identity traits,
 * products/services and target markets from the brand name and domain.
 * Falls back to a generic profile if no API key is configured.
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

  const name = args.brandName.trim();

  // Try LLM-based generation
  let llmData: Partial<BrandProfile> | null = null;
  try {
    llmData = await generateProfileWithLLM(name, domain);
  } catch {
    // non-fatal — fallback below
  }

  // Normalize services from LLM (ensure each has a uid)
  const rawServices = Array.isArray(llmData?.services) ? llmData!.services : [];
  const services = rawServices.slice(0, 6).map((s: { name?: string; category?: string; description?: string; keywords?: string[] }) => ({
    id: uid(),
    name: String(s?.name ?? "").trim() || "Core product",
    category: String(s?.category ?? "").trim(),
    description: String(s?.description ?? "").trim(),
    keywords: Array.isArray(s?.keywords) ? s.keywords.map(String) : [],
  }));

  const profile: BrandProfile = {
    ...EMPTY_BRAND_PROFILE,
    companyName: name,
    domain,
    description: typeof llmData?.description === "string" && llmData.description.trim()
      ? llmData.description.trim()
      : `${name} is a leading company that provides innovative products and services to customers worldwide.`,
    industry: typeof llmData?.industry === "string" && llmData.industry.trim()
      ? llmData.industry.trim()
      : "Technology",
    identityTraits: Array.isArray(llmData?.identityTraits) && llmData!.identityTraits.length > 0
      ? llmData!.identityTraits.slice(0, 6).map(String)
      : ["Innovative", "Reliable", "Customer-focused"],
    services: services.length > 0
      ? services
      : [{ id: uid(), name: "Core product", category: "Technology", description: `Primary offering from ${name}.`, keywords: [name.toLowerCase()] }],
    targetMarkets: Array.isArray(llmData?.targetMarkets) && llmData!.targetMarkets.length > 0
      ? llmData!.targetMarkets.slice(0, 5).map(String)
      : ["US"],
  };

  return { ok: true, profile };
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

const TOPICS_SYSTEM = `You are a brand AI visibility strategist. Given a brand profile, generate exactly 10 topic clusters that people search in AI engines when evaluating products/services in this space.

Return ONLY a valid JSON array of exactly 10 strings. Each topic should be:
- A category someone would ask an AI about (e.g. "Best Smartphones for Photography", "Consumer Electronics Comparison", "Premium Laptop Brands")
- Relevant to the brand's industry and products
- The kind of query where this brand might appear in AI results
- 3-6 words, title-case
Return ONLY the JSON array, no other text.`;

async function generateTopicsWithLLM(profile: BrandProfile): Promise<string[] | null> {
  const { keyState } = await import("../../lib/ai-clients");
  const summary = [
    `Brand: ${profile.companyName}`,
    `Domain: ${profile.domain}`,
    `Industry: ${profile.industry}`,
    `Description: ${profile.description}`,
    `Products: ${profile.services.map((s) => s.name).join(", ")}`,
    `Identity: ${profile.identityTraits.join(", ")}`,
  ].join("\n");

  if (keyState(process.env.ANTHROPIC_API_KEY, ["sk-ant-"]).ok) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: [{ type: "text", text: TOPICS_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: summary }],
      });
      const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr) && arr.length > 0) return arr.map(String).slice(0, 10);
      }
    } catch (e) {
      console.error("[topics] Anthropic failed:", (e as Error)?.message);
    }
  }

  if (keyState(process.env.OPENAI_API_KEY, ["sk-"]).ok) {
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      const r = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: TOPICS_SYSTEM },
          { role: "user", content: summary },
        ],
      });
      const raw = r.choices[0]?.message?.content ?? "";
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr) && arr.length > 0) return arr.map(String).slice(0, 10);
      }
    } catch (e) {
      console.error("[topics] OpenAI failed:", (e as Error)?.message);
    }
  }

  if (keyState(process.env.GROQ_API_KEY, ["gsk_"]).ok) {
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({
        apiKey: process.env.GROQ_API_KEY!,
        baseURL: "https://api.groq.com/openai/v1",
      });
      const r = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: TOPICS_SYSTEM },
          { role: "user", content: summary },
        ],
      });
      const raw = r.choices[0]?.message?.content ?? "";
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr) && arr.length > 0) return arr.map(String).slice(0, 10);
      }
    } catch (e) {
      console.error("[topics] Groq failed:", (e as Error)?.message);
    }
  }

  return null;
}

/**
 * Suggest 10 topic clusters based on the brand profile.
 * Calls LLM (Claude → OpenAI → Groq) for brand-specific topics.
 * Falls back to generic industry-matched topics.
 */
export async function generateTopics(profile: BrandProfile): Promise<{
  ok: true;
  topics: SetupTopic[];
}> {
  // Try LLM-generated topics
  let topicNames: string[] | null = null;
  try {
    topicNames = await generateTopicsWithLLM(profile);
  } catch {
    // non-fatal
  }

  // Fallback: industry-aware generic topics
  if (!topicNames || topicNames.length === 0) {
    const industry = profile.industry?.toLowerCase() ?? "";
    const base = [
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
    if (industry.includes("ecommerce")) base.unshift("E-commerce Platforms", "Shopping Cart Software");
    else if (industry.includes("saas")) base.unshift("SaaS Tools", "Product Analytics Platforms");
    else if (industry.includes("health")) base.unshift("Healthcare Platforms", "Telemedicine Software");
    else if (industry.includes("electronics") || industry.includes("consumer")) {
      base.unshift("Best Smartphones Comparison", "Consumer Electronics Reviews", "Wearable Technology Brands");
    } else if (industry.includes("finance") || industry.includes("fintech")) {
      base.unshift("Personal Finance Apps", "Investment Platforms", "Digital Banking Solutions");
    } else if (industry.includes("ai")) {
      base.unshift("AI Tools for Business", "Large Language Models", "AI Writing Assistants");
    }
    topicNames = base.slice(0, 10);
  }

  const topicList: SetupTopic[] = topicNames.map((name) => ({
    id: uid(),
    name,
    selected: true,
    prompts: generatePromptsForTopic(name, profile),
  }));

  return { ok: true, topics: topicList };
}

function generatePromptsForTopic(topic: string, profile: BrandProfile): SetupPrompt[] {
  const t = topic.toLowerCase();
  const brand = profile.companyName || "this brand";
  const stems = [
    `What are the best ${t} available right now?`,
    `Compare the top ${t} by features and pricing.`,
    `Which ${t} would you recommend for a growing business?`,
    `What makes ${brand} stand out among ${t}?`,
    `Suggest ${t} for users who value privacy and security.`,
    `List the most popular ${t} used by professionals.`,
    `What are affordable alternatives in the ${t} space?`,
    `Which ${t} are best for enterprise teams?`,
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

  // Resolve workspace ID the same way getAllProjects() does (Clerk → session → fallback)
  const workspaceId = await getWorkspaceId();
  const cookieStore = await cookies();

  // 1. Create project
  const [project] = await db
    .insert(projects)
    .values({ workspaceId, name: args.brandName.trim() })
    .returning();

  // 2. Brand profile
  const migratedProfile = migrateRegionsToMarkets(args.profile);
  await db.insert(brandProfiles).values({
    workspaceId,
    projectId: project.id,
    data: {
      ...migratedProfile,
      companyName: args.brandName.trim(),
      domain: cleanDomain(args.url),
    },
  });

  // 3. Own brand row
  await db.insert(brands).values({
    workspaceId,
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
      .values({ workspaceId, projectId: project.id, name: topic.name })
      .returning();

    const selectedPrompts = topic.prompts.filter((p) => p.selected);
    if (selectedPrompts.length === 0) continue;

    await db.insert(prompts).values(
      selectedPrompts.map((p) => ({
        workspaceId,
        projectId: project.id,
        topicId: topicRow.id,
        query: p.text,
        volumeTier: "Medium",
      })),
    );
  }

  // 5. Set active project + mark setup as complete
  const yearMaxAge = 60 * 60 * 24 * 365;
  cookieStore.set(ACTIVE_PROJECT_COOKIE, project.id, { path: "/", maxAge: yearMaxAge });
  cookieStore.set(SETUP_DONE_COOKIE, "1", { path: "/", maxAge: yearMaxAge });

  revalidatePath("/", "layout");

  return { ok: true, projectId: project.id };
}
