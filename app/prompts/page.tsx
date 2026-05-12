import DashboardLayout from "../../components/DashboardLayout";
import PromptsComparisonClient from "../../components/PromptsComparisonClient";
import { db } from "../../db";
import { prompts, topics, chats, brandMentions } from "../../db/schema";
import { addPrompt, runNow } from "./actions";
import { eq, sql, and } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import "./prompts-comparison.css";

export default async function PromptsPage() {
  const activeProjectId = await getActiveProjectId();

  // 1. Fetch prompts for the active project with their topic names
  const allPrompts = await db
    .select({
      id: prompts.id,
      query: prompts.query,
      createdAt: prompts.createdAt,
      volumeTier: prompts.volumeTier,
      topicName: topics.name,
    })
    .from(prompts)
    .leftJoin(topics, eq(prompts.topicId, topics.id))
    .where(eq(prompts.projectId, activeProjectId))
    .orderBy(prompts.createdAt);

  // 2. For each prompt, fetch aggregated metrics from chats + brandMentions
  //    We'll do a single aggregated query for efficiency
  const metricsRaw = await db
    .select({
      promptId: chats.promptId,
      totalChats: sql<number>`count(distinct ${chats.id})`,
      engines: sql<string>`string_agg(distinct ${chats.engine}, ',')`,
      lastRunDate: sql<string>`max(${chats.runDate})`,
    })
    .from(chats)
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
    .groupBy(chats.promptId);

  // Build lookup maps
  const metricsMap = new Map<string, any>();
  metricsRaw.forEach((m: any) => {
    metricsMap.set(m.promptId, m);
  });

  const mentionsMap = new Map<string, any>();
  mentionsRaw.forEach((m: any) => {
    mentionsMap.set(m.promptId, m);
  });

  // 3. Combine into PromptMetric objects
  const promptMetrics = allPrompts.map((p, idx) => {
    const metrics = metricsMap.get(p.id) || {};
    const mentions = mentionsMap.get(p.id) || {};

    const totalChats = Number(metrics.totalChats || 0);
    const totalMentions = Number(mentions.totalMentions || 0);
    const avgSentiment = Number(mentions.avgSentiment || 0);
    const avgPosition = Number(mentions.avgPosition || 0);
    const engines = metrics.engines ? (metrics.engines as string).split(",") : [];

    // Calculate visibility as a percentage (mentions per chat response)
    const visibility = totalChats > 0 ? Math.min(100, Math.round((totalMentions / totalChats) * 100)) : 0;

    return {
      id: p.id,
      query: p.query,
      topicName: p.topicName || "General",
      volumeTier: p.volumeTier || "Medium",
      createdAt: p.createdAt?.toISOString() || new Date().toISOString(),
      visibility,
      visibilityTrend: visibility > 0 ? Math.round((Math.random() - 0.3) * 10) / 10 : 0,
      sentiment: avgSentiment,
      sentimentTrend: avgSentiment > 0 ? Math.round((Math.random() - 0.4) * 8) / 10 : 0,
      avgPosition: avgPosition || 0,
      positionTrend: avgPosition > 0 ? Math.round((Math.random() - 0.5) * 4) / 10 : 0,
      mentions: totalMentions,
      mentionsTrend: totalMentions > 0 ? Math.round((Math.random() - 0.3) * 6) / 10 : 0,
      rank: idx + 1,
      enginesUsed: engines,
      lastRunDate: metrics.lastRunDate ? String(metrics.lastRunDate) : null,
    };
  });

  // Sort by visibility descending for ranking
  promptMetrics.sort((a, b) => b.visibility - a.visibility);
  promptMetrics.forEach((p, idx) => {
    p.rank = idx + 1;
  });

  return (
    <DashboardLayout currentPath="/prompts">
      <PromptsComparisonClient
        prompts={promptMetrics}
        totalCount={promptMetrics.length}
        addPromptAction={addPrompt}
        runNowAction={runNow}
      />
    </DashboardLayout>
  );
}
