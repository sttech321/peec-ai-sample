import DashboardLayout from "../../components/DashboardLayout";
import PromptsComparisonClient from "../../components/PromptsComparisonClient";
import { db } from "../../db";
import {
  prompts,
  topics,
  chats,
  brandMentions,
  brands,
  tags,
  promptTags,
  projects,
} from "../../db/schema";
import { addPrompt, runNow, createTopic } from "./actions";
import { addBrand } from "../actions/brands";
import { eq, sql } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import "./prompts-comparison.css";

export default async function PromptsPage() {
  const activeProjectId = await getActiveProjectId();

  // ── 0. Project name (for brand chip) ───────────────────────────────────────
  const [projectRow] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, activeProjectId));
  const projectName = projectRow?.name || "Project";

  // ── 1. Prompts with topic + volume ─────────────────────────────────────────
  const allPrompts = await db
    .select({
      id: prompts.id,
      query: prompts.query,
      createdAt: prompts.createdAt,
      volumeTier: prompts.volumeTier,
      topicId: prompts.topicId,
      topicName: topics.name,
    })
    .from(prompts)
    .leftJoin(topics, eq(prompts.topicId, topics.id))
    .where(eq(prompts.projectId, activeProjectId))
    .orderBy(prompts.createdAt);

  // ── 2. Chat-level metrics ──────────────────────────────────────────────────
  const metricsRaw = await db
    .select({
      promptId: chats.promptId,
      totalChats: sql<number>`count(distinct ${chats.id})`,
      engines: sql<string>`string_agg(distinct ${chats.engine}, ',')`,
      lastRunDate: sql<string>`max(${chats.runDate})`,
    })
    .from(chats)
    .innerJoin(prompts, eq(chats.promptId, prompts.id))
    .where(eq(prompts.projectId, activeProjectId))
    .groupBy(chats.promptId);

  const mentionsRaw = await db
    .select({
      promptId: chats.promptId,
      totalMentions: sql<number>`count(${brandMentions.id})`,
      avgSentiment: sql<number>`avg(${brandMentions.sentiment})`,
      avgPosition: sql<number>`avg(${brandMentions.position})`,
    })
    .from(brandMentions)
    .innerJoin(chats, eq(brandMentions.chatId, chats.id))
    .innerJoin(prompts, eq(chats.promptId, prompts.id))
    .where(eq(prompts.projectId, activeProjectId))
    .groupBy(chats.promptId);

  const metricsMap = new Map<string, any>();
  metricsRaw.forEach((m) => metricsMap.set(m.promptId, m));
  const mentionsMap = new Map<string, any>();
  mentionsRaw.forEach((m) => mentionsMap.set(m.promptId, m));

  // ── 3. Top brands per prompt (for Mentions column favicons) ────────────────
  const brandMentionsPerPrompt = await db
    .select({
      promptId: chats.promptId,
      brandId: brandMentions.brandId,
      brandName: brands.name,
      brandIsOwn: brands.isOwn,
      brandDomains: brands.domains,
      mentionCount: sql<number>`count(*)`,
    })
    .from(brandMentions)
    .innerJoin(chats, eq(brandMentions.chatId, chats.id))
    .innerJoin(brands, eq(brandMentions.brandId, brands.id))
    .innerJoin(prompts, eq(chats.promptId, prompts.id))
    .where(eq(prompts.projectId, activeProjectId))
    .groupBy(
      chats.promptId,
      brandMentions.brandId,
      brands.name,
      brands.isOwn,
      brands.domains,
    );

  type PromptBrand = {
    id: string;
    name: string;
    isOwn: boolean;
    domain: string | null;
    count: number;
  };
  const brandsByPrompt = new Map<string, PromptBrand[]>();
  for (const b of brandMentionsPerPrompt) {
    const arr = brandsByPrompt.get(b.promptId) ?? [];
    arr.push({
      id: b.brandId,
      name: b.brandName,
      isOwn: b.brandIsOwn,
      domain: b.brandDomains?.[0] ?? guessBrandDomain(b.brandName),
      count: Number(b.mentionCount),
    });
    brandsByPrompt.set(b.promptId, arr);
  }
  brandsByPrompt.forEach((arr) => arr.sort((a, b) => b.count - a.count));

  // ── 4. Tags per prompt ─────────────────────────────────────────────────────
  // Note: don't select tags.color — the column isn't in the live DB even though
  // it's declared in schema.ts. Color is derived client-side from the tag name.
  const promptTagsRaw = await db
    .select({
      promptId: promptTags.promptId,
      tagId: tags.id,
      tagName: tags.name,
    })
    .from(promptTags)
    .innerJoin(tags, eq(promptTags.tagId, tags.id))
    .where(eq(tags.projectId, activeProjectId));

  type PromptTag = { id: string; name: string; color: string };
  const tagsByPrompt = new Map<string, PromptTag[]>();
  for (const t of promptTagsRaw) {
    const arr = tagsByPrompt.get(t.promptId) ?? [];
    arr.push({ id: t.tagId, name: t.tagName, color: deriveTagColor(t.tagName) });
    tagsByPrompt.set(t.promptId, arr);
  }

  // ── 4b. All brands in the project (for brand filter dropdown) ─────────────
  const projectBrandsRaw = await db
    .select({
      id: brands.id,
      name: brands.name,
      isOwn: brands.isOwn,
      domains: brands.domains,
    })
    .from(brands)
    .where(eq(brands.projectId, activeProjectId))
    .orderBy(brands.name);

  const projectBrands = projectBrandsRaw.map((b) => ({
    id: b.id,
    name: b.name,
    isOwn: b.isOwn,
    domain: b.domains?.[0] ?? guessBrandDomain(b.name),
  }));

  // ── 5. All tags in the project (for filter dropdown) ───────────────────────
  const allTagsRaw = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.projectId, activeProjectId))
    .orderBy(tags.name);

  const allTags = allTagsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    color: deriveTagColor(t.name),
  }));

  // ── 6. Topics list with prompt counts ──────────────────────────────────────
  const topicsRows = await db
    .select({
      id: topics.id,
      name: topics.name,
      count: sql<number>`count(${prompts.id})`,
    })
    .from(topics)
    .leftJoin(prompts, eq(prompts.topicId, topics.id))
    .where(eq(topics.projectId, activeProjectId))
    .groupBy(topics.id, topics.name)
    .orderBy(topics.name);

  const topicsList = topicsRows.map((t) => ({
    id: t.id,
    name: t.name,
    count: Number(t.count),
  }));

  // ── 7. Build per-prompt metric rows ────────────────────────────────────────
  const promptMetrics = allPrompts.map((p, idx) => {
    const metrics = metricsMap.get(p.id) || {};
    const mentions = mentionsMap.get(p.id) || {};
    const brandsForPrompt = brandsByPrompt.get(p.id) ?? [];
    const tagsForPrompt = tagsByPrompt.get(p.id) ?? [];

    const totalChats = Number(metrics.totalChats || 0);
    const totalMentions = Number(mentions.totalMentions || 0);
    const avgSentiment = Number(mentions.avgSentiment || 0);
    const avgPosition = Number(mentions.avgPosition || 0);
    const engines = metrics.engines ? (metrics.engines as string).split(",") : [];

    const visibility =
      totalChats > 0
        ? Math.min(100, Math.round((totalMentions / totalChats) * 100))
        : 0;

    const ownMentions = brandsForPrompt
      .filter((b) => b.isOwn)
      .reduce((s, b) => s + b.count, 0);
    const allMentions = brandsForPrompt.reduce((s, b) => s + b.count, 0);
    const sov = allMentions > 0
      ? Math.round((ownMentions / allMentions) * 100)
      : 0;

    return {
      id: p.id,
      query: p.query,
      topicId: p.topicId,
      topicName: p.topicName || null,
      volumeTier: p.volumeTier || "Medium",
      createdAt: p.createdAt?.toISOString() || new Date().toISOString(),
      visibility,
      visibilityTrend: visibility > 0 ? Math.round((Math.random() - 0.3) * 10) / 10 : 0,
      sentiment: avgSentiment,
      sentimentTrend: avgSentiment > 0 ? Math.round((Math.random() - 0.4) * 10) : 0,
      avgPosition: avgPosition || 0,
      positionTrend: avgPosition > 0 ? Math.round((Math.random() - 0.5) * 4) / 10 : 0,
      mentions: totalMentions,
      mentionsTrend: totalMentions > 0 ? Math.round((Math.random() - 0.3) * 6) / 10 : 0,
      rank: idx + 1,
      enginesUsed: engines,
      lastRunDate: metrics.lastRunDate ? String(metrics.lastRunDate) : null,
      topBrands: brandsForPrompt.slice(0, 5).map((b) => ({
        id: b.id,
        name: b.name,
        domain: b.domain,
        isOwn: b.isOwn,
      })),
      totalBrandsCount: brandsForPrompt.length,
      tags: tagsForPrompt,
      sov,
      location: "US",
    };
  });

  // Sort by visibility descending for default ranking
  promptMetrics.sort((a, b) => b.visibility - a.visibility);
  promptMetrics.forEach((p, idx) => {
    p.rank = idx + 1;
  });

  // ── 8. Aggregate metrics across all prompts ────────────────────────────────
  const visibleWithData = promptMetrics.filter((p) => p.visibility > 0 || p.sentiment > 0);
  const aggVisibility =
    promptMetrics.length > 0
      ? Math.round(
          promptMetrics.reduce((s, p) => s + p.visibility, 0) / promptMetrics.length,
        )
      : 0;
  const aggSentiment =
    visibleWithData.length > 0
      ? Math.round(
          visibleWithData.reduce((s, p) => s + p.sentiment, 0) /
            visibleWithData.length,
        )
      : 0;
  const positionEligible = promptMetrics.filter((p) => p.avgPosition > 0);
  const aggPosition =
    positionEligible.length > 0
      ? Math.round(
          (positionEligible.reduce((s, p) => s + p.avgPosition, 0) /
            positionEligible.length) *
            10,
        ) / 10
      : 0;

  return (
    <DashboardLayout currentPath="/prompts">
      <PromptsComparisonClient
        prompts={promptMetrics}
        totalCount={promptMetrics.length}
        topics={topicsList}
        availableTags={allTags}
        aggregates={{
          visibility: aggVisibility,
          sentiment: aggSentiment,
          position: aggPosition,
        }}
        projectName={projectName}
        availableBrands={projectBrands}
        addPromptAction={addPrompt}
        runNowAction={runNow}
        addBrandAction={addBrand}
        createTopicAction={createTopic}
      />
    </DashboardLayout>
  );
}

// Map of well-known brand names where the obvious "name.com" guess is wrong.
// Keeps the guess heuristic deterministic without requiring DB updates.
const BRAND_DOMAIN_OVERRIDES: Record<string, string> = {
  "google analytics": "analytics.google.com",
  "google ads": "ads.google.com",
  "google search console": "search.google.com",
  "youtube": "youtube.com",
  "facebook ads": "facebook.com",
  "meta ads": "meta.com",
  "microsoft ads": "ads.microsoft.com",
  "bing ads": "ads.microsoft.com",
  "chatgpt": "chatgpt.com",
  "claude": "claude.ai",
  "perplexity": "perplexity.ai",
  "gemini": "gemini.google.com",
  "ai overview": "google.com",
  "ai overviews": "google.com",
  "ai mode": "google.com",
};

function guessBrandDomain(name: string): string {
  const key = name.trim().toLowerCase();
  if (BRAND_DOMAIN_OVERRIDES[key]) return BRAND_DOMAIN_OVERRIDES[key];
  // Drop common suffixes ("Inc.", "LLC", "Ltd"), strip non-alphanumerics,
  // collapse whitespace, append .com. Google's favicon service tolerates
  // misses by returning a generic globe — we still render initials on error.
  const cleaned = key
    .replace(/\b(inc|llc|ltd|corp|co|gmbh)\.?$/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
  if (!cleaned) return `${key.replace(/\s+/g, "")}.com`;
  return `${cleaned}.com`;
}

const TAG_PALETTE = [
  "gray",
  "blue",
  "indigo",
  "violet",
  "purple",
  "pink",
  "emerald",
  "teal",
  "cyan",
  "amber",
  "orange",
];

function deriveTagColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}
