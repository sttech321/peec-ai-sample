"use client";

import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ChevronDown } from "lucide-react";
import EngineIcon from "./EngineIcon";
import DateRangeDropdown, { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import BrandsDropdown from "./BrandsDropdown";
import {
  ChatFact, Resolution,
  filterByEngines, filterByDateRange,
  buildVisibilitySeries, buildPerformanceMatrix, buildTopRankings,
  computeBrandKpis, previousPeriod,
} from "../lib/chat-aggregations";

interface ProjectBrand {
  name: string;
  isOwn: boolean;
}

interface Props {
  chatFacts: ChatFact[];
  projectName: string;
  projectBrands: ProjectBrand[];
  ownBrandName: string | null;
  ownDomain: string | null;
}

const DEFAULT_ENGINES = ["AI Mode", "ChatGPT", "AI Overview", "Gemini", "Perplexity"];

function formatPercent(n: number, digits = 1): string {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

function formatDelta(diff: number, suffix = "%"): { text: string; tone: "up" | "down" | "flat" } {
  if (!isFinite(diff) || Math.abs(diff) < 0.05) return { text: `0${suffix}`, tone: "flat" };
  const sign = diff > 0 ? "+" : "";
  return {
    text: `${sign}${diff.toFixed(1)}${suffix}`,
    tone: diff > 0 ? "up" : "down",
  };
}

// Map a 0-100 visibility to a heatmap class (matches the 11-color legend).
function heatBucket(v: number): string {
  if (v < 0.5) return "h0";
  if (v < 10) return "h1";
  if (v < 20) return "h2";
  if (v < 30) return "h3";
  if (v < 40) return "h4";
  if (v < 50) return "h5";
  if (v < 60) return "h6";
  if (v < 70) return "h7";
  if (v < 80) return "h8";
  if (v < 90) return "h9";
  return "h10";
}

function normalizeDomain(d: string | null | undefined): string | null {
  if (!d) return null;
  const cleaned = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  return cleaned || null;
}

export default function InsightsClient({ chatFacts, projectName, projectBrands, ownBrandName, ownDomain }: Props) {
  const [resolution, setResolution] = useState<Resolution>("D");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => makePresetRange("30"));
  const [selectedBrands, setSelectedBrands] = useState<string[] | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [tagsDropdownOpen, setTagsDropdownOpen] = useState(false);

  const allEngines = useMemo(() => {
    const set = new Set<string>();
    for (const c of chatFacts) set.add(c.engine);
    const found = Array.from(set);
    for (const d of DEFAULT_ENGINES) if (!found.includes(d)) found.push(d);
    return found;
  }, [chatFacts]);
  const [selectedModels, setSelectedModels] = useState<string[]>(allEngines);

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model],
    );
  };

  const filteredChats = useMemo(
    () => filterByDateRange(filterByEngines(chatFacts, selectedModels), dateRange),
    [chatFacts, selectedModels, dateRange],
  );
  // Previous period only makes sense for bounded ranges; "All time" has nothing before it.
  const previousChats = useMemo(() => {
    if (dateRange.preset === "all") return [];
    const prev = previousPeriod(dateRange);
    return filterByDateRange(filterByEngines(chatFacts, selectedModels), prev);
  }, [chatFacts, selectedModels, dateRange]);
  const showDeltas = dateRange.preset !== "all";

  // Resolve "your" brand — explicit isOwn flag, fall back to project name match.
  const yourBrand = useMemo(() => {
    if (ownBrandName) return ownBrandName;
    const explicit = projectBrands.find((b) => b.isOwn);
    if (explicit) return explicit.name;
    // Fallback: project name (case-insensitive) match
    const lc = projectName.toLowerCase();
    const match = projectBrands.find((b) => b.name.toLowerCase() === lc);
    return match?.name ?? projectName;
  }, [projectBrands, projectName, ownBrandName]);

  // ── KPI computation ──────────────────────────────────────────────────
  const kpi = useMemo(
    () => computeBrandKpis(filteredChats, yourBrand, selectedModels),
    [filteredChats, yourBrand, selectedModels],
  );
  const prevKpi = useMemo(
    () => computeBrandKpis(previousChats, yourBrand, selectedModels),
    [previousChats, yourBrand, selectedModels],
  );

  // Determine "your" overall rank using all engines for ranking.
  const yourRank = useMemo(() => {
    const rankings = buildTopRankings(filteredChats, selectedModels, 50);
    // Average rank across engines where own brand appears
    const ranks: number[] = [];
    for (const eng of selectedModels) {
      const idx = rankings[eng]?.findIndex((r) => r.brand === yourBrand) ?? -1;
      if (idx >= 0) ranks.push(idx + 1);
    }
    if (ranks.length === 0) return null;
    return Math.round(ranks.reduce((s, r) => s + r, 0) / ranks.length);
  }, [filteredChats, selectedModels, yourBrand]);

  // ── Chart data ──────────────────────────────────────────────────────
  const chartBrands = useMemo(() => {
    // Always show "your" brand as the primary line; if user picked others, include them.
    const set = new Set<string>();
    set.add(yourBrand);
    if (selectedBrands) for (const n of selectedBrands) set.add(n);
    return Array.from(set);
  }, [yourBrand, selectedBrands]);

  const chartData = useMemo(
    () => buildVisibilitySeries(filteredChats, chartBrands, resolution, dateRange),
    [filteredChats, chartBrands, resolution, dateRange],
  );

  // ── Performance matrix ──────────────────────────────────────────────
  const matrixBrands = useMemo(() => {
    // Top 10 brands by overall visibility. Prepend yourBrand only if it
    // actually appears in the data — otherwise we waste a row showing dashes.
    const counts = new Map<string, number>();
    for (const c of filteredChats) {
      const seen = new Set<string>();
      for (const b of c.brands) {
        if (seen.has(b.name)) continue;
        seen.add(b.name);
        counts.set(b.name, (counts.get(b.name) || 0) + 1);
      }
    }
    const ranked = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .map((b) => b.name);
    const ownHasData = counts.has(yourBrand);
    const withOwn = ownHasData
      ? [yourBrand, ...ranked.filter((n) => n !== yourBrand)]
      : ranked;
    return withOwn.slice(0, 10);
  }, [filteredChats, yourBrand]);

  const matrixCells = useMemo(
    () => buildPerformanceMatrix(filteredChats, matrixBrands, selectedModels),
    [filteredChats, matrixBrands, selectedModels],
  );

  // ── Top rankings ────────────────────────────────────────────────────
  const topRankings = useMemo(
    () => buildTopRankings(filteredChats, selectedModels, 10),
    [filteredChats, selectedModels],
  );

  // ── Render helpers ──────────────────────────────────────────────────
  const visDelta = formatDelta(kpi.visibility - prevKpi.visibility);
  const sentDelta = formatDelta(kpi.sentiment - prevKpi.sentiment, "");
  const posDelta = prevKpi.position && kpi.position
    ? formatDelta(prevKpi.position - kpi.position, "") // lower position = better, invert
    : { text: "0", tone: "flat" as const };
  const sovDelta = formatDelta(kpi.sov - prevKpi.sov);

  const cellFor = (brand: string, engine: string) =>
    matrixCells.find((c) => c.brand === brand && c.engine === engine);

  return (
    <div className="ins-page">
      {/* Hero */}
      <div className="ins-hero">
        <div className="ins-hero-meta">Updated · {dateRange.label.toLowerCase()}</div>
        <h1 className="ins-hero-title">
          {yourRank
            ? `You're #${yourRank} in AI Visibility`
            : "You're not yet visible in AI"}
        </h1>
        <p className="ins-hero-subtitle">
          {yourRank && yourRank <= 3
            ? "You appear in most AI answers and are often the default choice."
            : yourRank && yourRank <= 10
              ? "You appear regularly in AI answers; there's room to climb."
              : "Track your brand visibility in AI responses to improve your ranking."}
        </p>

        <div className="ins-kpi-row">
          <KpiCard label="Visibility" value={formatPercent(kpi.visibility)} delta={showDeltas ? visDelta : undefined} />
          <KpiCard
            label="Sentiment"
            value={kpi.sentiment > 0 ? Math.round(kpi.sentiment).toString() : "—"}
            delta={kpi.sentiment > 0 && showDeltas ? sentDelta : undefined}
            dot={kpi.sentiment > 0}
          />
          <KpiCard
            label="Position"
            value={kpi.position > 0 ? `#${kpi.position.toFixed(1)}` : "—"}
            delta={showDeltas ? posDelta : undefined}
          />
          <KpiCard label="SoV" value={formatPercent(kpi.sov)} delta={showDeltas ? sovDelta : undefined} />
          <KpiCard
            label="Strongest model"
            value={
              kpi.strongestEngine ? (
                <span className="ins-kpi-engine">
                  <EngineIcon engine={kpi.strongestEngine} size={14} /> {kpi.strongestEngine}
                </span>
              ) : "—"
            }
          />
          <KpiCard
            label="Weakest model"
            value={
              kpi.weakestEngine ? (
                <span className="ins-kpi-engine">
                  <EngineIcon engine={kpi.weakestEngine} size={14} /> {kpi.weakestEngine}
                </span>
              ) : "—"
            }
          />
        </div>
      </div>

      {/* Brand insights chart */}
      <section className="ins-section">
        <h2 className="ins-section-title">Your brand insights</h2>
        <p className="ins-section-subtitle">How your brand metrics change over time</p>

        <div className="ins-chart-card">
          <div className="ins-chart-header">
            <div className="ins-chart-tabs">
              <button className="ins-chart-tab ins-chart-tab--active">
                <span className="ins-eye">👁</span> Visibility
              </button>
              <button className="ins-chart-tab" disabled>😊</button>
              <button className="ins-chart-tab" disabled>📏</button>
              <button className="ins-chart-tab" disabled>🥧</button>
            </div>
            <div className="ins-chart-controls">
              <div className="pd-resolution-toggle">
                {(["D", "W", "M"] as const).map((r) => (
                  <button
                    key={r}
                    className={`pd-res-btn ${resolution === r ? "pd-res-active" : ""}`}
                    onClick={() => setResolution(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                  fontSize: 11,
                }}
              />
              {chartBrands.map((b, i) => (
                <Line
                  key={b}
                  type="monotone"
                  dataKey={b}
                  stroke={i === 0 ? "#3b82f6" : "#f59e0b"}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <div className="ins-legend">
            <span className="ins-legend-item">
              <span className="ins-legend-dot" style={{ background: "#3b82f6" }} />
              Visibility
            </span>
            {chartBrands.length > 1 && (
              <>
                <span className="ins-legend-sep">|</span>
                <span className="ins-legend-item">
                  <span className="ins-legend-dot" style={{ background: "#f59e0b" }} />
                  {chartBrands[1]}
                </span>
              </>
            )}
            {normalizeDomain(ownDomain) && (
              <>
                <span className="ins-legend-sep">|</span>
                <span className="ins-legend-item">{normalizeDomain(ownDomain)}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Performance matrix */}
      <section className="ins-section">
        <div className="ins-section-row">
          <div>
            <h2 className="ins-section-title">Performance matrix</h2>
            <p className="ins-section-subtitle">Compare metrics across different dimensions.</p>
          </div>
          <div className="ins-section-action">
            <button className="pd-filter-chip">AI models vs Brands <ChevronDown size={11} /></button>
          </div>
        </div>

        <div className="ins-chart-card">
          <div className="ins-chart-header">
            <div className="ins-chart-tabs">
              <button className="ins-chart-tab ins-chart-tab--active">
                <span className="ins-eye">👁</span> Visibility
              </button>
              <button className="ins-chart-tab" disabled>😊</button>
              <button className="ins-chart-tab" disabled>📏</button>
              <button className="ins-chart-tab" disabled>🥧</button>
            </div>
          </div>

          <div className="ins-matrix-wrap">
            <table className="ins-matrix">
              <thead>
                <tr>
                  <th className="ins-matrix-rowhead">Brands</th>
                  {selectedModels.map((m) => (
                    <th key={m}>
                      <span className="ins-matrix-col-label">
                        {m} <ChevronDown size={9} style={{ display: "inline" }} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixBrands.map((brand) => {
                  const isYou = brand === yourBrand;
                  return (
                    <tr key={brand}>
                      <td className="ins-matrix-rowhead">
                        {brand} {isYou && <span className="ins-you-tag">(You)</span>}
                      </td>
                      {selectedModels.map((engine) => {
                        const cell = cellFor(brand, engine);
                        const v = cell?.visibility ?? 0;
                        return (
                          <td key={engine}>
                            <div className={`ins-heat ins-heat-${heatBucket(v)}`}>
                              {v >= 0.5 ? `${v.toFixed(1)}%` : "—"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {matrixBrands.length === 0 && (
                  <tr>
                    <td className="ins-empty" colSpan={selectedModels.length + 1}>
                      No data for this filter combination.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ins-heat-legend">
            {[
              { label: "0%", cls: "h0" },
              { label: "1-10%", cls: "h1" },
              { label: "11-20%", cls: "h2" },
              { label: "21-30%", cls: "h3" },
              { label: "31-40%", cls: "h4" },
              { label: "41-50%", cls: "h5" },
              { label: "51-60%", cls: "h6" },
              { label: "61-70%", cls: "h7" },
              { label: "71-80%", cls: "h8" },
              { label: "81-90%", cls: "h9" },
              { label: "91-100%", cls: "h10" },
            ].map((b) => (
              <span key={b.cls} className="ins-heat-legend-item">
                <span className={`ins-heat-dot ins-heat-${b.cls}`} />
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Top rankings */}
      <section className="ins-section">
        <div className="ins-section-row">
          <div>
            <h2 className="ins-section-title">Top rankings</h2>
            <p className="ins-section-subtitle">Leading brands by position</p>
          </div>
          <div className="ins-section-action">
            <button className="pd-filter-chip">By AI models <ChevronDown size={11} /></button>
          </div>
        </div>

        <div className="ins-chart-card">
          <div className="ins-chart-header">
            <div className="ins-chart-tabs">
              <button className="ins-chart-tab ins-chart-tab--active">
                <span className="ins-eye">👁</span> Visibility
              </button>
              <button className="ins-chart-tab" disabled>😊</button>
              <button className="ins-chart-tab" disabled>📏</button>
              <button className="ins-chart-tab" disabled>🥧</button>
            </div>
          </div>

          <div className="ins-matrix-wrap">
            <table className="ins-matrix ins-rankings">
              <thead>
                <tr>
                  <th className="ins-matrix-rowhead">AI models</th>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <th key={i}>#{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedModels.map((engine) => {
                  const ranks = topRankings[engine] || [];
                  return (
                    <tr key={engine}>
                      <td className="ins-matrix-rowhead">
                        <span className="ins-engine-cell">
                          <EngineIcon engine={engine} size={14} /> {engine}
                        </span>
                      </td>
                      {Array.from({ length: 10 }).map((_, i) => {
                        const item = ranks[i];
                        if (!item) return <td key={i}><div className="ins-rank-empty">—</div></td>;
                        const isYou = item.brand === yourBrand;
                        return (
                          <td key={i}>
                            <div className={`ins-rank-pill ${isYou ? "ins-rank-pill--you" : ""}`}>
                              <span className="ins-rank-brand">{item.brand}</span>
                              {isYou && <span className="ins-rank-you">You</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {selectedModels.length === 0 && (
                  <tr>
                    <td className="ins-empty" colSpan={11}>Select at least one model.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ins-rank-legend">
            <span className="ins-legend-item">
              <span className="ins-legend-dot" style={{ background: "#fef3c7", border: "1px solid #fde68a" }} />
              Other brands
            </span>
            <span className="ins-legend-item">
              <span className="ins-legend-dot" style={{ background: "#fed7aa", border: "1px solid #fdba74" }} />
              Your brand
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  delta?: { text: string; tone: "up" | "down" | "flat" };
  dot?: boolean;
}

function KpiCard({ label, value, delta, dot }: KpiCardProps) {
  return (
    <div className="ins-kpi">
      <div className="ins-kpi-label">
        {label} <span className="ins-info">ⓘ</span>
      </div>
      <div className="ins-kpi-value">
        {dot && <span className="ins-kpi-dot" />}
        {value}
        {delta && (
          <span className={`ins-kpi-delta ins-kpi-delta--${delta.tone}`}>{delta.text}</span>
        )}
      </div>
    </div>
  );
}
