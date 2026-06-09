import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../db";
import { chats, prompts, brands, brandMentions, sources } from "../../../db/schema";
import { and, desc, eq, gte, inArray, lte, sql, SQL } from "drizzle-orm";
import { getActiveProjectId } from "../../../lib/project-context";
import type { ChatRecordView } from "../../../lib/chat-aggregations";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url    = req.nextUrl;
    const page   = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1"));
    const limit  = Math.min(50, Math.max(5, parseInt(url.searchParams.get("limit") ?? "10")));
    const models = url.searchParams.get("models")?.split(",").filter(Boolean) ?? [];
    const dateFrom     = url.searchParams.get("dateFrom");
    const dateTo       = url.searchParams.get("dateTo");
    const brandFilter  = url.searchParams.get("brandFilter")  ?? "";
    const sourceFilter = url.searchParams.get("sourceFilter") ?? "";
    const ownBrandName = url.searchParams.get("ownBrand")     ?? "";

    const projectId = await getActiveProjectId();

    // ── Build WHERE conditions ────────────────────────────────────────────
    const conditions: SQL[] = [eq(prompts.projectId, projectId)];
    if (models.length > 0)   conditions.push(inArray(chats.engine, models));
    if (dateFrom)            conditions.push(gte(chats.runDate, new Date(dateFrom)));
    if (dateTo)              conditions.push(lte(chats.runDate, new Date(dateTo)));

    const where = and(...conditions);

    // ── Parallel: total count + summary + paginated rows ──────────────────
    const [countRows, allChatRows, pageRows] = await Promise.all([

      // 1. Total count for pagination
      db.select({ total: sql<number>`cast(count(*) as int)` })
        .from(chats)
        .innerJoin(prompts, eq(chats.promptId, prompts.id))
        .where(where),

      // 2. All chat IDs for stats + dropdown lists (no pagination)
      db.select({ id: chats.id })
        .from(chats)
        .innerJoin(prompts, eq(chats.promptId, prompts.id))
        .where(where),

      // 3. Paginated rows for table
      db.select({
        id:          chats.id,
        engine:      chats.engine,
        runDate:     chats.runDate,
        rawResponse: chats.rawResponse,
        query:       prompts.query,
      })
        .from(chats)
        .innerJoin(prompts, eq(chats.promptId, prompts.id))
        .where(where)
        .orderBy(desc(chats.runDate))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);

    const total      = countRows[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const allChatIds = allChatRows.map(r => r.id);
    const pageIds    = pageRows.map(r => r.id);

    // ── Fetch mentions + sources for paginated IDs ────────────────────────
    const [brandRows, sourceRows] = pageIds.length > 0
      ? await Promise.all([
          db.select({
            chatId:    brandMentions.chatId,
            brandName: brands.name,
            position:  brandMentions.position,
            sentiment: brandMentions.sentiment,
          })
            .from(brandMentions)
            .innerJoin(brands, eq(brandMentions.brandId, brands.id))
            .where(inArray(brandMentions.chatId, pageIds)),

          db.select({
            chatId: sources.chatId,
            domain: sources.domain,
            title:  sources.title,
            url:    sources.url,
          })
            .from(sources)
            .where(inArray(sources.chatId, pageIds)),
        ])
      : [[], []];

    // ── Build lookup maps ─────────────────────────────────────────────────
    const brandsByChat = new Map<string, { name: string; position: number | null; sentiment: number | null }[]>();
    for (const r of brandRows) {
      if (!brandsByChat.has(r.chatId)) brandsByChat.set(r.chatId, []);
      brandsByChat.get(r.chatId)!.push({ name: r.brandName, position: r.position ?? null, sentiment: r.sentiment ?? null });
    }

    const sourcesByChat = new Map<string, { domain: string; title: string | null; url: string | null }[]>();
    for (const r of sourceRows) {
      if (!sourcesByChat.has(r.chatId)) sourcesByChat.set(r.chatId, []);
      sourcesByChat.get(r.chatId)!.push({ domain: r.domain, title: r.title ?? null, url: r.url ?? null });
    }

    // ── Convert to ChatRecordView ─────────────────────────────────────────
    let rows: ChatRecordView[] = pageRows.map(c => {
      const bList = brandsByChat.get(c.id) ?? [];
      const sList = sourcesByChat.get(c.id) ?? [];
      const positions  = bList.map(b => b.position ).filter((v): v is number => v != null);
      const sentiments = bList.map(b => b.sentiment).filter((v): v is number => v != null);
      return {
        id:          c.id,
        engine:      c.engine,
        runDate:     c.runDate?.toISOString() ?? new Date().toISOString(),
        query:       c.query ?? null,
        rawResponse: c.rawResponse ?? null,
        brandsFound:  [...new Set(bList.map(b => b.name))],
        sourcesFound: sList.map(s => ({ domain: s.domain, title: s.title, url: s.url })),
        avgSentiment: sentiments.length ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : 0,
        avgPosition:  positions.length  ? positions.reduce((a, b) => a + b, 0)  / positions.length  : 0,
      };
    });

    // Row-level filters (applied after fetch)
    if (brandFilter)  rows = rows.filter(r => r.brandsFound.includes(brandFilter));
    if (sourceFilter) rows = rows.filter(r => r.sourcesFound.some(s => s.domain === sourceFilter));

    // ── Stats (over ALL filtered chats, not just current page) ───────────
    let ownMentionCount = 0;
    let webSearchCount  = 0;
    let avgCitation     = 0;
    let allBrands: string[]  = [];
    let allSources: string[] = [];

    if (allChatIds.length > 0) {
      // Run stats queries in parallel
      const [srcStats, bdDistinct, srcDistinct, ownRow] = await Promise.all([
        // Source counts per chat (for webSearch + avgCitation)
        db.select({
          chatId: sources.chatId,
          cnt: sql<number>`cast(count(*) as int)`,
        })
          .from(sources)
          .where(inArray(sources.chatId, allChatIds))
          .groupBy(sources.chatId),

        // Distinct brands for filter dropdown
        db.selectDistinct({ name: brands.name })
          .from(brandMentions)
          .innerJoin(brands, eq(brandMentions.brandId, brands.id))
          .where(inArray(brandMentions.chatId, allChatIds)),

        // Distinct source domains for filter dropdown
        db.selectDistinct({ domain: sources.domain })
          .from(sources)
          .where(inArray(sources.chatId, allChatIds)),

        // Own brand mention count
        ownBrandName
          ? db.select({ n: sql<number>`cast(count(distinct ${brandMentions.chatId}) as int)` })
              .from(brandMentions)
              .innerJoin(brands, eq(brandMentions.brandId, brands.id))
              .where(and(
                eq(brands.name, ownBrandName),
                inArray(brandMentions.chatId, allChatIds),
              ))
          : Promise.resolve([{ n: 0 }]),
      ]);

      const chatSourceMap = new Map(srcStats.map(r => [r.chatId, r.cnt]));
      webSearchCount = allChatIds.filter(id => (chatSourceMap.get(id) ?? 0) > 0).length;
      const totalCitations = allChatIds.reduce((s, id) => s + (chatSourceMap.get(id) ?? 0), 0);
      avgCitation = allChatIds.length > 0
        ? parseFloat((totalCitations / allChatIds.length).toFixed(1))
        : 0;

      ownMentionCount = ownRow[0]?.n ?? 0;
      allBrands  = bdDistinct.map(r => r.name).sort();
      allSources = srcDistinct.map(r => r.domain).sort();
    }

    return NextResponse.json({
      rows,
      total,
      page,
      totalPages,
      stats: {
        totalChats:     allChatIds.length,
        ownMentionCount,
        webSearchCount,
        avgCitation,
      },
      allBrands,
      allSources,
    });

  } catch (err) {
    console.error("/api/chats error:", err);
    return NextResponse.json({ error: "Failed to fetch chats" }, { status: 500 });
  }
}
