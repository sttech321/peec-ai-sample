import { NextResponse } from "next/server";
import { db } from "../../../../db";
import {
  earnedActions, ownedActions, sources, chats, prompts, citations, brands,
} from "../../../../db/schema";
import { eq, sql, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "../../../../lib/session";
import { getActiveProjectId } from "../../../../lib/project-context";
import {
  classifyDomain, inferContentType, calcPriority,
  earnedActionText, ownedActionText,
} from "../../../../lib/actions-generator";

export async function POST() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  let workspaceId = "unknown";
  if (raw) {
    const session = verifySession(raw);
    if (session) workspaceId = session.workspaceId;
  }

  const projectId = await getActiveProjectId();

  // ── Guard: skip if actions already exist ─────────────────────────────────
  const [{ earnedCount }] = await db
    .select({ earnedCount: sql<number>`count(*)::int` })
    .from(earnedActions)
    .where(eq(earnedActions.projectId, projectId)) as any[];

  if (earnedCount > 0) {
    return NextResponse.json({ alreadyGenerated: true, earned: earnedCount });
  }

  // ── Own-brand domains to exclude ─────────────────────────────────────────
  const ownBrands = await db
    .select({ domains: brands.domains })
    .from(brands)
    .where(and(eq(brands.projectId, projectId), eq(brands.isOwn, true)));
  const ownDomains = new Set(ownBrands.flatMap((b) => b.domains ?? []));

  // ── Query all sources for this project ────────────────────────────────────
  const rawSources = (await db
    .select({
      url: sources.url,
      domain: sources.domain,
      title: sql<string | null>`MAX(${sources.title})`,
      retrievals: sql<number>`count(distinct ${sources.id})::int`,
      citationCount: sql<number>`count(distinct ${citations.id})::int`,
    })
    .from(sources)
    .innerJoin(chats, eq(chats.id, sources.chatId))
    .innerJoin(prompts, eq(prompts.id, chats.promptId))
    .leftJoin(citations, eq(citations.sourceId, sources.id))
    .where(eq(prompts.projectId, projectId))
    .groupBy(sources.url, sources.domain)
    .orderBy(sql`count(distinct ${sources.id}) desc`)
    .limit(300)) as {
      url: string; domain: string; title: string | null;
      retrievals: number; citationCount: number;
    }[];

  if (rawSources.length === 0) {
    return NextResponse.json(
      { error: "No scan data found. Run AI scans on your prompts first." },
      { status: 422 },
    );
  }

  // ── Query prompt queries for contextual text ──────────────────────────────
  const promptRows = (await db
    .select({ query: prompts.query })
    .from(prompts)
    .where(eq(prompts.projectId, projectId))
    .limit(50)) as { query: string }[];

  const topQuery = promptRows[0]?.query ?? "your target topic";

  // ── Competitor sources only ───────────────────────────────────────────────
  const competitorSources = rawSources.filter((s) => !ownDomains.has(s.domain));

  // ── Generate Earned Actions ───────────────────────────────────────────────
  const earnedToInsert: typeof earnedActions.$inferInsert[] = [];
  const ugcDomainCount = new Map<string, number>(); // max 3 per UGC domain

  for (const s of competitorSources) {
    if (earnedToInsert.length >= 30) break;

    const category = classifyDomain(s.domain);
    const isUGC = category === "ugc";

    if (isUGC) {
      const count = ugcDomainCount.get(s.domain) ?? 0;
      if (count >= 3) continue;
      ugcDomainCount.set(s.domain, count + 1);
    }

    const priority = calcPriority(s.retrievals, s.citationCount);
    const description = earnedActionText(s.url, s.domain, s.title, category, topQuery);
    // type is NOT NULL in schema; for UGC use domain string (sourceDomain drives the badge)
    const type = category === "reference" ? "Reference"
      : isUGC ? s.domain
      : inferContentType(s.title ?? s.url);

    earnedToInsert.push({
      workspaceId,
      projectId,
      type,
      title: isUGC ? `${s.domain} mention opportunity` : `${type} — ${s.domain}`,
      description,
      priority,
      status: "todo",
      sourceUrl: s.url,
      sourceDomain: isUGC ? s.domain : null,
    });
  }

  // ── Generate Owned Actions ────────────────────────────────────────────────
  // Group competitor sources by content type, tracking the best source per type
  const typeData = new Map<string, {
    totalRetrievals: number;
    topDomain: string;
    topSourceTitle: string | null;
    topSourceUrl: string;
  }>();

  for (const s of competitorSources) {
    const contentType = inferContentType(s.title ?? s.url);
    const existing = typeData.get(contentType);
    if (!existing) {
      typeData.set(contentType, {
        totalRetrievals: s.retrievals,
        topDomain: s.domain,
        topSourceTitle: s.title,
        topSourceUrl: s.url,
      });
    } else {
      existing.totalRetrievals += s.retrievals;
      // Keep the source with highest individual retrievals as the "top" one
      if (s.retrievals > (typeData.get(contentType)!.totalRetrievals * 0.4)) {
        existing.topDomain = s.domain;
        existing.topSourceTitle = s.title;
        existing.topSourceUrl = s.url;
      }
    }
  }

  const CONTENT_TYPE_ORDER = [
    "Listicle", "Listicle",        // Two listicle cards: A then B template
    "Homepage", "Product Page", "Product Page",
    "Category Page", "Category Page",
    "How-To Guide", "How-To Guide",
    "Article", "Article",
    "Comparison",
  ];
  const TEMPLATE_CYCLE: ("A" | "B" | "C")[] = ["A", "B", "C", "A", "B", "A", "B", "A", "B", "A", "B", "A"];

  const ownedToInsert: typeof ownedActions.$inferInsert[] = [];

  for (let i = 0; i < CONTENT_TYPE_ORDER.length; i++) {
    if (ownedToInsert.length >= 14) break;
    const contentType = CONTENT_TYPE_ORDER[i];
    const data = typeData.get(contentType);
    const query = promptRows[i % promptRows.length]?.query ?? topQuery;
    const topDomain = data?.topDomain ?? "competitors";
    const topSourceTitle = data?.topSourceTitle ?? null;
    const totalRetrievals = data?.totalRetrievals ?? 0;
    const priority: "High" | "Medium" | "Low" =
      totalRetrievals >= 20 ? "High" : totalRetrievals >= 8 ? "Medium" : "Low";
    const templateStyle = TEMPLATE_CYCLE[i] ?? "A";

    const description = ownedActionText(
      contentType, topDomain, query, templateStyle,
      topSourceTitle ?? undefined,
    );

    ownedToInsert.push({
      workspaceId,
      projectId,
      title: `${contentType} — ${query.slice(0, 60)}`,
      description,
      priority,
      status: "todo",
      pageUrl: null,
    });
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  if (earnedToInsert.length > 0) await db.insert(earnedActions).values(earnedToInsert);
  if (ownedToInsert.length > 0) await db.insert(ownedActions).values(ownedToInsert);

  return NextResponse.json({
    success: true,
    earned: earnedToInsert.length,
    owned: ownedToInsert.length,
  });
}

// Force regeneration — deletes existing actions first
export async function DELETE() {
  const projectId = await getActiveProjectId();
  await db.delete(earnedActions).where(eq(earnedActions.projectId, projectId));
  await db.delete(ownedActions).where(eq(ownedActions.projectId, projectId));
  return NextResponse.json({ deleted: true });
}
