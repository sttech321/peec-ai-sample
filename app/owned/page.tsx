import DashboardLayout from "../../components/DashboardLayout";
import OwnedClient from "../../components/OwnedClient";
import { db } from "../../db";
import { ownedActions, projects, sources, chats, prompts, citations, brands } from "../../db/schema";
import { eq, sql, and, ne } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import "../earned/earned.css";

// Infer content type from an action's text (mirrors OwnedClient.inferContentType)
function inferContentType(text: string): string {
  if (/listicle|top\s+\d+|best\s+\w+\s+(agencies|companies|tools)/i.test(text)) return "Listicle";
  if (/homepage|home page|landing page/i.test(text)) return "Homepage";
  if (/product page|product/i.test(text)) return "Product Page";
  if (/how[\s-]to|guide|tutorial/i.test(text)) return "How-To Guide";
  if (/category page|category/i.test(text)) return "Category Page";
  if (/comparison|vs\.|versus/i.test(text)) return "Comparison";
  return "Article";
}

export default async function OwnedPage() {
  const activeProjectId = await getActiveProjectId();

  // Parallel fetch — all 5 queries are independent
  const [[project], actions, ownBrands, rawSources, promptRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, activeProjectId)).limit(1),

    db.select().from(ownedActions).where(eq(ownedActions.projectId, activeProjectId)),

    db.select({ domains: brands.domains })
      .from(brands)
      .where(and(eq(brands.projectId, activeProjectId), eq(brands.isOwn, true))),

    db.select({
        url: sources.url,
        title: sql<string | null>`MAX(${sources.title})`,
        domain: sources.domain,
        category: sql<string | null>`MAX(${sources.category})`,
        retrievals: sql<number>`count(distinct ${sources.id})::int`,
        citationCount: sql<number>`count(distinct ${citations.id})::int`,
      })
      .from(sources)
      .innerJoin(chats, eq(chats.id, sources.chatId))
      .innerJoin(prompts, eq(prompts.id, chats.promptId))
      .leftJoin(citations, eq(citations.sourceId, sources.id))
      .where(eq(prompts.projectId, activeProjectId))
      .groupBy(sources.url, sources.domain)
      .orderBy(sql`count(distinct ${sources.id}) desc`)
      .limit(500) as any,

    db.select({ query: prompts.query })
      .from(prompts)
      .where(eq(prompts.projectId, activeProjectId))
      .limit(100),
  ]);

  const ownDomains = new Set(ownBrands.flatMap((b) => b.domains ?? []));

  // Competitor sources only (exclude own-brand domains)
  const competitorSources = (rawSources as any[]).filter(
    (r: any) => !ownDomains.has(r.domain as string)
  );

  // Build top domains map (same data for all content types — competitor domains)
  const domainCounts = new Map<string, number>();
  for (const r of competitorSources) {
    domainCounts.set(r.domain as string, (domainCounts.get(r.domain as string) ?? 0) + (r.retrievals as number));
  }
  const topDomainsList = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, count]) => ({ name, count }));

  // Build phrases list from prompt queries (deduplicated, truncated)
  const phraseCounts = new Map<string, number>();
  for (const p of promptRows) {
    const phrase = (p.query as string).trim().slice(0, 50);
    phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
  }
  const topPhrasesList = Array.from(phraseCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([text, count]) => ({ text, count }));

  // Build sources list for owned (competitor sources with metrics)
  const topSourcesList = competitorSources.slice(0, 10).map((r: any) => ({
    title: (r.title as string | null) ?? (r.url as string),
    url: r.url as string,
    domain: r.domain as string,
    mentioned: "Unknown",
    retrievals: r.retrievals as number,
    citationRate: (r.retrievals as number) > 0
      ? (r.citationCount as number) / (r.retrievals as number)
      : 0,
  }));

  // All content types share the same competitive intelligence data.
  // When the DB has real data use it; otherwise OwnedClient falls back to static.
  const hasRealData = competitorSources.length > 0 || promptRows.length > 0;

  const phrasesMap = hasRealData
    ? Object.fromEntries(
        ["Listicle", "Product Page", "Homepage", "Article", "How-To Guide", "Category Page", "Comparison", "Other"]
          .map((t) => [t, topPhrasesList])
      )
    : {};

  const domainsMap = hasRealData
    ? Object.fromEntries(
        ["Listicle", "Product Page", "Homepage", "Article", "How-To Guide", "Category Page", "Comparison", "Other"]
          .map((t) => [t, topDomainsList])
      )
    : {};

  const sourcesMap = hasRealData
    ? Object.fromEntries(
        ["Listicle", "Product Page", "Homepage", "Article", "How-To Guide", "Category Page", "Comparison", "Other"]
          .map((t) => [t, topSourcesList])
      )
    : {};

  return (
    <DashboardLayout currentPath="/owned">
      <OwnedClient
        initialActions={actions as any[]}
        projectName={project?.name || "this project"}
        phrasesMap={phrasesMap}
        domainsMap={domainsMap}
        sourcesMap={sourcesMap}
      />
    </DashboardLayout>
  );
}
