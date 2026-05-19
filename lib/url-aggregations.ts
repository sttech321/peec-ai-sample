// Aggregations specific to the Sources > URLs page. Pure functions, no DB
// access — server fetches ChatFact[] once and the client re-derives per filter.

import type { ChatFact, Resolution } from "./chat-aggregations";

export type UrlType =
  | "Listicle"
  | "Category Page"
  | "Product Page"
  | "Homepage"
  | "Article"
  | "Profile"
  | "Discussion"
  | "Other";

export type DomainType =
  | "You"
  | "Competitor"
  | "Corporate"
  | "Editorial"
  | "Reference"
  | "UGC"
  | "Institutional"
  | "Other"
  | "Related";

export const URL_TYPES: UrlType[] = [
  "Listicle",
  "Category Page",
  "Product Page",
  "Other",
  "Homepage",
  "Article",
  "Profile",
  "Discussion",
];

export const URL_TYPE_COLORS: Record<UrlType, string> = {
  Listicle: "#3b82f6",
  "Category Page": "#f59e0b",
  "Product Page": "#22c55e",
  Homepage: "#a855f7",
  Article: "#ef4444",
  Profile: "#8b5cf6",
  Discussion: "#06b6d4",
  Other: "#94a3b8",
};

const YEAR_RE = /\b(20\d{2})\b/;

export function classifyUrl(url: string | null, title: string | null): UrlType {
  const u = (url ?? "").toLowerCase();
  const t = (title ?? "").toLowerCase();

  // Pull path out of URL safely (works even for malformed input).
  let path = "";
  try {
    const parsed = new URL(u);
    path = parsed.pathname.toLowerCase();
  } catch {
    const m = u.match(/^https?:\/\/[^/]+(\/.*)?$/);
    path = (m?.[1] ?? "").toLowerCase();
  }

  if (!path || path === "/" || path === "/index.html") return "Homepage";

  if (/\/(forum|forums|thread|discussion|question|questions|community)\b/.test(path)) {
    return "Discussion";
  }
  if (/\/(profile|profiles|u|user|users|member|members|@)\b/.test(path)) {
    return "Profile";
  }
  if (/\/(product|products|item|p|sku)\b/.test(path)) {
    return "Product Page";
  }
  if (/\/(category|categories|tag|tags|topic|topics|collection)\b/.test(path)) {
    return "Category Page";
  }

  // Listicle heuristics — title-driven, since most listicles share these signals
  if (
    /\b(best|top|vs\.?|versus|compared|alternatives?)\b/.test(t) ||
    YEAR_RE.test(t) ||
    /\b(list|rankings?|leaderboard)\b/.test(t) ||
    /\/(best|top|vs|alternatives?)[/-]/.test(path)
  ) {
    return "Listicle";
  }

  if (/\/(blog|news|article|articles|post|posts|insights?|resources?|guides?)\b/.test(path)) {
    return "Article";
  }

  return "Other";
}

// Domain type from the stored `category` plus own/competitor lookups.
export function classifyDomain(
  category: string | null,
  domain: string,
  ownDomains: Set<string>,
  competitorDomains: Set<string>,
): DomainType {
  const d = domain.toLowerCase();
  if (ownDomains.has(d)) return "You";
  if (competitorDomains.has(d)) return "Competitor";
  const cat = (category ?? "").toLowerCase();
  const map: Record<string, DomainType> = {
    owned: "Corporate",
    corporate: "Corporate",
    editorial: "Editorial",
    reference: "Reference",
    ugc: "UGC",
    competitor: "Competitor",
    institutional: "Institutional",
  };
  return map[cat] ?? "Other";
}

export const DOMAIN_TYPE_COLORS: Record<DomainType, string> = {
  You: "#16a34a",
  Competitor: "#ef4444",
  Corporate: "#f97316",
  Editorial: "#eab308",
  Reference: "#a855f7",
  UGC: "#3b82f6",
  Institutional: "#ec4899",
  Other: "#94a3b8",
  Related: "#06b6d4",
};

export interface UrlAgg {
  url: string;
  domain: string;
  title: string | null;
  category: string | null;
  retrievals: number;
  retrievalsPrev: number; // for delta arrows
  citationRate: number; // retrievals / total chats × 100
  citationRatePrev: number;
  urlType: UrlType;
  engines: string[]; // distinct engines that retrieved it
  brandMentions: string[]; // distinct brands extracted in chats that retrieved it
  ownMentioned: boolean; // own brand appeared in any chat that retrieved it
  lastSeen: string | null; // ISO of latest chat retrieving it
}

interface BuildOpts {
  ownBrand: string | null;
  ownDomains: Set<string>;
}

// Flatten all sources into per-URL aggregates for the current period, and
// pair with the previous-period retrieval count for delta arrows.
export function aggregateUrls(
  currentChats: ChatFact[],
  previousChats: ChatFact[],
  opts: BuildOpts,
): UrlAgg[] {
  const totalCurrent = currentChats.length;
  const totalPrev = previousChats.length;

  type Row = {
    domain: string;
    title: string | null;
    category: string | null;
    retrievals: number;
    engines: Set<string>;
    brands: Set<string>;
    ownMentioned: boolean;
    lastSeen: number; // epoch ms
  };
  const cur = new Map<string, Row>();

  for (const chat of currentChats) {
    const t = new Date(chat.runDate).getTime();
    const ownInChat = opts.ownBrand
      ? chat.brands.some((b) => b.name === opts.ownBrand)
      : false;
    for (const s of chat.sources) {
      const key = s.url || `${s.domain}__noURL__${s.title ?? ""}`;
      let row = cur.get(key);
      if (!row) {
        row = {
          domain: s.domain,
          title: s.title,
          category: s.category,
          retrievals: 0,
          engines: new Set(),
          brands: new Set(),
          ownMentioned: false,
          lastSeen: 0,
        };
        cur.set(key, row);
      }
      row.retrievals += 1;
      row.engines.add(chat.engine);
      for (const b of chat.brands) row.brands.add(b.name);
      if (ownInChat) row.ownMentioned = true;
      if (t > row.lastSeen) row.lastSeen = t;
      // Prefer a non-empty title if we see one
      if (!row.title && s.title) row.title = s.title;
      if (!row.category && s.category) row.category = s.category;
    }
  }

  const prev = new Map<string, number>();
  for (const chat of previousChats) {
    for (const s of chat.sources) {
      const key = s.url || `${s.domain}__noURL__${s.title ?? ""}`;
      prev.set(key, (prev.get(key) || 0) + 1);
    }
  }

  const rows: UrlAgg[] = [];
  for (const [key, r] of cur) {
    rows.push({
      url: key.startsWith(`${r.domain}__noURL__`) ? "" : key,
      domain: r.domain,
      title: r.title,
      category: r.category,
      retrievals: r.retrievals,
      retrievalsPrev: prev.get(key) || 0,
      citationRate: totalCurrent > 0 ? (r.retrievals / totalCurrent) * 100 : 0,
      citationRatePrev: totalPrev > 0 ? ((prev.get(key) || 0) / totalPrev) * 100 : 0,
      urlType: classifyUrl(key.startsWith(`${r.domain}__noURL__`) ? null : key, r.title),
      engines: Array.from(r.engines),
      brandMentions: Array.from(r.brands),
      ownMentioned: r.ownMentioned,
      lastSeen: r.lastSeen > 0 ? new Date(r.lastSeen).toISOString() : null,
    });
  }
  rows.sort((a, b) => b.retrievals - a.retrievals);
  return rows;
}

// URL type breakdown (count of distinct URLs per type, weighted by retrievals).
export function countByUrlType(urls: UrlAgg[]): {
  type: UrlType;
  retrievals: number;
  share: number; // 0-100
}[] {
  const totals: Record<UrlType, number> = {
    Listicle: 0,
    "Category Page": 0,
    "Product Page": 0,
    Homepage: 0,
    Article: 0,
    Profile: 0,
    Discussion: 0,
    Other: 0,
  };
  let grand = 0;
  for (const u of urls) {
    totals[u.urlType] += u.retrievals;
    grand += u.retrievals;
  }
  return URL_TYPES.map((type) => ({
    type,
    retrievals: totals[type],
    share: grand > 0 ? (totals[type] / grand) * 100 : 0,
  }));
}

// Time-bucketed retrieval series for the top N URLs.
// Independent of chat-aggregations internals to avoid coupling.
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

export interface UrlSeriesPoint {
  date: string;
  [urlKey: string]: number | string;
}

export function buildUrlRetrievalSeries(
  chats: ChatFact[],
  urlKeys: string[],
  resolution: Resolution,
  range: { start: Date; end: Date },
): UrlSeriesPoint[] {
  const tl = timelineForRange(range.start, range.end, resolution);
  const keys = new Set(urlKeys);
  const bucketHits = new Map<string, Map<string, number>>();
  for (const c of chats) {
    const key = bucketStart(new Date(c.runDate), resolution).toISOString();
    let inner = bucketHits.get(key);
    if (!inner) {
      inner = new Map();
      bucketHits.set(key, inner);
    }
    for (const s of c.sources) {
      const urlKey = s.url || `${s.domain}__noURL__${s.title ?? ""}`;
      if (!keys.has(urlKey)) continue;
      inner.set(urlKey, (inner.get(urlKey) || 0) + 1);
    }
  }

  return tl.map((d) => {
    const key = d.toISOString();
    const hits = bucketHits.get(key);
    const point: UrlSeriesPoint = { date: formatLabel(d, resolution) };
    for (const k of urlKeys) point[k] = hits?.get(k) || 0;
    return point;
  });
}

export function totalRetrievals(urls: UrlAgg[]): number {
  let n = 0;
  for (const u of urls) n += u.retrievals;
  return n;
}

// Shorten URL for table display: domain + path with mid-truncation
export function displayUrl(url: string, domain: string): string {
  if (!url) return domain;
  try {
    const p = new URL(url);
    const path = p.pathname + p.search;
    const max = 80;
    if (path.length <= max) return p.host + path;
    return p.host + path.slice(0, max - 1) + "…";
  } catch {
    return url.length > 80 ? url.slice(0, 79) + "…" : url;
  }
}

// Format "X hr ago" / "X days ago" relative time.
export function formatRelative(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = now.getTime() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  if (diff < 86_400_000 * 30) return `${Math.floor(diff / 86_400_000)} days ago`;
  if (diff < 86_400_000 * 365) return `${Math.floor(diff / (86_400_000 * 30))} months ago`;
  return `${Math.floor(diff / (86_400_000 * 365))} years ago`;
}
