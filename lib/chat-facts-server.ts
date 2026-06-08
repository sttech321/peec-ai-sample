import { db } from "../db";
import { chats, brandMentions, brands, sources, prompts } from "../db/schema";
import { and, eq, gte } from "drizzle-orm";
import type { ChatFact } from "./chat-aggregations";

interface Scope {
  projectId: string;
  promptId?: string;
}

export interface ProjectBrand {
  name: string;
  isOwn: boolean;
  domains: string[];
}

export async function fetchProjectBrands(projectId: string): Promise<ProjectBrand[]> {
  const rows = await db
    .select({ name: brands.name, isOwn: brands.isOwn, domains: brands.domains })
    .from(brands)
    .where(eq(brands.projectId, projectId))
    .orderBy(brands.name);

  // Dedupe by name (DB may have duplicate brand rows from seed/import).
  // If any duplicate has isOwn=true, treat the brand as own. Merge domain
  // lists across duplicates and dedupe within them.
  const dedup = new Map<string, ProjectBrand>();
  for (const r of rows) {
    const existing = dedup.get(r.name);
    const isOwn = !!r.isOwn || !!existing?.isOwn;
    const merged = new Set([
      ...(existing?.domains ?? []),
      ...((r.domains ?? []) as string[]),
    ]);
    dedup.set(r.name, {
      name: r.name,
      isOwn,
      domains: Array.from(merged).filter((d) => d.length > 0),
    });
  }
  return Array.from(dedup.values());
}

export async function fetchChatFacts(scope: Scope, monthsBack = 6): Promise<ChatFact[]> {
  // Limit to 6 months (was 13) — reduces data transfer by ~50%
  const earliest = new Date();
  earliest.setMonth(earliest.getMonth() - monthsBack);

  const baseFilters = [
    eq(prompts.projectId, scope.projectId),
    gte(chats.runDate, earliest),
  ];
  if (scope.promptId) baseFilters.push(eq(chats.promptId, scope.promptId));

  const chatRows = await db
    .select({
      id: chats.id,
      engine: chats.engine,
      runDate: chats.runDate,
      rawResponse: chats.rawResponse,
      query: prompts.query,
    })
    .from(chats)
    .innerJoin(prompts, eq(chats.promptId, prompts.id))
    .where(and(...baseFilters))
    .orderBy(chats.runDate);

  if (chatRows.length === 0) return [];

  const chatIds = new Set(chatRows.map((c) => c.id));

  // Parallel fetch — brandRows and sourceRows are independent
  const [brandRows, sourceRows] = await Promise.all([
    db
      .select({
        chatId: brandMentions.chatId,
        brandName: brands.name,
        sentiment: brandMentions.sentiment,
        position: brandMentions.position,
      })
      .from(brandMentions)
      .innerJoin(brands, eq(brandMentions.brandId, brands.id))
      .innerJoin(chats, eq(brandMentions.chatId, chats.id))
      .innerJoin(prompts, eq(chats.promptId, prompts.id))
      .where(and(...baseFilters)),

    db
      .select({
        chatId: sources.chatId,
        domain: sources.domain,
        category: sources.category,
        url: sources.url,
        title: sources.title,
      })
      .from(sources)
      .innerJoin(chats, eq(sources.chatId, chats.id))
      .innerJoin(prompts, eq(chats.promptId, prompts.id))
      .where(and(...baseFilters)),
  ]);

  const brandsByChat = new Map<string, ChatFact["brands"]>();
  for (const r of brandRows) {
    if (!chatIds.has(r.chatId)) continue;
    let arr = brandsByChat.get(r.chatId);
    if (!arr) {
      arr = [];
      brandsByChat.set(r.chatId, arr);
    }
    arr.push({
      name: r.brandName,
      sentiment: r.sentiment != null ? Number(r.sentiment) : null,
      position: r.position != null ? Number(r.position) : null,
    });
  }

  const sourcesByChat = new Map<string, ChatFact["sources"]>();
  for (const r of sourceRows) {
    if (!chatIds.has(r.chatId)) continue;
    let arr = sourcesByChat.get(r.chatId);
    if (!arr) {
      arr = [];
      sourcesByChat.set(r.chatId, arr);
    }
    arr.push({
      domain: r.domain,
      category: r.category ?? null,
      url: r.url ?? null,
      title: r.title ?? null,
    });
  }

  return chatRows.map((c) => ({
    id: c.id,
    engine: c.engine,
    runDate: c.runDate?.toISOString() || new Date().toISOString(),
    query: c.query ?? null,
    rawResponse: c.rawResponse ?? null,
    brands: brandsByChat.get(c.id) ?? [],
    sources: sourcesByChat.get(c.id) ?? [],
  }));
}
