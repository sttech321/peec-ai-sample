// Domain-level aggregations for the Sources > Domains page.
// Pure functions — server fetches ChatFact[] once, client re-derives per filter.

import type { ChatFact, Resolution } from "./chat-aggregations";
import { classifyDomain, DOMAIN_TYPE_COLORS, type DomainType } from "./url-aggregations";

export { DOMAIN_TYPE_COLORS, classifyDomain };
export type { DomainType };

export const DOMAIN_TYPES: DomainType[] = [
  "Corporate",
  "You",
  "Competitor",
  "UGC",
  "Other",
  "Reference",
  "Editorial",
  "Institutional",
  "Related",
];

export interface DomainAggFull {
  domain: string;
  citations: number;
  citationsPrev: number;
  chatsCiting: number; // distinct chats that referenced this domain
  chatsCitingPrev: number;
  retrievedShare: number; // share of total citations in window (0-100)
  retrievedSharePrev: number;
  retrievalRate: number; // citations / total_chats (avg per chat)
  retrievalRatePrev: number;
  citationRate: number; // citations / chats_citing (avg when cited)
  citationRatePrev: number;
  category: string | null; // representative source.category for the domain
}

interface BuildOpts {
  ownDomains: Set<string>;
  competitorDomains: Set<string>;
}

function buildBucket(
  chats: ChatFact[],
): {
  byDomain: Map<string, { citations: number; chats: Set<string>; category: string | null }>;
  totalCitations: number;
  totalChats: number;
} {
  const byDomain = new Map<
    string,
    { citations: number; chats: Set<string>; category: string | null }
  >();
  let totalCitations = 0;
  for (const c of chats) {
    for (const s of c.sources) {
      const dom = s.domain.toLowerCase();
      totalCitations += 1;
      let row = byDomain.get(dom);
      if (!row) {
        row = { citations: 0, chats: new Set(), category: s.category };
        byDomain.set(dom, row);
      }
      row.citations += 1;
      row.chats.add(c.id);
      if (!row.category && s.category) row.category = s.category;
    }
  }
  return { byDomain, totalCitations, totalChats: chats.length };
}

export function aggregateDomainsFull(
  currentChats: ChatFact[],
  previousChats: ChatFact[],
): DomainAggFull[] {
  const cur = buildBucket(currentChats);
  const prev = buildBucket(previousChats);

  const rows: DomainAggFull[] = [];
  for (const [domain, r] of cur.byDomain) {
    const p = prev.byDomain.get(domain);
    const citations = r.citations;
    const citationsPrev = p?.citations ?? 0;
    const chatsCiting = r.chats.size;
    const chatsCitingPrev = p?.chats.size ?? 0;
    rows.push({
      domain,
      citations,
      citationsPrev,
      chatsCiting,
      chatsCitingPrev,
      retrievedShare: cur.totalCitations > 0 ? (citations / cur.totalCitations) * 100 : 0,
      retrievedSharePrev:
        prev.totalCitations > 0 ? (citationsPrev / prev.totalCitations) * 100 : 0,
      retrievalRate: cur.totalChats > 0 ? citations / cur.totalChats : 0,
      retrievalRatePrev: prev.totalChats > 0 ? citationsPrev / prev.totalChats : 0,
      citationRate: chatsCiting > 0 ? citations / chatsCiting : 0,
      citationRatePrev: chatsCitingPrev > 0 ? citationsPrev / chatsCitingPrev : 0,
      category: r.category,
    });
  }

  rows.sort((a, b) => b.citations - a.citations);
  return rows;
}

export interface DomainTypeStat {
  type: DomainType;
  citations: number;
  share: number; // 0-100
}

export function countByDomainType(
  domains: DomainAggFull[],
  opts: BuildOpts,
): DomainTypeStat[] {
  const totals: Record<DomainType, number> = {
    You: 0,
    Competitor: 0,
    Corporate: 0,
    Editorial: 0,
    Reference: 0,
    UGC: 0,
    Institutional: 0,
    Other: 0,
    Related: 0,
  };
  let grand = 0;
  for (const d of domains) {
    const t = classifyDomain(d.category, d.domain, opts.ownDomains, opts.competitorDomains);
    totals[t] += d.citations;
    grand += d.citations;
  }
  return DOMAIN_TYPES.map((type) => ({
    type,
    citations: totals[type],
    share: grand > 0 ? (totals[type] / grand) * 100 : 0,
  }));
}

export function totalCitations(domains: DomainAggFull[]): number {
  let n = 0;
  for (const d of domains) n += d.citations;
  return n;
}

// ── Time series ─────────────────────────────────────────────────────────
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
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
  const startBucket = bucketStart(start, res);
  const endBucket = bucketStart(end, res);
  const out: Date[] = [];
  const cur = new Date(startBucket);
  while (cur.getTime() <= endBucket.getTime()) {
    out.push(new Date(cur));
    if (res === "D") cur.setDate(cur.getDate() + 1);
    else if (res === "W") cur.setDate(cur.getDate() + 7);
    else cur.setMonth(cur.getMonth() + 1);
  }
  const cap = MAX_BUCKETS[res];
  return out.length > cap ? out.slice(-cap) : out;
}

export interface DomainSeriesPoint {
  date: string;
  [domain: string]: number | string;
}

// For each bucket: share of total citations in that bucket (0-100) per domain.
export function buildDomainShareSeries(
  chats: ChatFact[],
  domains: string[],
  resolution: Resolution,
  range: { start: Date; end: Date },
): DomainSeriesPoint[] {
  const tl = timelineForRange(range.start, range.end, resolution);
  const targets = new Set(domains.map((d) => d.toLowerCase()));

  // bucket -> { domain -> hits, total }
  const totals = new Map<string, number>();
  const perBucket = new Map<string, Map<string, number>>();
  for (const c of chats) {
    const key = bucketStart(new Date(c.runDate), resolution).toISOString();
    for (const s of c.sources) {
      totals.set(key, (totals.get(key) || 0) + 1);
      const d = s.domain.toLowerCase();
      if (!targets.has(d)) continue;
      let inner = perBucket.get(key);
      if (!inner) {
        inner = new Map();
        perBucket.set(key, inner);
      }
      inner.set(d, (inner.get(d) || 0) + 1);
    }
  }

  return tl.map((b) => {
    const key = b.toISOString();
    const total = totals.get(key) || 0;
    const hits = perBucket.get(key);
    const point: DomainSeriesPoint = { date: formatLabel(b, resolution) };
    for (const d of domains) {
      const h = hits?.get(d.toLowerCase()) || 0;
      point[d] = total > 0 ? (h / total) * 100 : 0;
    }
    return point;
  });
}
