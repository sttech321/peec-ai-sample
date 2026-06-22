"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  ChevronDown, ChevronUp, RotateCcw,
} from "lucide-react";
import DateRangeDropdown, { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import EngineIcon from "./EngineIcon";

function BrandAvatar({ id, name, domain, size = 22 }: { id: string; name: string; domain?: string | null; size?: number }) {
  const [err, setErr] = React.useState(false);
  const PALETTE = ["#f59e0b","#3b82f6","#ef4444","#8b5cf6","#10b981","#06b6d4","#ec4899","#6366f1","#eab308","#f97316"];
  let h = 0; for (let i = 0; i < id.length; i++) { h = ((h << 5) - h) + id.charCodeAt(i); h |= 0; }
  const color = PALETTE[Math.abs(h) % PALETTE.length];
  const host = domain ? domain.replace(/^https?:\/\//, "").split("/")[0] : null;
  const src  = host && !err ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : null;
  const initials = name.split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase() ?? "").join("");
  return (
    <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width: size, height: size, borderRadius: 6, flexShrink:0, overflow:"hidden", background: src ? "#f3f4f6" : color }}>
      {src ? <img src={src} alt="" width={size-2} height={size-2} style={{ objectFit:"contain" }} onError={() => setErr(true)} /> : <span style={{ fontSize: 9, fontWeight: 700, color:"#fff" }}>{initials}</span>}
    </span>
  );
}
import {
  ChatFact, BrandAgg,
  aggregateBrands, filterByEngines, filterByDateRange,
} from "../lib/chat-aggregations";
import { DEFAULT_ENGINES } from "../lib/engines";

interface ProjectBrand  { name: string; isOwn: boolean; domains: string[]; }
interface AvailableTag  { id: string; name: string; }
interface AvailableTopic { id: string; name: string; }

interface Props {
  chatFacts: ChatFact[];
  projectBrands: ProjectBrand[];
  availableTags: AvailableTag[];
  availableTopics?: AvailableTopic[];
  chatTagsMap?: Record<string, string[]>;
  chatTopicMap?: Record<string, string>;
  /** When present, the page is reached from a prompt — show a breadcrumb
   *  (Prompts › [query] › Ranking) instead of the plain "Ranking" title. */
  promptCrumb?: { id: string; query: string };
}

type SortCol = "rank" | "visibility" | "sov" | "sentiment" | "position";
type SortDir = "desc" | "asc";

const DEFAULT_PALETTE = [
  "#f59e0b","#3b82f6","#eab308","#f97316","#ef4444",
  "#8b5cf6","#10b981","#06b6d4","#ec4899","#6366f1",
];
function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) { h = ((h << 5) - h) + name.charCodeAt(i); h |= 0; }
  return DEFAULT_PALETTE[Math.abs(h) % DEFAULT_PALETTE.length];
}

function makePrevRange(range: { start: Date; end: Date }) {
  const len = range.end.getTime() - range.start.getTime();
  return { start: new Date(range.start.getTime() - len - 86400000), end: new Date(range.start.getTime() - 86400000) };
}

function Delta({ v }: { v: number }) {
  if (v === 0) return <span className="rk-delta rk-delta--zero">+0</span>;
  const pos = v > 0;
  return <span className={`rk-delta ${pos ? "rk-delta--pos" : "rk-delta--neg"}`}>{pos ? "+" : ""}{v}%</span>;
}
function DeltaNum({ v, invert }: { v: number; invert?: boolean }) {
  if (v === 0) return <span className="rk-delta rk-delta--zero">+0</span>;
  const good = invert ? v < 0 : v > 0;
  return <span className={`rk-delta ${good ? "rk-delta--pos" : "rk-delta--neg"}`}>{v > 0 ? "+" : ""}{v}</span>;
}

// Visibility benchmark: 0%=red, <20%=amber, >=50%=green
function visBenchmarkClass(vis: number): string {
  if (vis === 0) return "rk-metric--critical";
  if (vis < 20)  return "rk-metric--weak";
  if (vis >= 50) return "rk-metric--strong";
  return "";
}
// SoV benchmark: 0%=red, <10%=amber, >=25%=green  (docs: >25%=leadership, 10-25%=competitive, <10%=trailing)
function sovBenchmarkClass(sov: number): string {
  if (sov === 0)  return "rk-metric--critical";
  if (sov < 10)   return "rk-metric--weak";
  if (sov >= 25)  return "rk-metric--strong";
  return "";
}

export default function RankingClient({
  chatFacts, projectBrands, availableTags,
  availableTopics = [], chatTagsMap = {}, chatTopicMap = {},
  promptCrumb,
}: Props) {
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => makePresetRange("7"));
  const [selectedModels, setSelectedModels] = useState<string[]>([...DEFAULT_ENGINES]);
  const [modelOpen, setModelOpen] = useState(false);
  const [selectedTags,   setSelectedTags]   = useState<string[]>([]);
  const [tagOpen,        setTagOpen]        = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicOpen,      setTopicOpen]      = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>("visibility");

  const modelRef = useRef<HTMLDivElement>(null);
  const tagRef   = useRef<HTMLDivElement>(null);
  const topicRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (modelOpen && modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
      if (tagOpen && tagRef.current && !tagRef.current.contains(e.target as Node)) {
        setTagOpen(false);
      }
      if (topicOpen && topicRef.current && !topicRef.current.contains(e.target as Node)) {
        setTopicOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [modelOpen, tagOpen, topicOpen]);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const ownBrandNames = useMemo(
    () => new Set(projectBrands.filter(b => b.isOwn).map(b => b.name)),
    [projectBrands]
  );

  const range = useMemo(() => ({
    start: dateRange.start,
    end:   dateRange.end,
  }), [dateRange]);

  const filtered = useMemo(() => {
    let facts = filterByDateRange(filterByEngines(chatFacts, selectedModels), range);
    if (selectedTags.length > 0) {
      facts = facts.filter(c => {
        const t = chatTagsMap[c.id];
        return t && t.some(tag => selectedTags.includes(tag));
      });
    }
    if (selectedTopics.length > 0) {
      facts = facts.filter(c => {
        const topic = chatTopicMap[c.id];
        return topic !== undefined && selectedTopics.includes(topic);
      });
    }
    return facts;
  }, [chatFacts, selectedModels, range, selectedTags, selectedTopics, chatTagsMap, chatTopicMap]);

  const prevRange = useMemo(() => makePrevRange(range), [range]);
  const prevFiltered = useMemo(
    () => filterByDateRange(filterByEngines(chatFacts, selectedModels), prevRange),
    [chatFacts, selectedModels, prevRange]
  );

  const brands = useMemo(() => aggregateBrands(filtered, 9999), [filtered]);
  const prevBrands = useMemo(() => aggregateBrands(prevFiltered, 9999), [prevFiltered]);

  const totalChats = filtered.length;
  const totalMentions = useMemo(() => brands.reduce((s, b) => s + b.count, 0), [brands]);
  const prevTotalChats = prevFiltered.length;
  const prevTotalMentions = useMemo(() => prevBrands.reduce((s, b) => s + b.count, 0), [prevBrands]);

  const rows = useMemo(() => {
    return brands.map(b => {
      const vis = totalChats > 0 ? Math.round((b.count / totalChats) * 100) : 0;
      const sov = totalMentions > 0 ? Math.round((b.count / totalMentions) * 100) : 0;
      const sent = b.sentiment > 0 ? Math.round(b.sentiment) : null;
      const pos  = b.position  > 0 ? parseFloat(b.position.toFixed(1)) : null;
      const pb = prevBrands.find(p => p.name === b.name);
      const pVis  = prevTotalChats    > 0 && pb ? Math.round((pb.count / prevTotalChats)    * 100) : 0;
      const pSov  = prevTotalMentions > 0 && pb ? Math.round((pb.count / prevTotalMentions) * 100) : 0;
      const pSent = pb && pb.sentiment > 0 ? Math.round(pb.sentiment) : null;
      const pPos  = pb && pb.position  > 0 ? parseFloat(pb.position.toFixed(1)) : null;
      return {
        name: b.name, count: b.count,
        vis, sov, sent, pos,
        visDelta:  vis  - pVis,
        sovDelta:  sov  - pSov,
        sentDelta: sent !== null && pSent !== null ? Math.round(sent - pSent) : 0,
        posDelta:  pos  !== null && pPos  !== null ? parseFloat((pos - pPos).toFixed(1)) : 0,
        isOwn: ownBrandNames.has(b.name),
        domain: projectBrands.find(pb2 => pb2.name === b.name)?.domains?.[0] ?? null,
        color: colorFromName(b.name),
      };
    }).sort((a, b) => {
      let diff = 0;
      if (sortCol === "rank" || sortCol === "visibility") diff = a.vis - b.vis;
      else if (sortCol === "sov")       diff = a.sov - b.sov;
      else if (sortCol === "sentiment") diff = (a.sent ?? 0) - (b.sent ?? 0);
      else if (sortCol === "position")  diff = (b.pos ?? 99) - (a.pos ?? 99); // lower = better
      return sortDir === "desc" ? -diff : diff;
    });
  }, [brands, prevBrands, totalChats, totalMentions, prevTotalChats, prevTotalMentions, ownBrandNames, projectBrands, sortCol, sortDir]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ChevronDown size={11} className="rk-sort-icon" />;
    return sortDir === "desc"
      ? <ChevronDown size={11} className="rk-sort-icon rk-sort-icon--active" />
      : <ChevronUp   size={11} className="rk-sort-icon rk-sort-icon--active" />;
  }

  function resetFilters() {
    setDateRange(makePresetRange("7"));
    setSelectedModels([...DEFAULT_ENGINES]);
    setSelectedTags([]);
    setSelectedTopics([]);
  }

  const hasFilters =
    selectedModels.length !== DEFAULT_ENGINES.length ||
    selectedTags.length > 0 ||
    selectedTopics.length > 0;

  return (
    <div className="rk-page">
      {/* Header — the prompt breadcrumb (Prompts › [query] › Ranking) now lives
          in the shared page-title bar; only the standalone /ranking page renders
          its own title here. */}
      {!promptCrumb && (
        <div className="rk-header">
          <h1 className="rk-title">Ranking</h1>
        </div>
      )}

      {/* Filter bar */}
      <div className="rk-filterbar">
        <DateRangeDropdown
          value={dateRange}
          onChange={setDateRange}
          onOpen={() => { setModelOpen(false); setTagOpen(false); setTopicOpen(false); }}
        />

        {/* Models filter */}
        <div ref={modelRef} className="rk-filter-wrap" style={{ position: "relative" }}>
          <button className="rk-filter-btn" onClick={() => { setTagOpen(false); setTopicOpen(false); setModelOpen(v => !v); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            {selectedModels.length === DEFAULT_ENGINES.length ? "All Models" : `${selectedModels.length} Models`}
            <ChevronDown size={12} />
          </button>
          {modelOpen && (
            <div className="rk-filter-menu">
              {DEFAULT_ENGINES.map(e => (
                <label key={e} className="rk-filter-option">
                  <input
                    type="checkbox"
                    checked={selectedModels.includes(e)}
                    onChange={() => setSelectedModels(prev =>
                      prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]
                    )}
                  />
                  <EngineIcon engine={e} size={14} />
                  <span>{e}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Tags filter */}
        {availableTags.length > 0 && (
          <div ref={tagRef} className="rk-filter-wrap" style={{ position: "relative" }}>
            <button className="rk-filter-btn" onClick={() => { setModelOpen(false); setTopicOpen(false); setTagOpen(v => !v); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              {selectedTags.length === 0 ? "All Tags" : `${selectedTags.length} Tag${selectedTags.length > 1 ? "s" : ""}`}
              <ChevronDown size={12} />
            </button>
            {tagOpen && (
              <div className="rk-filter-menu">
                {availableTags.map(t => (
                  <label key={t.id} className="rk-filter-option">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(t.name)}
                      onChange={() => setSelectedTags(prev =>
                        prev.includes(t.name) ? prev.filter(x => x !== t.name) : [...prev, t.name]
                      )}
                    />
                    <span>{t.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Topics filter */}
        {availableTopics.length > 0 && (
          <div ref={topicRef} className="rk-filter-wrap" style={{ position: "relative" }}>
            <button className="rk-filter-btn" onClick={() => { setModelOpen(false); setTagOpen(false); setTopicOpen(v => !v); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              {selectedTopics.length === 0 ? "All Topics" : `${selectedTopics.length} Topic${selectedTopics.length > 1 ? "s" : ""}`}
              <ChevronDown size={12} />
            </button>
            {topicOpen && (
              <div className="rk-filter-menu">
                {availableTopics.map(t => (
                  <label key={t.id} className="rk-filter-option">
                    <input
                      type="checkbox"
                      checked={selectedTopics.includes(t.name)}
                      onChange={() => setSelectedTopics(prev =>
                        prev.includes(t.name) ? prev.filter(x => x !== t.name) : [...prev, t.name]
                      )}
                    />
                    <span>{t.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {hasFilters && (
          <button className="rk-reset-btn" onClick={resetFilters}>
            <RotateCcw size={12} /> Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rk-table-wrap">
        {rows.length === 0 ? (
          <div className="rk-empty">No brand data for this period.</div>
        ) : (
          <table className="rk-table">
            <thead>
              <tr>
                <th className="rk-th rk-th--num" onClick={() => toggleSort("rank")}># <SortIcon col="rank" /></th>
                <th className="rk-th">Brand</th>
                <th className="rk-th rk-th--metric" onClick={() => toggleSort("visibility")}>
                  Visibility <SortIcon col="visibility" />
                </th>
                <th className="rk-th rk-th--metric" onClick={() => toggleSort("sov")}>
                  SOV <SortIcon col="sov" />
                </th>
                <th className="rk-th rk-th--metric" onClick={() => toggleSort("sentiment")}>
                  Sentiment <SortIcon col="sentiment" />
                </th>
                <th className="rk-th rk-th--metric" onClick={() => toggleSort("position")}>
                  Position <SortIcon col="position" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.name} className={`rk-row${row.isOwn ? " rk-row--own" : ""}`}>
                  <td className="rk-td rk-td--rank">{i + 1}</td>
                  <td className="rk-td rk-td--brand">
                    <div className="rk-brand-cell">
                      <BrandAvatar id={row.name} name={row.name} domain={row.domain} size={22} />
                      <span className="rk-brand-name">{row.name}</span>
                      {row.isOwn && <span className="rk-you-badge">You</span>}
                    </div>
                  </td>
                  <td className="rk-td rk-td--metric">
                    <span className="rk-metric">{row.vis}%</span>
                    <Delta v={row.visDelta} />
                  </td>
                  <td className="rk-td rk-td--metric">
                    <span className="rk-metric">{row.sov}%</span>
                    <Delta v={row.sovDelta} />
                  </td>
                  <td className="rk-td rk-td--metric">
                    {row.sent !== null ? (
                      <>
                        <span className="rk-sent-dot" style={{ background: row.sent >= 70 ? "#10b981" : row.sent >= 40 ? "#f59e0b" : "#ef4444" }} />
                        <span className="rk-metric">{row.sent}</span>
                        <DeltaNum v={row.sentDelta} />
                      </>
                    ) : <span className="rk-na">—</span>}
                  </td>
                  <td className="rk-td rk-td--metric">
                    {row.pos !== null ? (
                      <>
                        <span className="rk-metric"># {row.pos}</span>
                        <DeltaNum v={row.posDelta} invert />
                      </>
                    ) : <span className="rk-na">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
