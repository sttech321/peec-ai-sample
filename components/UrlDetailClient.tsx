"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ExternalLink } from "lucide-react";
import { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import { ChatFact, Resolution, filterByDateRange, toChatRecords } from "../lib/chat-aggregations";
import { DOMAIN_TYPE_COLORS, classifyDomain, DomainType } from "../lib/domain-aggregations";
import { URL_TYPE_COLORS, classifyUrl, formatRelative } from "../lib/url-aggregations";
import {
  computeUrlMeta,
  buildSingleUrlSeries,
  buildUrlRetrievalsByModel,
  buildUrlPromptStats,
  getUrlBrandMentions,
} from "../lib/url-detail-aggregations";

interface ProjectBrand { name: string; isOwn: boolean; domains?: string[] | null; }

interface Props {
  domain: string;
  url: string;
  chatFacts: ChatFact[];
  allChatFacts: ChatFact[];
  ownBrand: string | null;
  ownDomains: string[];
  competitorDomains: string[];
  projectBrands: ProjectBrand[];
  initialDomainTypeOverrides?: Record<string, string>;
  initialDomainBookmarks?: string[];
}

function localPrevPeriod(range: { start: Date; end: Date }) {
  const span = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - span - 1),
    end: new Date(range.start.getTime() - 1),
  };
}

function fmtDelta(v: number, pct = false) {
  if (Math.abs(v) < 0.05) return null;
  const text = (v > 0 ? "+" : "") + (pct ? v.toFixed(1) + "%" : String(v));
  return { text, tone: v > 0 ? "up" : "down" as "up" | "down" };
}

function MetaKpi({ label, value, delta }: {
  label: string;
  value: string | number;
  delta?: { text: string; tone: "up" | "down" } | null;
}) {
  return (
    <div className="ud-kpi">
      <div className="ud-kpi-label">{label}</div>
      <div className="ud-kpi-val">
        {value}
        {delta && <span className={`urls-num-delta tone-${delta.tone}`}>{delta.text}</span>}
      </div>
    </div>
  );
}

export default function UrlDetailClient({
  domain, url, chatFacts, allChatFacts,
  ownBrand, ownDomains, competitorDomains,
  initialDomainTypeOverrides,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"chats" | "prompts" | "brands">("chats");
  const [resolution, setResolution] = useState<Resolution>("D");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => makePresetRange("14"));

  const ownDomainSet = useMemo(() => new Set(ownDomains.map((d) => d.toLowerCase())), [ownDomains]);
  const competitorDomainSet = useMemo(() => new Set(competitorDomains.map((d) => d.toLowerCase())), [competitorDomains]);

  const domainType: DomainType = useMemo(() => {
    const override = (initialDomainTypeOverrides ?? {})[domain] as DomainType | undefined;
    return override ?? classifyDomain(null, domain, ownDomainSet, competitorDomainSet);
  }, [domain, initialDomainTypeOverrides, ownDomainSet, competitorDomainSet]);

  const filteredCurrent = useMemo(
    () => filterByDateRange(chatFacts, dateRange),
    [chatFacts, dateRange]
  );

  const filteredPrevious = useMemo(() => {
    const prev = localPrevPeriod(dateRange);
    return allChatFacts.filter(
      (c) =>
        c.sources.some((s) => s.url === url) &&
        new Date(c.runDate) >= prev.start &&
        new Date(c.runDate) <= prev.end
    );
  }, [allChatFacts, url, dateRange]);

  const meta = useMemo(
    () => computeUrlMeta(filteredCurrent, filteredPrevious, url),
    [filteredCurrent, filteredPrevious, url]
  );

  const chartSeries = useMemo(
    () => buildSingleUrlSeries(filteredCurrent, filteredPrevious, url, resolution, dateRange),
    [filteredCurrent, filteredPrevious, url, resolution, dateRange]
  );

  const byModel = useMemo(
    () => buildUrlRetrievalsByModel(filteredCurrent, filteredPrevious, url),
    [filteredCurrent, filteredPrevious, url]
  );

  const promptStats = useMemo(
    () => buildUrlPromptStats(filteredCurrent, url),
    [filteredCurrent, url]
  );

  const brandMentions = useMemo(
    () => getUrlBrandMentions(filteredCurrent, url, ownBrand),
    [filteredCurrent, url, ownBrand]
  );

  const chatRecords = useMemo(
    () => toChatRecords(filteredCurrent.filter((c) => c.sources.some((s) => s.url === url))).slice(0, 50),
    [filteredCurrent, url]
  );

  // Derive title from first chat source
  const urlTitle = useMemo(() => {
    for (const c of chatFacts) {
      const src = c.sources.find((s) => s.url === url);
      if (src?.title) return src.title;
    }
    return null;
  }, [chatFacts, url]);

  const urlType = classifyUrl(url, urlTitle);
  const dtColor = (DOMAIN_TYPE_COLORS as Record<string, string>)[domainType] ?? "#64748b";
  const utColor = (URL_TYPE_COLORS as Record<string, string>)[urlType] ?? "#94a3b8";

  const displayUrl = url.replace(/^https?:\/\//, "");
  const retD = fmtDelta(meta.retrievalsDelta);
  const citD = fmtDelta(meta.citationRateDelta * 100, true);
  const modelMax = Math.max(1, ...byModel.map((m) => m.current));

  return (
    <div className="ins-page">

      {/* Breadcrumb */}
      <div className="urls-breadcrumb">
        <span style={{ cursor: "pointer", color: "#64748b" }} onClick={() => router.push("/domains")}>
          Sources
        </span>
        <span className="urls-breadcrumb-sep">›</span>
        <span style={{ cursor: "pointer", color: "#64748b" }} onClick={() => router.push("/domains")}>
          Domains
        </span>
        <span className="urls-breadcrumb-sep">›</span>
        <span style={{ cursor: "pointer", color: "#64748b" }}
          onClick={() => router.push("/domains/" + encodeURIComponent(domain))}>
          {domain}
        </span>
        <span className="urls-breadcrumb-sep">›</span>
        <strong style={{ color: "#0f172a", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {urlTitle || displayUrl}
        </strong>
      </div>

      {/* URL header */}
      <div className="ud-header">
        <div className="ud-header-main">
          <h1 className="ud-title">{urlTitle || displayUrl}</h1>
          <div className="ud-url-row">
            <a href={url} target="_blank" rel="noopener noreferrer" className="ud-url-link"
              onClick={(e) => e.stopPropagation()}>
              {displayUrl} <ExternalLink size={11} style={{ display: "inline", marginLeft: 3 }} />
            </a>
          </div>
        </div>
        <div className="ud-badges">
          <span className="urls-pill" style={{ color: utColor, background: `${utColor}1A` }}>
            {urlType}
          </span>
          <span className="urls-pill" style={{ color: dtColor, background: `${dtColor}1A` }}>
            {domainType}
          </span>
        </div>
      </div>

      {/* KPI bar */}
      <div className="ud-kpi-bar">
        <MetaKpi label="Retrievals" value={meta.retrievals} delta={retD} />
        <MetaKpi label="Citation rate" value={(meta.citationRate * 100).toFixed(1) + "%"} delta={citD} />
        <MetaKpi label="Prompts" value={meta.promptCount} />
        <MetaKpi label="First seen"
          value={meta.firstSeen ? new Date(meta.firstSeen).toLocaleDateString() : "—"} />
        <MetaKpi label="Last seen"
          value={meta.lastSeen ? formatRelative(meta.lastSeen) : "—"} />
      </div>

      {/* Chart + Engine breakdown */}
      <div className="ud-overview">
        <div className="ins-chart-card ud-chart-card">
          <div className="ins-chart-header">
            <div className="urls-chart-title">Retrievals over time</div>
            <div className="pd-resolution-toggle">
              {(["D", "W", "M"] as const).map((r) => (
                <button key={r}
                  className={`pd-res-btn ${resolution === r ? "pd-res-active" : ""}`}
                  onClick={() => setResolution(r)}>{r}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)"
                horizontal vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={{ stroke: "#e5e7eb" }} tickLine={false} dy={6} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false} tickLine={false} width={28} />
              <Tooltip
                wrapperStyle={{ zIndex: 100 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="ch-tooltip">
                      <div className="ch-tooltip-date">{label}</div>
                      {payload.map((p) => (
                        <div key={String(p.dataKey)} className="ch-tooltip-row">
                          <span className="ch-tooltip-dot" style={{ background: p.color as string }} />
                          <span className="ch-tooltip-name">{p.dataKey === "current" ? "This period" : "Previous"}</span>
                          <span className="ch-tooltip-val">{String(p.value)}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="current" name="This period"
                stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="previous" name="Previous period"
                stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 3"
                dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="ud-chart-legend">
            <span className="ud-legend-chip">
              <span className="ud-legend-dot" style={{ background: "#f97316" }} /> This period
            </span>
            <span className="ud-legend-chip">
              <span className="ud-legend-dot" style={{ background: "#cbd5e1" }} /> Previous period
            </span>
          </div>
        </div>

        {/* Engine breakdown */}
        <div className="ins-chart-card ud-engines-card">
          <div className="urls-chart-title" style={{ marginBottom: 14 }}>Retrievals by engine</div>
          <div className="ud-engines-list">
            {byModel.length === 0 && (
              <div className="urls-empty" style={{ padding: 16 }}>No data</div>
            )}
            {byModel.map((m) => {
              const barW = (m.current / modelMax) * 100;
              const d = fmtDelta(m.current - m.previous);
              return (
                <div key={m.engine} className="ud-engine-row">
                  <span className="ud-engine-name">{m.engine}</span>
                  <div className="movers-bar-wrap" style={{ flex: 1 }}>
                    <div className="movers-bar-fill" style={{ width: `${barW}%` }} />
                  </div>
                  <span className="ud-engine-count">{m.current}</span>
                  {d && (
                    <span className={`urls-num-delta tone-${d.tone}`} style={{ width: 36, textAlign: "right" }}>
                      {d.text}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dd-tabs">
        {(["chats", "prompts", "brands"] as const).map((t) => (
          <button key={t}
            className={`dd-tab ${tab === t ? "dd-tab--active" : ""}`}
            onClick={() => setTab(t)}>
            {t === "chats" ? "Chats" : t === "prompts" ? "Prompts" : "Brands mentioned"}
          </button>
        ))}
      </div>

      {/* Chats */}
      {tab === "chats" && (
        <div className="dd-chats-list">
          {chatRecords.length === 0 && (
            <div className="urls-empty" style={{ padding: 24 }}>No chats in this period.</div>
          )}
          {chatRecords.map((c) => (
            <div key={c.id} className="dd-chat-row">
              <div className="dd-chat-header">
                <span className="dd-chat-engine">{c.engine}</span>
                <span className="dd-chat-query">{c.query || "—"}</span>
                <span className="dd-chat-date">{new Date(c.runDate).toLocaleDateString()}</span>
              </div>
              {c.rawResponse && (
                <p className="dd-chat-snippet">{c.rawResponse.slice(0, 300)}…</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Prompts */}
      {tab === "prompts" && (
        <div className="urls-table-wrap" style={{ marginTop: 4 }}>
          <table className="urls-table">
            <thead>
              <tr>
                <th style={{ width: 36, color: "#94a3b8" }}>#</th>
                <th>Query</th>
                <th className="urls-th-num">Retrieved</th>
                <th className="urls-th-num">Citation rate</th>
              </tr>
            </thead>
            <tbody>
              {promptStats.length === 0 && (
                <tr><td colSpan={4} className="urls-empty">No prompt data.</td></tr>
              )}
              {promptStats.map((p, i) => (
                <tr key={p.query}>
                  <td style={{ color: "#94a3b8", fontWeight: 500 }}>{i + 1}</td>
                  <td style={{ fontWeight: 500, color: "#0f172a" }}>{p.query}</td>
                  <td className="urls-td-num">
                    <span className="urls-num-primary">{p.retrieved}</span>
                  </td>
                  <td className="urls-td-num">
                    <span className="urls-num-primary">{p.citationRate.toFixed(1)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Brands mentioned */}
      {tab === "brands" && (
        <div className="urls-table-wrap" style={{ marginTop: 4 }}>
          <table className="urls-table">
            <thead>
              <tr>
                <th style={{ width: 36, color: "#94a3b8" }}>#</th>
                <th>Brand</th>
                <th className="urls-th-num">Mentions</th>
              </tr>
            </thead>
            <tbody>
              {brandMentions.length === 0 && (
                <tr><td colSpan={3} className="urls-empty">No brand mentions.</td></tr>
              )}
              {brandMentions.map((b, i) => (
                <tr key={b.brand}>
                  <td style={{ color: "#94a3b8", fontWeight: 500 }}>{i + 1}</td>
                  <td>
                    <span style={{ fontWeight: b.isOwn ? 700 : 500, color: "#0f172a" }}>
                      {b.brand}
                    </span>
                    {b.isOwn && (
                      <span className="urls-pill"
                        style={{ marginLeft: 8, color: "#7c4a1e", background: "#fff7ed", fontSize: 10 }}>
                        You
                      </span>
                    )}
                  </td>
                  <td className="urls-td-num">
                    <span className="urls-num-primary">{b.count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
