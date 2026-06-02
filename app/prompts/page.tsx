import DashboardLayout from "../../components/DashboardLayout";
import PromptsComparisonClient from "../../components/PromptsComparisonClient";
import { guessBrandDomain } from "../../lib/brand-domain";
import { db } from "../../db";
import { canEdit as canEditFn, canRunScans as canRunScansFn } from "../../lib/permissions";
import { getCurrentRole } from "../../lib/project-context";
import {
  prompts,
  topics,
  chats,
  brandMentions,
  brands,
  brandSuggestions,
  tags,
  promptTags,
  projects,
} from "../../db/schema";
import {
  addPrompt,
  addPromptsBulk,
  addPromptsFromCsv,
  addPromptsFromParsed,
  runNow,
  createTopic,
  assignTagToPromptByName,
  removeTagFromPrompt,
  batchAssignTag,
  batchAssignTopic,
  batchSetActive,
  batchDeletePrompts,
} from "./actions";
import { addBrand } from "../actions/brands";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import "./prompts-comparison.css";

export default async function PromptsPage() {
  const role = await getCurrentRole();
  const canEdit = canEditFn(role);
  const canRunScans = canRunScansFn(role);

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
      location: prompts.location,
      isActive: prompts.isActive,
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
      // Visibility is "chats with at least one brand mention / total chats"
      // (per docs/handoff/02-metrics-definitions.md), so we need the distinct
      // chat count here — NOT the raw mention count.
      chatsWithMentions: sql<number>`count(distinct ${chats.id})`,
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

  // ── 2b. Windowed metrics for real trend deltas ─────────────────────────────
  // Per handoff (peec-clone-handoff/02-metrics-definitions.md + 07-gotchas):
  // 7-day rolling beats daily noise. Trend = current 7-day window − previous
  // 7-day window. When either window has no data, trend = 0.
  const now = new Date();
  const recentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  type WindowRow = {
    promptId: string;
    totalChats: number;
    totalMentions: number;
    chatsWithMentions: number;
    ownMentions: number;
    avgSentiment: number | null;
    avgPosition: number | null;
  };

  async function loadWindow(start: Date, end?: Date): Promise<WindowRow[]> {
    const chatWhere = end
      ? and(
          eq(prompts.projectId, activeProjectId),
          gte(chats.runDate, start),
          lt(chats.runDate, end),
        )
      : and(eq(prompts.projectId, activeProjectId), gte(chats.runDate, start));

    const chatRows = await db
      .select({
        promptId: chats.promptId,
        totalChats: sql<number>`count(distinct ${chats.id})`,
      })
      .from(chats)
      .innerJoin(prompts, eq(chats.promptId, prompts.id))
      .where(chatWhere)
      .groupBy(chats.promptId);

    const mentionRows = await db
      .select({
        promptId: chats.promptId,
        totalMentions: sql<number>`count(${brandMentions.id})`,
        chatsWithMentions: sql<number>`count(distinct ${chats.id})`,
        ownMentions: sql<number>`sum(case when ${brands.isOwn} then 1 else 0 end)`,
        avgSentiment: sql<number>`avg(${brandMentions.sentiment})`,
        avgPosition: sql<number>`avg(${brandMentions.position})`,
      })
      .from(brandMentions)
      .innerJoin(chats, eq(brandMentions.chatId, chats.id))
      .innerJoin(prompts, eq(chats.promptId, prompts.id))
      .innerJoin(brands, eq(brandMentions.brandId, brands.id))
      .where(chatWhere)
      .groupBy(chats.promptId);

    const byId = new Map<string, WindowRow>();
    for (const r of chatRows) {
      byId.set(r.promptId, {
        promptId: r.promptId,
        totalChats: Number(r.totalChats || 0),
        totalMentions: 0,
        chatsWithMentions: 0,
        ownMentions: 0,
        avgSentiment: null,
        avgPosition: null,
      });
    }
    for (const r of mentionRows) {
      const existing = byId.get(r.promptId);
      if (existing) {
        existing.totalMentions = Number(r.totalMentions || 0);
        existing.chatsWithMentions = Number(r.chatsWithMentions || 0);
        existing.ownMentions = Number(r.ownMentions || 0);
        existing.avgSentiment = r.avgSentiment === null ? null : Number(r.avgSentiment);
        existing.avgPosition = r.avgPosition === null ? null : Number(r.avgPosition);
      }
    }
    return [...byId.values()];
  }

  const [recentRows, previousRows] = await Promise.all([
    loadWindow(recentStart),
    loadWindow(previousStart, recentStart),
  ]);

  const recentMap = new Map(recentRows.map((r) => [r.promptId, r]));
  const previousMap = new Map(previousRows.map((r) => [r.promptId, r]));

  function visibilityPct(row: WindowRow | undefined): number {
    if (!row || row.totalChats === 0) return 0;
    return (row.chatsWithMentions / row.totalChats) * 100;
  }
  function round1(n: number): number {
    return Math.round(n * 10) / 10;
  }

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
  const promptTagsRaw = await db
    .select({
      promptId: promptTags.promptId,
      tagId: tags.id,
      tagName: tags.name,
      tagColor: tags.color,
    })
    .from(promptTags)
    .innerJoin(tags, eq(promptTags.tagId, tags.id))
    .where(eq(tags.projectId, activeProjectId));

  type PromptTag = { id: string; name: string; color: string };
  const tagsByPrompt = new Map<string, PromptTag[]>();
  for (const t of promptTagsRaw) {
    const arr = tagsByPrompt.get(t.promptId) ?? [];
    arr.push({ id: t.tagId, name: t.tagName, color: t.tagColor || "gray" });
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
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(tags)
    .where(eq(tags.projectId, activeProjectId))
    .orderBy(tags.name);

  const allTags = allTagsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color || "gray",
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
    const chatsWithMentions = Number(mentions.chatsWithMentions || 0);
    const avgSentiment = Number(mentions.avgSentiment || 0);
    const avgPosition = Number(mentions.avgPosition || 0);
    const engines = metrics.engines ? (metrics.engines as string).split(",") : [];

    // Visibility = chats with ≥1 brand mention / total chats (per
    // docs/handoff/02-metrics-definitions.md). The previous formula divided
    // raw mention count by chats and capped at 100, which made every prompt
    // with multi-brand responses read 100%.
    const visibility =
      totalChats > 0
        ? Math.round((chatsWithMentions / totalChats) * 100)
        : 0;

    const ownMentions = brandsForPrompt
      .filter((b) => b.isOwn)
      .reduce((s, b) => s + b.count, 0);
    const allMentions = brandsForPrompt.reduce((s, b) => s + b.count, 0);
    const sov = allMentions > 0
      ? Math.round((ownMentions / allMentions) * 100)
      : 0;

    const recent = recentMap.get(p.id);
    const previous = previousMap.get(p.id);

    // Trend = recent 7-day window − previous 7-day window. Zero when either
    // window has no data so the chip doesn't flicker on a fresh project.
    const visibilityTrend =
      recent && previous && previous.totalChats > 0 && recent.totalChats > 0
        ? round1(visibilityPct(recent) - visibilityPct(previous))
        : 0;

    const sentimentTrend =
      recent?.avgSentiment != null && previous?.avgSentiment != null
        ? round1(recent.avgSentiment - previous.avgSentiment)
        : 0;

    // Position: lower is better. Keep the raw delta — UI decides whether
    // a negative delta is "good" (improvement) or "bad".
    const positionTrend =
      recent?.avgPosition != null && previous?.avgPosition != null
        ? round1(recent.avgPosition - previous.avgPosition)
        : 0;

    const mentionsTrend =
      recent && previous
        ? recent.totalMentions - previous.totalMentions
        : 0;

    function sovPct(row: WindowRow | undefined): number {
      if (!row || row.totalMentions === 0) return 0;
      return (row.ownMentions / row.totalMentions) * 100;
    }
    const sovTrend =
      recent && previous && recent.totalMentions > 0 && previous.totalMentions > 0
        ? round1(sovPct(recent) - sovPct(previous))
        : 0;

    return {
      id: p.id,
      query: p.query,
      topicId: p.topicId,
      topicName: p.topicName || null,
      volumeTier: p.volumeTier || "Medium",
      createdAt: p.createdAt?.toISOString() || new Date().toISOString(),
      visibility,
      visibilityTrend,
      sentiment: avgSentiment,
      sentimentTrend,
      avgPosition: avgPosition || 0,
      positionTrend,
      mentions: totalMentions,
      mentionsTrend,
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
      sovTrend,
      location: (p.location || "US").toUpperCase(),
      isActive: p.isActive ?? true,
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

  // ── 9. Setup-state hints (banner inputs) ──────────────────────────────────
  // The dashboard reads from `brand_mentions`, which only fills when an
  // extracted brand matches a row in `brands` for this project. When the
  // metrics column is all 0%, the user usually just hasn't set up brands —
  // surface that loudly instead of silently rendering zeroes.
  const [brandCountRow] = await db
    .select({
      total: sql<number>`count(*)`,
      ownCount: sql<number>`count(*) filter (where ${brands.isOwn})`,
    })
    .from(brands)
    .where(eq(brands.projectId, activeProjectId));

  const [suggestionRow] = await db
    .select({
      rows: sql<number>`count(*)`,
      totalMentions: sql<number>`coalesce(sum(${brandSuggestions.mentions}), 0)`,
    })
    .from(brandSuggestions)
    .where(
      and(
        eq(brandSuggestions.projectId, activeProjectId),
        eq(brandSuggestions.status, "pending"),
      ),
    );

  const recentChatStats = await db
    .select({
      total: sql<number>`count(*)`,
      errors: sql<number>`count(*) filter (where ${chats.rawResponse} like '[ERROR:%')`,
    })
    .from(chats)
    .innerJoin(prompts, eq(chats.promptId, prompts.id))
    .where(
      and(
        eq(prompts.projectId, activeProjectId),
        gte(chats.runDate, recentStart),
      ),
    );

  const setupHints = {
    brandsTracked: Number(brandCountRow?.total ?? 0),
    ownBrandsTracked: Number(brandCountRow?.ownCount ?? 0),
    pendingSuggestions: Number(suggestionRow?.rows ?? 0),
    pendingSuggestionMentions: Number(suggestionRow?.totalMentions ?? 0),
    recentChatsTotal: Number(recentChatStats[0]?.total ?? 0),
    recentChatsErrored: Number(recentChatStats[0]?.errors ?? 0),
  };

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
        setupHints={setupHints}
        addPromptAction={addPrompt}
        addPromptsBulkAction={addPromptsBulk}
        addPromptsFromCsvAction={addPromptsFromCsv}
        addPromptsFromParsedAction={addPromptsFromParsed}
        runNowAction={runNow}
        addBrandAction={addBrand}
        createTopicAction={createTopic}
        assignTagAction={assignTagToPromptByName}
        removeTagAction={removeTagFromPrompt}
        batchAssignTagAction={batchAssignTag}
        batchAssignTopicAction={batchAssignTopic}
        batchSetActiveAction={batchSetActive}
        batchDeleteAction={batchDeletePrompts}
        canEdit={canEdit}
        canRunScans={canRunScans}
      />
    </DashboardLayout>
  );
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
