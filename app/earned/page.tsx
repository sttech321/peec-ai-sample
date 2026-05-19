import DashboardLayout from "../../components/DashboardLayout";
import EarnedClient from "../../components/EarnedClient";
import { db } from "../../db";
import { projects, earnedActions, sources, chats, prompts, citations, brandMentions, brands } from "../../db/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import { classifyDomain, inferContentType } from "../../lib/actions-generator";
import { generateActionsForProject } from "../../lib/generate-actions";
import "./earned.css";

export const dynamic = "force-dynamic";

export default async function EarnedPage() {
  const activeProjectId = await getActiveProjectId();

  const [projectRecord] = await db
    .select({ name: projects.name, workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, activeProjectId))
    .limit(1);
  const projectName = projectRecord?.name || "General";
  const workspaceId = projectRecord?.workspaceId ?? "unknown";

  // Fetch last scan date from chats table
  const [latestChat] = await db
    .select({ createdAt: chats.createdAt })
    .from(chats)
    .innerJoin(prompts, eq(prompts.id, chats.promptId))
    .where(eq(prompts.projectId, activeProjectId))
    .orderBy(desc(chats.createdAt))
    .limit(1);

  const lastScanDate: Date | null = latestChat?.createdAt ?? null;

  // Count how many prompts exist (to know if user has set up any)
  const [{ promptCount }] = await db
    .select({ promptCount: sql<number>`count(*)::int` })
    .from(prompts)
    .where(eq(prompts.projectId, activeProjectId)) as any[];

  // Own-brand domains to exclude from competitor lists
  const ownBrandsRows = await db
    .select({ domains: brands.domains })
    .from(brands)
    .where(and(eq(brands.projectId, activeProjectId), eq(brands.isOwn, true)));
  const ownDomains = new Set(ownBrandsRows.flatMap((b) => b.domains ?? []));

  // Query sources with retrieval + citation + brand mention counts
  const rawSources = await db
    .select({
      url: sources.url,
      title: sql<string | null>`MAX(${sources.title})`,
      domain: sources.domain,
      retrievals: sql<number>`count(distinct ${sources.id})::int`,
      citationCount: sql<number>`count(distinct ${citations.id})::int`,
      mentionCount: sql<number>`count(distinct ${brandMentions.id})::int`,
    })
    .from(sources)
    .innerJoin(chats, eq(chats.id, sources.chatId))
    .innerJoin(prompts, eq(prompts.id, chats.promptId))
    .leftJoin(citations, eq(citations.sourceId, sources.id))
    .leftJoin(brandMentions, eq(brandMentions.chatId, sources.chatId))
    .where(eq(prompts.projectId, activeProjectId))
    .groupBy(sources.url, sources.domain)
    .orderBy(sql`count(distinct ${sources.id}) desc`)
    .limit(300) as any[];

  // Auto-generate actions if today's scan data exists but no actions yet
  if (rawSources.length > 0 && lastScanDate) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const scanIsRecent = lastScanDate >= todayStart;

    if (scanIsRecent) {
      // Only auto-generate; the guard inside prevents duplicate generation
      await generateActionsForProject(activeProjectId, workspaceId);
    }
  }

  // Fetch actions (after potential auto-generation above)
  const actions = await db
    .select()
    .from(earnedActions)
    .where(eq(earnedActions.projectId, activeProjectId));

  // Query prompt queries — used as "phrases" in editorial detail panels
  const promptRows = await db
    .select({ query: prompts.query })
    .from(prompts)
    .where(eq(prompts.projectId, activeProjectId))
    .limit(100);

  type SourceRow = { title: string; url: string; domain: string; retrievals: number; citationRate: number; mentions: number };
  type ChannelRow = { name: string; count: number };

  const sourcesMap: Record<string, SourceRow[]> = {};
  const channelCounters: Record<string, Map<string, number>> = {};
  const editorialDomainCounts: Record<string, Map<string, number>> = {};

  for (const row of rawSources) {
    if (ownDomains.has(row.domain as string)) continue;

    const s: SourceRow = {
      title: (row.title as string | null) ?? (row.url as string),
      url: row.url as string,
      domain: row.domain as string,
      retrievals: row.retrievals as number,
      mentions: row.mentionCount as number,
      citationRate: (row.retrievals as number) > 0
        ? (row.citationCount as number) / (row.retrievals as number)
        : 0,
    };

    const cat = classifyDomain(row.domain as string);
    const key =
      cat === "reference" ? "Reference"
      : cat === "ugc" ? (row.domain as string)
      : "Editorial";

    if (!sourcesMap[key]) sourcesMap[key] = [];
    sourcesMap[key].push(s);

    if (cat === "editorial") {
      const contentType = inferContentType((row.title as string | null) ?? (row.url as string));
      if (!sourcesMap[contentType]) sourcesMap[contentType] = [];
      sourcesMap[contentType].push(s);

      if (!editorialDomainCounts[contentType]) editorialDomainCounts[contentType] = new Map();
      const dm = editorialDomainCounts[contentType];
      dm.set(row.domain as string, (dm.get(row.domain as string) ?? 0) + (row.retrievals as number));
    }

    if (cat === "ugc" && row.domain === "reddit.com") {
      const m = (row.url as string).match(/reddit\.com\/r\/([^/?#]+)/i);
      if (m) {
        if (!channelCounters["reddit.com"]) channelCounters["reddit.com"] = new Map();
        const ch = `r/${m[1]}`;
        channelCounters["reddit.com"].set(ch, (channelCounters["reddit.com"].get(ch) ?? 0) + (row.retrievals as number));
      }
    }

    if (cat === "ugc" && row.domain === "linkedin.com") {
      const m = (row.url as string).match(/linkedin\.com\/(company|school|groups)\/([^/?#]+)/i);
      if (m) {
        if (!channelCounters["linkedin.com"]) channelCounters["linkedin.com"] = new Map();
        const ch = `${m[1]}/${m[2]}`;
        channelCounters["linkedin.com"].set(ch, (channelCounters["linkedin.com"].get(ch) ?? 0) + (row.retrievals as number));
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

  const domainsMap: Record<string, { name: string; count: number }[]> = {};
  for (const [type, m] of Object.entries(editorialDomainCounts)) {
    domainsMap[type] = Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({ name, count }));
  }

  const phraseCounts = new Map<string, number>();
  for (const p of promptRows) {
    const phrase = (p.query as string).trim().slice(0, 60);
    phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
  }
  const topPhrasesList = Array.from(phraseCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([text, count]) => ({ text, count }));

  const phrasesMap: Record<string, { text: string; count: number }[]> = {};
  ["How-To Guide", "Article", "Listicle", "Comparison", "Category Page", "Product Page", "Homepage"].forEach((t) => {
    phrasesMap[t] = topPhrasesList;
  });

  return (
    <DashboardLayout currentPath="/earned">
      <EarnedClient
        initialActions={actions as any[]}
        projectName={projectName}
        sourcesMap={sourcesMap as any}
        channelsMap={channelsMap}
        phrasesMap={phrasesMap}
        domainsMap={domainsMap}
        sourcesCount={rawSources.length}
        promptCount={promptCount as number}
        lastScanDate={lastScanDate ? lastScanDate.toISOString() : null}
      />
    </DashboardLayout>
  );
}
