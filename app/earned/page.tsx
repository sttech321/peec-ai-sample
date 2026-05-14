import DashboardLayout from "../../components/DashboardLayout";
import EarnedClient from "../../components/EarnedClient";
import { db } from "../../db";
import { projects, earnedActions, sources, chats, prompts, citations } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import "./earned.css";

export default async function EarnedPage() {
  const activeProjectId = await getActiveProjectId();

  const [projectRecord] = await db
    .select({ name: projects.name, workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, activeProjectId))
    .limit(1);
  const projectName = projectRecord?.name || "General";

  const actions = await db
    .select()
    .from(earnedActions)
    .where(eq(earnedActions.projectId, activeProjectId));

  // Query sources for this project (sources → chats → prompts → project)
  const rawSources = await db
    .select({
      url: sources.url,
      title: sql<string | null>`MAX(${sources.title})`,
      domain: sources.domain,
      category: sql<string | null>`MAX(${sources.category})`,
      retrievals: sql<number>`count(*)::int`,
      citationCount: sql<number>`count(distinct ${citations.id})::int`,
    })
    .from(sources)
    .innerJoin(chats, eq(chats.id, sources.chatId))
    .innerJoin(prompts, eq(prompts.id, chats.promptId))
    .leftJoin(citations, eq(citations.sourceId, sources.id))
    .where(eq(prompts.projectId, activeProjectId))
    .groupBy(sources.url, sources.domain)
    .orderBy(sql`count(*) desc`)
    .limit(300) as any[];

  type SourceRow = { title: string; url: string; domain: string; retrievals: number; citationRate: number };
  type ChannelRow = { name: string; count: number };
  const sourcesMap: Record<string, SourceRow[]> = {};
  const channelCounters: Record<string, Map<string, number>> = {};

  for (const row of rawSources) {
    const s: SourceRow = {
      title: (row.title as string | null) ?? (row.url as string),
      url: row.url as string,
      domain: row.domain as string,
      retrievals: row.retrievals as number,
      citationRate: (row.retrievals as number) > 0
        ? (row.citationCount as number) / (row.retrievals as number)
        : 0,
    };

    const key =
      row.category === "reference" ? "Reference"
      : row.category === "ugc" ? (row.domain as string)
      : "Editorial";

    if (!sourcesMap[key]) sourcesMap[key] = [];
    sourcesMap[key].push(s);

    if (row.category === "ugc" && row.domain === "reddit.com") {
      const m = (row.url as string).match(/reddit\.com\/r\/([^/?#]+)/i);
      if (m) {
        if (!channelCounters["reddit.com"]) channelCounters["reddit.com"] = new Map();
        const ch = `r/${m[1]}`;
        channelCounters["reddit.com"].set(ch, (channelCounters["reddit.com"].get(ch) ?? 0) + (row.retrievals as number));
      }
    }
  }

  const channelsMap: Record<string, ChannelRow[]> = {};
  for (const [domain, countMap] of Object.entries(channelCounters)) {
    channelsMap[domain] = Array.from(countMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  return (
    <DashboardLayout currentPath="/earned">
      <EarnedClient
        initialActions={actions}
        projectName={projectName}
        sourcesMap={sourcesMap}
        channelsMap={channelsMap}
      />
    </DashboardLayout>
  );
}
