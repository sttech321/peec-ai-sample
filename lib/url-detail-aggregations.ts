// Aggregation helpers for the URL detail page.
// All pure functions — server passes filtered ChatFact[], client re-derives.

import type { ChatFact, Resolution } from "./chat-aggregations";

// ── Timeline helpers (copied from domain-aggregations to avoid coupling) ──────
function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x;
}
function startOfMonth(d: Date): Date {
  const x = startOfDay(d); x.setDate(1); return x;
}
function bucketStart(d: Date, res: Resolution): Date {
  if (res === "D") return startOfDay(d);
  if (res === "W") return startOfWeek(d);
  return startOfMonth(d);
}
function formatLabel(d: Date, res: Resolution): string {
  if (res === "M") return d.toLocaleString("en", { month: "short" });
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}`;
}
const MAX_BUCKETS: Record<Resolution, number> = { D: 60, W: 26, M: 24 };
function timelineForRange(start: Date, end: Date, res: Resolution): Date[] {
  const startB = bucketStart(start, res);
  const endB = bucketStart(end, res);
  const out: Date[] = [];
  const cur = new Date(startB);
  while (cur.getTime() <= endB.getTime()) {
    out.push(new Date(cur));
    if (res === "D") cur.setDate(cur.getDate() + 1);
    else if (res === "W") cur.setDate(cur.getDate() + 7);
    else cur.setMonth(cur.getMonth() + 1);
  }
  const cap = MAX_BUCKETS[res];
  return out.length > cap ? out.slice(-cap) : out;
}

// ── Filter chats to only those containing a given URL ─────────────────────────
export function getUrlChats(chats: ChatFact[], url: string): ChatFact[] {
  return chats.filter((c) => c.sources.some((s) => s.url === url));
}

// ── URL metadata ──────────────────────────────────────────────────────────────
export interface UrlMeta {
  retrievals: number;
  retrievalsDelta: number;
  citationRate: number;
  citationRateDelta: number;
  promptCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

export function computeUrlMeta(
  currentChats: ChatFact[],
  previousChats: ChatFact[],
  url: string,
): UrlMeta {
  const cur = getUrlChats(currentChats, url);
  const prev = getUrlChats(previousChats, url);

  const retrievals = cur.reduce((n, c) => n + c.sources.filter((s) => s.url === url).length, 0);
  const retrievalsPrev = prev.reduce((n, c) => n + c.sources.filter((s) => s.url === url).length, 0);

  const citationRate = cur.length > 0 ? retrievals / cur.length : 0;
  const citationRatePrev = prev.length > 0 ? retrievalsPrev / prev.length : 0;

  const promptSet = new Set(cur.map((c) => c.query).filter(Boolean));

  let firstSeen: string | null = null;
  let lastSeen: string | null = null;
  const allChats = [...currentChats, ...previousChats].filter((c) =>
    c.sources.some((s) => s.url === url)
  );
  for (const c of allChats) {
    if (!firstSeen || c.runDate < firstSeen) firstSeen = c.runDate;
    if (!lastSeen || c.runDate > lastSeen) lastSeen = c.runDate;
  }

  return {
    retrievals,
    retrievalsDelta: retrievals - retrievalsPrev,
    citationRate,
    citationRateDelta: citationRate - citationRatePrev,
    promptCount: promptSet.size,
    firstSeen,
    lastSeen,
  };
}

// ── Retrievals over time (current + previous period as two series) ────────────
export interface SingleUrlPoint {
  date: string;
  current: number;
  previous: number;
}

export function buildSingleUrlSeries(
  currentChats: ChatFact[],
  previousChats: ChatFact[],
  url: string,
  resolution: Resolution,
  range: { start: Date; end: Date },
): SingleUrlPoint[] {
  const tl = timelineForRange(range.start, range.end, resolution);
  const span = range.end.getTime() - range.start.getTime();
  const prevStart = new Date(range.start.getTime() - span - 1);
  const prevEnd = new Date(range.start.getTime() - 1);
  const tlPrev = timelineForRange(prevStart, prevEnd, resolution);

  const curBuckets = new Map<string, number>();
  for (const c of currentChats) {
    if (!c.sources.some((s) => s.url === url)) continue;
    const key = bucketStart(new Date(c.runDate), resolution).toISOString();
    curBuckets.set(key, (curBuckets.get(key) || 0) + 1);
  }

  const prevBuckets = new Map<string, number>();
  for (const c of previousChats) {
    if (!c.sources.some((s) => s.url === url)) continue;
    const key = bucketStart(new Date(c.runDate), resolution).toISOString();
    prevBuckets.set(key, (prevBuckets.get(key) || 0) + 1);
  }

  return tl.map((b, i) => {
    const prevBucket = tlPrev[i];
    return {
      date: formatLabel(b, resolution),
      current: curBuckets.get(b.toISOString()) || 0,
      previous: prevBucket ? prevBuckets.get(prevBucket.toISOString()) || 0 : 0,
    };
  });
}

// ── Retrievals by model ────────────────────────────────────────────────────────
export interface UrlModelStat {
  engine: string;
  current: number;
  previous: number;
}

export function buildUrlRetrievalsByModel(
  currentChats: ChatFact[],
  previousChats: ChatFact[],
  url: string,
): UrlModelStat[] {
  const curMap = new Map<string, number>();
  const prevMap = new Map<string, number>();

  for (const c of currentChats) {
    if (!c.sources.some((s) => s.url === url)) continue;
    curMap.set(c.engine, (curMap.get(c.engine) || 0) + 1);
  }
  for (const c of previousChats) {
    if (!c.sources.some((s) => s.url === url)) continue;
    prevMap.set(c.engine, (prevMap.get(c.engine) || 0) + 1);
  }

  const engines = new Set([...curMap.keys(), ...prevMap.keys()]);
  return Array.from(engines)
    .map((engine) => ({
      engine,
      current: curMap.get(engine) || 0,
      previous: prevMap.get(engine) || 0,
    }))
    .sort((a, b) => b.current - a.current);
}

// ── Prompt stats ──────────────────────────────────────────────────────────────
export interface UrlPromptStat {
  query: string;
  retrieved: number;
  citationRate: number;
}

export function buildUrlPromptStats(
  chats: ChatFact[],
  url: string,
): UrlPromptStat[] {
  const urlChats = getUrlChats(chats, url);
  const byQuery = new Map<string, number>();
  for (const c of urlChats) {
    if (!c.query) continue;
    byQuery.set(c.query, (byQuery.get(c.query) || 0) + 1);
  }
  const total = urlChats.length;
  return Array.from(byQuery.entries())
    .map(([query, count]) => ({
      query,
      retrieved: count,
      citationRate: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.retrieved - a.retrieved);
}

// ── Brand mentions in URL chats ───────────────────────────────────────────────
export interface UrlBrandMention {
  brand: string;
  count: number;
  isOwn: boolean;
}

export function getUrlBrandMentions(
  chats: ChatFact[],
  url: string,
  ownBrand: string | null,
): UrlBrandMention[] {
  const urlChats = getUrlChats(chats, url);
  const counts = new Map<string, number>();
  for (const c of urlChats) {
    const seen = new Set<string>();
    for (const b of c.brands) {
      if (seen.has(b.name)) continue;
      seen.add(b.name);
      counts.set(b.name, (counts.get(b.name) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([brand, count]) => ({
      brand,
      count,
      isOwn: brand === ownBrand,
    }))
    .sort((a, b) => b.count - a.count);
}

// ── URL-level aggregation for domain detail page ──────────────────────────────
export interface UrlRowStat {
  url: string;
  title: string | null;
  urlType: string;
  category: string | null;
  retrievals: number;
  retrievalsDelta: number;
  citationRate: number;
  citationRateDelta: number;
  ownMentioned: boolean;
  mentionCount: number;
  lastSeen: string | null;
}

export function aggregateUrlsForDomain(
  currentChats: ChatFact[],
  previousChats: ChatFact[],
  domain: string,
  ownBrand: string | null,
): UrlRowStat[] {
  const { classifyUrl } = require("./url-aggregations") as typeof import("./url-aggregations");

  type RowData = {
    title: string | null;
    category: string | null;
    retrievals: number;
    ownMentioned: boolean;
    mentionCount: number;
    lastSeen: number;
  };

  const cur = new Map<string, RowData>();
  const prev = new Map<string, number>();

  for (const c of currentChats) {
    const ownInChat = ownBrand ? c.brands.some((b) => b.name === ownBrand) : false;
    const brandCount = c.brands.length;
    for (const s of c.sources) {
      if (s.domain.toLowerCase() !== domain.toLowerCase()) continue;
      const key = s.url || `__nourl__${s.title ?? ""}`;
      let row = cur.get(key);
      if (!row) {
        row = { title: s.title, category: s.category, retrievals: 0, ownMentioned: false, mentionCount: 0, lastSeen: 0 };
        cur.set(key, row);
      }
      row.retrievals += 1;
      if (ownInChat) row.ownMentioned = true;
      row.mentionCount = Math.max(row.mentionCount, brandCount);
      const t = new Date(c.runDate).getTime();
      if (t > row.lastSeen) row.lastSeen = t;
      if (!row.title && s.title) row.title = s.title;
      if (!row.category && s.category) row.category = s.category;
    }
  }

  for (const c of previousChats) {
    for (const s of c.sources) {
      if (s.domain.toLowerCase() !== domain.toLowerCase()) continue;
      const key = s.url || `__nourl__${s.title ?? ""}`;
      prev.set(key, (prev.get(key) || 0) + 1);
    }
  }

  const totalCur = currentChats.length;
  const totalPrev = previousChats.length;

  const rows: UrlRowStat[] = [];
  for (const [key, r] of cur) {
    const actualUrl = key.startsWith("__nourl__") ? "" : key;
    const prevCount = prev.get(key) || 0;
    rows.push({
      url: actualUrl,
      title: r.title,
      urlType: classifyUrl(actualUrl || null, r.title),
      category: r.category,
      retrievals: r.retrievals,
      retrievalsDelta: r.retrievals - prevCount,
      citationRate: totalCur > 0 ? (r.retrievals / totalCur) * 100 : 0,
      citationRateDelta:
        totalCur > 0 && totalPrev > 0
          ? (r.retrievals / totalCur) * 100 - (prevCount / totalPrev) * 100
          : 0,
      ownMentioned: r.ownMentioned,
      mentionCount: r.mentionCount,
      lastSeen: r.lastSeen > 0 ? new Date(r.lastSeen).toISOString() : null,
    });
  }
  rows.sort((a, b) => b.retrievals - a.retrievals);
  return rows;
}
