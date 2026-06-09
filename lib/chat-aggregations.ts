// Pure client-safe aggregation helpers driven by a flat ChatFact array.
// Server fetches ChatFacts once; clients re-derive everything when the
// engine/model filter changes.

export interface ChatBrandFact {
  name: string;
  sentiment: number | null;
  position: number | null;
}

export interface ChatSourceFact {
  domain: string;
  category: string | null;
  url: string | null;
  title: string | null;
}

export interface ChatFact {
  id: string;
  engine: string;
  runDate: string; // ISO
  query: string | null;
  rawResponse: string | null;
  brands: ChatBrandFact[];
  sources: ChatSourceFact[];
}

export interface BrandAgg {
  name: string;
  count: number;
  sentiment: number;
  position: number;
  color: string;
}

export interface DomainAgg {
  domain: string;
  count: number;
  category: string | null;
}

export interface ChatRecordView {
  id: string;
  engine: string;
  runDate: string;
  brandsFound: string[];
  sourcesFound: { domain: string; title: string | null; url: string | null }[];
  avgSentiment: number;
  avgPosition: number;
  rawResponse?: string | null;
  query?: string | null;
}

export interface SeriesPoint {
  date: string;
  [brandName: string]: number | string;
}

export type Resolution = "D" | "W" | "M";

const BUCKETS: Record<Resolution, number> = { D: 30, W: 12, M: 6 };

const DEFAULT_PALETTE = [
  "#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444",
  "#14b8a6", "#eab308", "#ec4899", "#6366f1", "#06b6d4",
];

export function filterByEngines(chats: ChatFact[], selected: string[]): ChatFact[] {
  if (selected.length === 0) return chats; // empty = all engines selected (show all)
  const set = new Set(selected);
  return chats.filter((c) => set.has(c.engine));
}

export interface DateRange {
  start: Date;
  end: Date;
}

export function filterByDateRange(chats: ChatFact[], range: DateRange | null): ChatFact[] {
  if (!range) return chats;
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  return chats.filter((c) => {
    const t = new Date(c.runDate).getTime();
    return t >= startMs && t <= endMs;
  });
}

export function aggregateBrands(
  chats: ChatFact[],
  topN: number,
  palette: string[] = DEFAULT_PALETTE,
  colorMap?: Record<string, string>,
): BrandAgg[] {
  const counts = new Map<string, { count: number; sentSum: number; sentN: number; posSum: number; posN: number }>();
  for (const c of chats) {
    const seen = new Set<string>();
    for (const b of c.brands) {
      if (seen.has(b.name)) continue;
      seen.add(b.name);
      let entry = counts.get(b.name);
      if (!entry) {
        entry = { count: 0, sentSum: 0, sentN: 0, posSum: 0, posN: 0 };
        counts.set(b.name, entry);
      }
      entry.count += 1;
      if (b.sentiment != null) { entry.sentSum += b.sentiment; entry.sentN += 1; }
      if (b.position != null) { entry.posSum += b.position; entry.posN += 1; }
    }
  }
  const sorted = Array.from(counts.entries())
    .map(([name, e]) => ({
      name,
      count: e.count,
      sentiment: e.sentN > 0 ? e.sentSum / e.sentN : 0,
      position: e.posN > 0 ? e.posSum / e.posN : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  return sorted.map((b, i) => ({
    ...b,
    color: colorMap?.[b.name] ?? palette[i % palette.length],
  }));
}

export function aggregateDomains(chats: ChatFact[], topN: number): DomainAgg[] {
  const map = new Map<string, { count: number; category: string | null }>();
  for (const c of chats) {
    for (const s of c.sources) {
      const key = `${s.domain}::${s.category ?? ""}`;
      let entry = map.get(key);
      if (!entry) {
        entry = { count: 0, category: s.category };
        map.set(key, entry);
      }
      entry.count += 1;
    }
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ domain: key.split("::")[0], count: v.count, category: v.category }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

export function totalCitations(chats: ChatFact[]): number {
  let n = 0;
  for (const c of chats) n += c.sources.length;
  return n;
}

export interface CategoryStats {
  count: number;
  topSources: { domain: string; count: number }[];
}

export function aggregateByCategory(
  chats: ChatFact[],
  categorize: (category: string | null, domain: string) => string,
  topSourcesPerCategory = 6,
): Record<string, CategoryStats> {
  const buckets: Record<string, Map<string, number>> = {};
  for (const c of chats) {
    for (const s of c.sources) {
      const label = categorize(s.category, s.domain);
      if (!buckets[label]) buckets[label] = new Map();
      buckets[label].set(s.domain, (buckets[label].get(s.domain) || 0) + 1);
    }
  }
  const result: Record<string, CategoryStats> = {};
  for (const [label, domainMap] of Object.entries(buckets)) {
    let count = 0;
    const sources: { domain: string; count: number }[] = [];
    for (const [domain, n] of domainMap) {
      count += n;
      sources.push({ domain, count: n });
    }
    sources.sort((a, b) => b.count - a.count);
    result[label] = { count, topSources: sources.slice(0, topSourcesPerCategory) };
  }
  return result;
}

export function toChatRecords(chats: ChatFact[]): ChatRecordView[] {
  return chats.map((c) => {
    const sentiments = c.brands.map((b) => b.sentiment).filter((v): v is number => v != null);
    const positions = c.brands.map((b) => b.position).filter((v): v is number => v != null);
    return {
      id: c.id,
      engine: c.engine,
      runDate: c.runDate,
      brandsFound: Array.from(new Set(c.brands.map((b) => b.name))),
      sourcesFound: c.sources.map((s) => ({ domain: s.domain, title: s.title, url: s.url })),
      avgSentiment: sentiments.length ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : 0,
      avgPosition: positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : 0,
      rawResponse: c.rawResponse,
      query: c.query,
    };
  });
}

// ── Visibility series ──────────────────────────────────────────────────────
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
function timeline(now: Date, res: Resolution): Date[] {
  const count = BUCKETS[res];
  const out: Date[] = [];
  const anchor = bucketStart(now, res);
  for (let i = count - 1; i >= 0; i--) {
    const b = new Date(anchor);
    if (res === "D") b.setDate(b.getDate() - i);
    else if (res === "W") b.setDate(b.getDate() - i * 7);
    else b.setMonth(b.getMonth() - i);
    out.push(b);
  }
  return out;
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

export function buildVisibilitySeries(
  chats: ChatFact[],
  brandNames: string[],
  resolution: Resolution,
  range?: DateRange | null,
  now: Date = new Date(),
): SeriesPoint[] {
  const tl = range ? timelineForRange(range.start, range.end, resolution) : timeline(now, resolution);
  if (brandNames.length === 0) return tl.map((b) => ({ date: formatLabel(b, resolution) }));

  const earliest = tl[0].getTime();
  const totalsByBucket = new Map<string, number>();
  const brandHitsByBucket = new Map<string, Map<string, number>>();

  for (const c of chats) {
    const dt = new Date(c.runDate);
    if (dt.getTime() < earliest) continue;
    const key = bucketStart(dt, resolution).toISOString();
    totalsByBucket.set(key, (totalsByBucket.get(key) || 0) + 1);
    const seen = new Set<string>();
    let inner = brandHitsByBucket.get(key);
    if (!inner) {
      inner = new Map();
      brandHitsByBucket.set(key, inner);
    }
    for (const b of c.brands) {
      if (seen.has(b.name)) continue;
      seen.add(b.name);
      if (!brandNames.includes(b.name)) continue;
      inner.set(b.name, (inner.get(b.name) || 0) + 1);
    }
  }

  return tl.map((b) => {
    const key = b.toISOString();
    const total = totalsByBucket.get(key) || 0;
    const hits = brandHitsByBucket.get(key);
    const point: SeriesPoint = { date: formatLabel(b, resolution) };
    for (const name of brandNames) {
      const h = hits?.get(name) || 0;
      point[name] = total > 0 ? Math.round((h / total) * 100) : 0;
    }
    return point;
  });
}

/** Sentiment over time for one brand (0-100 scale, NaN bucket → 0) */
export function buildSentimentSeries(
  chats: ChatFact[],
  brandName: string,
  resolution: Resolution,
  range?: DateRange | null,
  now: Date = new Date(),
): SeriesPoint[] {
  const tl = range ? timelineForRange(range.start, range.end, resolution) : timeline(now, resolution);
  const earliest = tl[0].getTime();
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const c of chats) {
    const dt = new Date(c.runDate);
    if (dt.getTime() < earliest) continue;
    const key = bucketStart(dt, resolution).toISOString();
    for (const b of c.brands) {
      if (b.name !== brandName || b.sentiment == null) continue;
      const cur = buckets.get(key) ?? { sum: 0, count: 0 };
      cur.sum += b.sentiment;
      cur.count += 1;
      buckets.set(key, cur);
    }
  }
  return tl.map((b) => {
    const key = b.toISOString();
    const v = buckets.get(key);
    const point: SeriesPoint = { date: formatLabel(b, resolution) };
    point[brandName] = v && v.count > 0 ? Math.round((v.sum / v.count) * 10) / 10 : 0;
    return point;
  });
}

/** Average position over time for one brand (lower = better) */
export function buildPositionSeries(
  chats: ChatFact[],
  brandName: string,
  resolution: Resolution,
  range?: DateRange | null,
  now: Date = new Date(),
): SeriesPoint[] {
  const tl = range ? timelineForRange(range.start, range.end, resolution) : timeline(now, resolution);
  const earliest = tl[0].getTime();
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const c of chats) {
    const dt = new Date(c.runDate);
    if (dt.getTime() < earliest) continue;
    const key = bucketStart(dt, resolution).toISOString();
    for (const b of c.brands) {
      if (b.name !== brandName || b.position == null) continue;
      const cur = buckets.get(key) ?? { sum: 0, count: 0 };
      cur.sum += b.position;
      cur.count += 1;
      buckets.set(key, cur);
    }
  }
  return tl.map((b) => {
    const key = b.toISOString();
    const v = buckets.get(key);
    const point: SeriesPoint = { date: formatLabel(b, resolution) };
    point[brandName] = v && v.count > 0 ? Math.round((v.sum / v.count) * 10) / 10 : 0;
    return point;
  });
}

/** Share of Voice over time for one brand (0-100) */
export function buildSovSeries(
  chats: ChatFact[],
  brandName: string,
  resolution: Resolution,
  range?: DateRange | null,
  now: Date = new Date(),
): SeriesPoint[] {
  const tl = range ? timelineForRange(range.start, range.end, resolution) : timeline(now, resolution);
  const earliest = tl[0].getTime();
  const buckets = new Map<string, { hits: number; total: number }>();
  for (const c of chats) {
    const dt = new Date(c.runDate);
    if (dt.getTime() < earliest) continue;
    const key = bucketStart(dt, resolution).toISOString();
    const cur = buckets.get(key) ?? { hits: 0, total: 0 };
    const seen = new Set<string>();
    for (const b of c.brands) {
      if (seen.has(b.name)) continue;
      seen.add(b.name);
      cur.total += 1;
      if (b.name === brandName) cur.hits += 1;
    }
    buckets.set(key, cur);
  }
  return tl.map((b) => {
    const key = b.toISOString();
    const v = buckets.get(key);
    const point: SeriesPoint = { date: formatLabel(b, resolution) };
    point[brandName] = v && v.total > 0 ? Math.round((v.hits / v.total) * 1000) / 10 : 0;
    return point;
  });
}

/** Domain retrieval % over time — % of chats where domain is cited */
export function buildDomainRetrievalSeries(
  chats: ChatFact[],
  domain: string,
  resolution: Resolution,
  range?: DateRange | null,
  now: Date = new Date(),
): SeriesPoint[] {
  const tl = range ? timelineForRange(range.start, range.end, resolution) : timeline(now, resolution);
  const earliest = tl[0].getTime();
  const normDomain = domain.toLowerCase().replace(/^www\./, "");
  const buckets = new Map<string, { hits: number; total: number }>();
  for (const c of chats) {
    const dt = new Date(c.runDate);
    if (dt.getTime() < earliest) continue;
    const key = bucketStart(dt, resolution).toISOString();
    const cur = buckets.get(key) ?? { hits: 0, total: 0 };
    cur.total += 1;
    const cited = c.sources.some(s => s.domain.toLowerCase().replace(/^www\./, "") === normDomain);
    if (cited) cur.hits += 1;
    buckets.set(key, cur);
  }
  return tl.map((b) => {
    const key = b.toISOString();
    const v = buckets.get(key);
    const point: SeriesPoint = { date: formatLabel(b, resolution) };
    point[domain] = v && v.total > 0 ? Math.round((v.hits / v.total) * 1000) / 10 : 0;
    return point;
  });
}

// ── Insights aggregations ─────────────────────────────────────────────────

export interface BrandEngineCell {
  brand: string;
  engine: string;
  visibility: number; // 0-100
  sentiment: number;  // 0-100 avg
  position: number;   // avg rank (lower is better)
  sov: number;        // 0-100 share of voice
  hits: number;
  total: number;
}

type BrandStats = {
  hits: number;
  sentSum: number; sentN: number;
  posSum: number; posN: number;
};

// Build a brand × engine performance matrix returning visibility, sentiment,
// position, and SoV for every (brand, engine) pair present in `chats`.
export function buildPerformanceMatrix(
  chats: ChatFact[],
  brandNames: string[],
  engines: string[],
): BrandEngineCell[] {
  const totals = new Map<string, number>(); // engine -> chat count
  for (const eng of engines) totals.set(eng, 0);

  const byEngine = new Map<string, Map<string, BrandStats>>();
  const totalMentions = new Map<string, number>(); // all-brand mention count per engine (for SoV denominator)
  for (const eng of engines) {
    byEngine.set(eng, new Map());
    totalMentions.set(eng, 0);
  }

  for (const c of chats) {
    if (!totals.has(c.engine)) continue;
    totals.set(c.engine, (totals.get(c.engine) || 0) + 1);
    const seen = new Set<string>();
    const engineMap = byEngine.get(c.engine)!;
    for (const b of c.brands) {
      if (seen.has(b.name)) continue;
      seen.add(b.name);
      totalMentions.set(c.engine, (totalMentions.get(c.engine) || 0) + 1);
      if (!brandNames.includes(b.name)) continue;
      let stats = engineMap.get(b.name);
      if (!stats) {
        stats = { hits: 0, sentSum: 0, sentN: 0, posSum: 0, posN: 0 };
        engineMap.set(b.name, stats);
      }
      stats.hits += 1;
      if (b.sentiment != null) { stats.sentSum += b.sentiment; stats.sentN += 1; }
      if (b.position != null) { stats.posSum += b.position; stats.posN += 1; }
    }
  }

  const out: BrandEngineCell[] = [];
  for (const brand of brandNames) {
    for (const engine of engines) {
      const total = totals.get(engine) || 0;
      const stats = byEngine.get(engine)?.get(brand);
      const h = stats?.hits || 0;
      const tbo = totalMentions.get(engine) || 0;
      out.push({
        brand,
        engine,
        hits: h,
        total,
        visibility: total > 0 ? (h / total) * 100 : 0,
        sentiment: stats && stats.sentN > 0 ? stats.sentSum / stats.sentN : 0,
        position: stats && stats.posN > 0 ? stats.posSum / stats.posN : 0,
        sov: tbo > 0 ? (h / tbo) * 100 : 0,
      });
    }
  }
  return out;
}

/**
 * Performance matrix grouped by topic or tag instead of engine.
 * groupMap: chatId → groupKey (topics) or chatId → groupKey[] (tags)
 * Returns same BrandEngineCell shape — "engine" field holds the group key.
 */
export function buildPerformanceMatrixByGroup(
  chats: ChatFact[],
  brandNames: string[],
  groupMap: Record<string, string | string[]>,
): BrandEngineCell[] {
  // Collect unique group keys
  const allGroups = new Set<string>();
  for (const val of Object.values(groupMap)) {
    if (Array.isArray(val)) val.forEach(v => allGroups.add(v));
    else allGroups.add(val);
  }

  const out: BrandEngineCell[] = [];

  for (const group of allGroups) {
    const groupChats = chats.filter(c => {
      const v = groupMap[c.id];
      if (!v) return false;
      return Array.isArray(v) ? v.includes(group) : v === group;
    });

    const total = groupChats.length;
    const brandStats = new Map<string, { hits: number; sentSum: number; sentN: number; posSum: number; posN: number }>();
    let totalMentions = 0;

    for (const c of groupChats) {
      const seen = new Set<string>();
      for (const b of c.brands) {
        if (seen.has(b.name)) continue;
        seen.add(b.name);
        totalMentions++;
        if (!brandNames.includes(b.name)) continue;
        let s = brandStats.get(b.name);
        if (!s) { s = { hits: 0, sentSum: 0, sentN: 0, posSum: 0, posN: 0 }; brandStats.set(b.name, s); }
        s.hits += 1;
        if (b.sentiment != null) { s.sentSum += b.sentiment; s.sentN += 1; }
        if (b.position  != null) { s.posSum  += b.position;  s.posN  += 1; }
      }
    }

    for (const brand of brandNames) {
      const s = brandStats.get(brand);
      const h = s?.hits || 0;
      out.push({
        brand,
        engine: group, // group key stored in "engine" field
        hits: h,
        total,
        visibility: total > 0 ? (h / total) * 100 : 0,
        sentiment:  s && s.sentN > 0 ? s.sentSum / s.sentN : 0,
        position:   s && s.posN  > 0 ? s.posSum  / s.posN  : 0,
        sov:        totalMentions > 0 ? (h / totalMentions) * 100 : 0,
      });
    }
  }
  return out;
}

/** Generic top-N per engine, sortable by any metric. */
export interface RankEntry {
  brand: string;
  visibility: number;
  sentiment: number;
  position: number;
  sov: number;
  hits: number;
  total: number;
}

export function buildTopRankingsBy(
  chats: ChatFact[],
  engines: string[],
  metric: "visibility" | "sentiment" | "position" | "sov",
  topN = 10,
): Record<string, RankEntry[]> {
  const out: Record<string, RankEntry[]> = {};

  for (const engine of engines) {
    const engineChats = chats.filter(c => c.engine === engine);
    const total = engineChats.length;
    const map = new Map<string, { hits: number; sentSum: number; sentN: number; posSum: number; posN: number }>();

    for (const c of engineChats) {
      const seen = new Set<string>();
      for (const b of c.brands) {
        if (seen.has(b.name)) continue;
        seen.add(b.name);
        let s = map.get(b.name);
        if (!s) { s = { hits: 0, sentSum: 0, sentN: 0, posSum: 0, posN: 0 }; map.set(b.name, s); }
        s.hits += 1;
        if (b.sentiment != null) { s.sentSum += b.sentiment; s.sentN += 1; }
        if (b.position  != null) { s.posSum  += b.position;  s.posN  += 1; }
      }
    }

    // Total brand mentions across engine (for SoV)
    let totalMentions = 0;
    for (const s of map.values()) totalMentions += s.hits;

    const entries: RankEntry[] = Array.from(map.entries()).map(([brand, s]) => ({
      brand,
      hits: s.hits,
      total,
      visibility: total > 0 ? (s.hits / total) * 100 : 0,
      sentiment:  s.sentN > 0 ? s.sentSum / s.sentN : 0,
      position:   s.posN  > 0 ? s.posSum  / s.posN  : 0,
      sov:        totalMentions > 0 ? (s.hits / totalMentions) * 100 : 0,
    }));

    // Sort: position ascending (lower = better), others descending
    entries.sort((a, b) =>
      metric === "position"
        ? (a.position || 999) - (b.position || 999)
        : (b[metric] || 0) - (a[metric] || 0)
    );

    out[engine] = entries.slice(0, topN);
  }
  return out;
}

/**
 * Rankings grouped by topic OR tag instead of engine.
 * groupMap: chatId → groupKey  (for topics, one key per chat)
 *           chatId → groupKey[] (for tags, multiple keys per chat)
 */
export function buildTopRankingsByGroup(
  chats: ChatFact[],
  groupMap: Record<string, string | string[]>,
  metric: "visibility" | "sentiment" | "position" | "sov",
  topN = 10,
): Record<string, RankEntry[]> {
  // Collect all group keys
  const allGroups = new Set<string>();
  for (const val of Object.values(groupMap)) {
    if (Array.isArray(val)) val.forEach(v => allGroups.add(v));
    else allGroups.add(val);
  }
  if (allGroups.size === 0) return {};

  const out: Record<string, RankEntry[]> = {};

  for (const group of allGroups) {
    // Filter chats that belong to this group
    const groupChats = chats.filter(c => {
      const v = groupMap[c.id];
      if (!v) return false;
      return Array.isArray(v) ? v.includes(group) : v === group;
    });

    if (groupChats.length === 0) continue;

    const total = groupChats.length;
    const map = new Map<string, { hits: number; sentSum: number; sentN: number; posSum: number; posN: number }>();

    for (const c of groupChats) {
      const seen = new Set<string>();
      for (const b of c.brands) {
        if (seen.has(b.name)) continue;
        seen.add(b.name);
        let s = map.get(b.name);
        if (!s) { s = { hits: 0, sentSum: 0, sentN: 0, posSum: 0, posN: 0 }; map.set(b.name, s); }
        s.hits += 1;
        if (b.sentiment != null) { s.sentSum += b.sentiment; s.sentN += 1; }
        if (b.position  != null) { s.posSum  += b.position;  s.posN  += 1; }
      }
    }

    let totalMentions = 0;
    for (const s of map.values()) totalMentions += s.hits;

    const entries: RankEntry[] = Array.from(map.entries()).map(([brand, s]) => ({
      brand, hits: s.hits, total,
      visibility: total > 0 ? (s.hits / total) * 100 : 0,
      sentiment:  s.sentN > 0 ? s.sentSum / s.sentN : 0,
      position:   s.posN  > 0 ? s.posSum  / s.posN  : 0,
      sov:        totalMentions > 0 ? (s.hits / totalMentions) * 100 : 0,
    }));

    entries.sort((a, b) =>
      metric === "position"
        ? (a.position || 999) - (b.position || 999)
        : (b[metric] || 0) - (a[metric] || 0)
    );

    out[group] = entries.slice(0, topN);
  }
  return out;
}

// Top N brands per engine, ranked by visibility (desc).
export function buildTopRankings(
  chats: ChatFact[],
  engines: string[],
  topN = 10,
): Record<string, { brand: string; visibility: number; hits: number; total: number }[]> {
  const out: Record<string, { brand: string; visibility: number; hits: number; total: number }[]> = {};

  for (const engine of engines) {
    const engineChats = chats.filter((c) => c.engine === engine);
    const total = engineChats.length;
    const counts = new Map<string, number>();
    for (const c of engineChats) {
      const seen = new Set<string>();
      for (const b of c.brands) {
        if (seen.has(b.name)) continue;
        seen.add(b.name);
        counts.set(b.name, (counts.get(b.name) || 0) + 1);
      }
    }
    const ranked = Array.from(counts.entries())
      .map(([brand, hits]) => ({
        brand,
        hits,
        total,
        visibility: total > 0 ? (hits / total) * 100 : 0,
      }))
      .sort((a, b) => b.visibility - a.visibility || b.hits - a.hits)
      .slice(0, topN);
    out[engine] = ranked;
  }
  return out;
}

export interface BrandKpi {
  visibility: number; // 0-100, average across engines
  sentiment: number; // 0-100, average across mentions
  position: number; // avg rank
  sov: number; // share of voice, 0-100
  strongestEngine: string | null;
  weakestEngine: string | null;
  perEngineVisibility: Record<string, number>;
}

// Compute the brand-level KPIs for a single target brand from chat facts.
export function computeBrandKpis(
  chats: ChatFact[],
  brand: string,
  engines: string[],
): BrandKpi {
  let mentions = 0;
  let totalMentions = 0;
  let sentSum = 0;
  let sentN = 0;
  let posSum = 0;
  let posN = 0;

  const perEngine: Record<string, { hits: number; total: number }> = {};
  for (const eng of engines) perEngine[eng] = { hits: 0, total: 0 };

  for (const c of chats) {
    if (perEngine[c.engine]) perEngine[c.engine].total += 1;
    const seen = new Set<string>();
    for (const b of c.brands) {
      if (seen.has(b.name)) continue;
      seen.add(b.name);
      totalMentions += 1;
      if (b.name === brand) {
        mentions += 1;
        if (perEngine[c.engine]) perEngine[c.engine].hits += 1;
        if (b.sentiment != null) { sentSum += b.sentiment; sentN += 1; }
        if (b.position != null) { posSum += b.position; posN += 1; }
      }
    }
  }

  const perEngineVisibility: Record<string, number> = {};
  for (const [eng, v] of Object.entries(perEngine)) {
    perEngineVisibility[eng] = v.total > 0 ? (v.hits / v.total) * 100 : 0;
  }

  // Overall visibility = mentions / total chats with any data for this brand's engines
  const totalChats = Object.values(perEngine).reduce((s, v) => s + v.total, 0);
  const visibility = totalChats > 0 ? (mentions / totalChats) * 100 : 0;

  // Strongest / weakest engine — only consider engines where the brand
  // actually shows up at least once; otherwise the labels are misleading.
  const engineEntries = Object.entries(perEngineVisibility).filter(
    ([eng]) => perEngine[eng].total > 0 && perEngine[eng].hits > 0,
  );
  let strongestEngine: string | null = null;
  let weakestEngine: string | null = null;
  if (engineEntries.length > 0) {
    engineEntries.sort((a, b) => b[1] - a[1]);
    strongestEngine = engineEntries[0][0];
    weakestEngine = engineEntries[engineEntries.length - 1][0];
  }

  return {
    visibility,
    sentiment: sentN > 0 ? sentSum / sentN : 0,
    position: posN > 0 ? posSum / posN : 0,
    sov: totalMentions > 0 ? (mentions / totalMentions) * 100 : 0,
    strongestEngine,
    weakestEngine,
    perEngineVisibility,
  };
}

// Compute the previous-period date range matching `range`. Used for delta arrows.
export function previousPeriod(range: DateRange): DateRange {
  const span = range.end.getTime() - range.start.getTime();
  return {
    end: new Date(range.start.getTime() - 1),
    start: new Date(range.start.getTime() - 1 - span),
  };
}
