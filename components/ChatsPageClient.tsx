"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, RotateCcw, Loader2 } from "lucide-react";
import DateRangeDropdown, { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import EngineIcon from "./EngineIcon";
import DomainFavicon from "./DomainFavicon";
import ChatModal from "./ChatModal";
import ChatFilterDropdown from "./ChatFilterDropdown";
import { guessBrandDomain } from "../lib/brand-domain";
import type { ChatRecordView } from "../lib/chat-aggregations";
import { DEFAULT_ENGINES } from "../lib/engines";

interface AvailableTag { id: string; name: string; }

interface ApiResponse {
  rows: ChatRecordView[];
  total: number;
  page: number;
  totalPages: number;
  stats: {
    totalChats: number;
    ownMentionCount: number;
    webSearchCount: number;
    avgCitation: number;
  };
  allBrands: string[];
  allSources: string[];
}

interface Props {
  ownBrandName: string | null;
  availableTags: AvailableTag[];
}

const CHAT_PAGE_SIZE = 10;
const DEFAULT_COLS = {
  mentions: true, sources: true, features: true,
  position: true, created: true, citations: false,
};

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "just now";
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) {
    const mins = Math.floor(diffMs / 60000);
    return mins < 1 ? "just now" : `${mins}m ago`;
  }
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 7)  return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 wk ago";
  if (weeks < 52) return `${weeks} wks ago`;
  return `${Math.floor(weeks / 52)} yr ago`;
}

export default function ChatsPageClient({ ownBrandName }: Props) {

  // ── Filters ──────────────────────────────────────────────────────────────
  const [dateRange,      setDateRange]      = useState<DateRangeValue>(() => makePresetRange("7"));
  const [selectedModels, setSelectedModels] = useState<string[]>([...DEFAULT_ENGINES]);
  const [modelOpen,      setModelOpen]      = useState(false);
  const [chatPage,       setChatPage]       = useState(1);
  const [chatBrandFilters,   setChatBrandFilters]   = useState<Set<string>>(new Set());
  const [chatSourceFilters,  setChatSourceFilters]  = useState<Set<string>>(new Set());
  const [chatFeatureFilters, setChatFeatureFilters] = useState<Set<string>>(new Set());

  // ── UI state ──────────────────────────────────────────────────────────────
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  const [selectedChat,    setSelectedChat]    = useState<ChatRecordView | null>(null);
  const [visibleCols,     setVisibleCols]     = useState({ ...DEFAULT_COLS });
  const colSettingsRef = useRef<HTMLDivElement>(null);

  // ── API data state ────────────────────────────────────────────────────────
  const [data,    setData]    = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  function toggleCol(col: keyof typeof DEFAULT_COLS) {
    setVisibleCols(prev => ({ ...prev, [col]: !prev[col] }));
  }

  // ── Fetch from API ────────────────────────────────────────────────────────
  const fetchChats = useCallback(async (
    page: number,
    models: string[],
    range: DateRangeValue,
    brandFilter: string,
    sourceFilter: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page:    String(page),
        limit:   String(CHAT_PAGE_SIZE),
        dateFrom: range.start.toISOString(),
        dateTo:   range.end.toISOString(),
      });
      if (models.length > 0 && models.length < DEFAULT_ENGINES.length)
        params.set("models", models.join(","));
      if (ownBrandName) params.set("ownBrand", ownBrandName);
      if (brandFilter)  params.set("brandFilter", brandFilter);
      if (sourceFilter) params.set("sourceFilter", sourceFilter);

      const res = await fetch(`/api/chats?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (e) {
      setError("Failed to load chats. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [ownBrandName]);

  // Re-fetch whenever filters or page change
  useEffect(() => {
    const brandFilter  = [...chatBrandFilters][0]  ?? "";
    const sourceFilter = [...chatSourceFilters][0] ?? "";
    fetchChats(chatPage, selectedModels, dateRange, brandFilter, sourceFilter);
  }, [chatPage, selectedModels, dateRange, chatBrandFilters, chatSourceFilters, fetchChats]);

  function resetFilters() {
    setDateRange(makePresetRange("7"));
    setSelectedModels([...DEFAULT_ENGINES]);
    setChatBrandFilters(new Set());
    setChatSourceFilters(new Set());
    setChatFeatureFilters(new Set());
    setChatPage(1);
  }

  const hasFilters = selectedModels.length !== DEFAULT_ENGINES.length;

  // Derived values from API response
  const stats       = data?.stats;
  const rows        = data?.rows        ?? [];
  const total       = data?.total       ?? 0;
  const totalPages  = data?.totalPages  ?? 1;
  const allBrands   = data?.allBrands   ?? [];
  const allSources  = data?.allSources  ?? [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="ch-page" onClick={() => setModelOpen(false)}>
      <h1 className="ch-title">Chats</h1>

      {/* ── Filter bar ────────────────────────────────────────────────── */}
      <div className="ch-filterbar">
        {/* Models */}
        <div className="ch-filter-wrap" onClick={e => e.stopPropagation()}>
          <button className="ch-filter-btn" onClick={() => setModelOpen(v => !v)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            {selectedModels.length === DEFAULT_ENGINES.length ? "All Models" : `${selectedModels.length} Models`}
            <ChevronDown size={12} />
          </button>
          {modelOpen && (
            <div className="ch-filter-menu">
              {DEFAULT_ENGINES.map(e => (
                <label key={e} className="ch-filter-option">
                  <input
                    type="checkbox"
                    checked={selectedModels.includes(e)}
                    onChange={() => {
                      setSelectedModels(prev =>
                        prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]
                      );
                      setChatPage(1);
                    }}
                  />
                  <EngineIcon engine={e} size={14} />
                  <span>{e}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <DateRangeDropdown value={dateRange} onChange={v => { setDateRange(v); setChatPage(1); }} />

        {hasFilters && (
          <button className="ch-reset-btn" onClick={resetFilters}>
            <RotateCcw size={12} /> Reset
          </button>
        )}
      </div>

      {/* ── Stats cards ───────────────────────────────────────────────── */}
      <div className="ch-stats-row">
        <div className="ch-stat-card">
          <span className="ch-stat-label">Total chats</span>
          <span className="ch-stat-value">
            {loading ? <Loader2 size={16} className="ch-stat-spinner" /> :
              stats ? (stats.totalChats >= 1000 ? `${(stats.totalChats / 1000).toFixed(1)}k` : stats.totalChats) : "—"}
          </span>
        </div>
        {ownBrandName && (
          <div className="ch-stat-card">
            <span className="ch-stat-label">Your brand mentioned</span>
            <span className="ch-stat-value">
              {loading ? <Loader2 size={16} className="ch-stat-spinner" /> : stats ? (
                <>
                  {stats.ownMentionCount >= 1000 ? `${(stats.ownMentionCount / 1000).toFixed(1)}k` : stats.ownMentionCount}
                  {stats.totalChats > 0 && (
                    <span className="ch-stat-pct"> {Math.round((stats.ownMentionCount / stats.totalChats) * 100)}%</span>
                  )}
                </>
              ) : "—"}
            </span>
          </div>
        )}
        <div className="ch-stat-card">
          <span className="ch-stat-label">Web search</span>
          <span className="ch-stat-value">
            {loading ? <Loader2 size={16} className="ch-stat-spinner" /> : stats ? (
              <>
                {stats.webSearchCount >= 1000 ? `${(stats.webSearchCount / 1000).toFixed(1)}k` : stats.webSearchCount}
                {stats.totalChats > 0 && (
                  <span className="ch-stat-pct"> {Math.round((stats.webSearchCount / stats.totalChats) * 100)}%</span>
                )}
              </>
            ) : "—"}
          </span>
        </div>
        <div className="ch-stat-card">
          <span className="ch-stat-label">Average citation</span>
          <span className="ch-stat-value">
            {loading ? <Loader2 size={16} className="ch-stat-spinner" /> : stats?.avgCitation ?? "—"}
          </span>
        </div>
      </div>

      {/* ── All Chats section ─────────────────────────────────────────── */}
      <div className="pd-section ac-section">
        {/* Header */}
        <div className="ac-header">
          <div>
            <h2 className="pd-section-title">All Chats</h2>
            <p className="pd-section-subtitle">All chats for your prompts</p>
          </div>
          <div className="ac-filters">
            <ChatFilterDropdown
              label="All Brands"
              items={allBrands}
              selected={chatBrandFilters}
              onChange={v => { setChatBrandFilters(v); setChatPage(1); }}
              searchable
            />
            <ChatFilterDropdown
              label="All Features"
              items={["Shopping", "Product Comparison", "Ads", "Map", "Web Search", "No features"]}
              selected={chatFeatureFilters}
              onChange={v => { setChatFeatureFilters(v); setChatPage(1); }}
              featuresMode
            />
            <ChatFilterDropdown
              label="All Sources"
              items={allSources}
              selected={chatSourceFilters}
              onChange={v => { setChatSourceFilters(v); setChatPage(1); }}
              searchable
            />

            {/* Column settings */}
            <div ref={colSettingsRef} style={{ position: "relative" }}>
              <button
                className={`ac-col-btn ${colSettingsOpen ? "ac-col-btn--active" : ""}`}
                onClick={() => setColSettingsOpen(v => !v)}
                title="Column settings"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                </svg>
              </button>
              {colSettingsOpen && (
                <div className="ac-col-panel">
                  <div className="ac-col-group-label">Fixed columns</div>
                  <div className="ac-col-row ac-col-row--fixed">
                    <span className="ac-col-dot" />
                    <span className="ac-col-name">Chat</span>
                  </div>
                  <div className="ac-col-group-label">Active columns</div>
                  {(["mentions","sources","features","position","created"] as const).map(col => (
                    <div key={col} className="ac-col-row" onClick={() => toggleCol(col)}>
                      <span className={`ac-col-checkbox ${visibleCols[col] ? "ac-col-checkbox--on" : ""}`}>
                        {visibleCols[col] && <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>}
                      </span>
                      <span className="ac-col-name" style={{ textTransform: "capitalize" }}>{col}</span>
                    </div>
                  ))}
                  <div className="ac-col-group-label">Available columns</div>
                  <div className="ac-col-row" onClick={() => toggleCol("citations")}>
                    <span className={`ac-col-checkbox ${visibleCols.citations ? "ac-col-checkbox--on" : ""}`}>
                      {visibleCols.citations && <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>}
                    </span>
                    <span className="ac-col-name">Citations</span>
                  </div>
                  <div className="ac-col-separator" />
                  <button className="ac-col-reset" onClick={() => setVisibleCols({ ...DEFAULT_COLS })}>
                    Reset to default
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Count row */}
        <div className="ac-count-row">
          <span className="ac-count">
            {loading ? (
              <span style={{ color: "#9ca3af" }}>Loading…</span>
            ) : total === 0 ? "0 chats" : (
              <>
                <strong>{(chatPage - 1) * CHAT_PAGE_SIZE + 1}</strong>
                {" to "}
                <strong>{Math.min(chatPage * CHAT_PAGE_SIZE, total)}</strong>
                {" of "}
                <strong>{total.toLocaleString()}</strong>
                {" chats"}
              </>
            )}
          </span>
        </div>

        {/* Error state */}
        {error && (
          <div className="pd-empty-chats" style={{ color: "#ef4444" }}>
            {error}
            <button className="ch-reset-btn" style={{ marginLeft: 12 }} onClick={() => fetchChats(chatPage, selectedModels, dateRange, [...chatBrandFilters][0] ?? "", [...chatSourceFilters][0] ?? "")}>
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="ch-loading-wrap">
            <Loader2 size={20} className="ch-loading-spinner" />
            <span className="ch-loading-text">Loading chats…</span>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          rows.length === 0 ? (
            <div className="pd-empty-chats">🔍 No chats match your filters.</div>
          ) : (
            <div className="ac-table-wrap">
              <table className="ac-table">
                <thead>
                  <tr>
                    <th className="ac-th-chat">Chat</th>
                    {visibleCols.mentions  && <th className="ac-th-mentions">Mentions</th>}
                    {visibleCols.sources   && <th className="ac-th-sources">Sources</th>}
                    {visibleCols.features  && <th className="ac-th-sources">Features</th>}
                    {visibleCols.citations && <th className="ac-th-mentions">Citations</th>}
                    {visibleCols.position  && <th className="ac-th-position">Position</th>}
                    {visibleCols.created   && <th className="ac-th-created">Created</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(chat => {
                    const snippet = chat.rawResponse ? chat.rawResponse.slice(0, 180) : "No response content.";
                    const timeAgo = formatTimeAgo(chat.runDate);
                    const extra   = chat.brandsFound.length - 4;
                    return (
                      <tr key={chat.id} className="ac-row" onClick={() => setSelectedChat(chat)}>
                        <td className="ac-td-chat">
                          <div className="ac-chat-engine"><EngineIcon engine={chat.engine} /></div>
                          <div className="ac-chat-text">
                            <div className="ac-chat-query">{chat.query || "—"}</div>
                            <div className="ac-chat-snippet">{snippet}</div>
                          </div>
                        </td>
                        {visibleCols.mentions && (
                          <td className="ac-td-mentions">
                            <div className="ac-icons-row">
                              {chat.brandsFound.slice(0, 4).map(b => (
                                <DomainFavicon key={b} domain={guessBrandDomain(b)} size={18} />
                              ))}
                              {extra > 0 && <span className="ac-more">+{extra}</span>}
                            </div>
                          </td>
                        )}
                        {visibleCols.sources && (
                          <td className="ac-td-sources">
                            <div className="ac-icons-row">
                              {chat.sourcesFound.slice(0, 4).map((s, i) => (
                                <DomainFavicon key={i} domain={s.domain} size={18} />
                              ))}
                              {chat.sourcesFound.length > 4 && <span className="ac-more">+{chat.sourcesFound.length - 4}</span>}
                            </div>
                          </td>
                        )}
                        {visibleCols.features  && <td className="ac-td-sources"><span className="ac-more" style={{ color: "#9ca3af" }}>—</span></td>}
                        {visibleCols.citations && <td className="ac-td-mentions"><span className="ac-more" style={{ color: "#9ca3af" }}>—</span></td>}
                        {visibleCols.position  && <td className="ac-td-position">{chat.avgPosition > 0 ? chat.avgPosition.toFixed(1) : "—"}</td>}
                        {visibleCols.created   && <td className="ac-td-created">{timeAgo}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="ac-pagination">
            <span className="ac-page-count">
              {(chatPage - 1) * CHAT_PAGE_SIZE + 1}–{Math.min(chatPage * CHAT_PAGE_SIZE, total)} of {total.toLocaleString()}
            </span>
            <div className="ac-page-buttons">
              <button className="ac-page-btn" disabled={chatPage === 1} onClick={() => setChatPage(1)}>«</button>
              <button className="ac-page-btn" disabled={chatPage === 1} onClick={() => setChatPage(p => p - 1)}>‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5) {
                  if (chatPage <= 3) p = i + 1;
                  else if (chatPage >= totalPages - 2) p = totalPages - 4 + i;
                  else p = chatPage - 2 + i;
                }
                return (
                  <button key={p} className={`ac-page-btn ${chatPage === p ? "ac-page-btn--active" : ""}`} onClick={() => setChatPage(p)}>
                    {p}
                  </button>
                );
              })}
              {totalPages > 5 && chatPage < totalPages - 2 && <span className="ac-page-ellipsis">…</span>}
              {totalPages > 5 && chatPage < totalPages - 2 && (
                <button className={`ac-page-btn ${chatPage === totalPages ? "ac-page-btn--active" : ""}`} onClick={() => setChatPage(totalPages)}>
                  {totalPages}
                </button>
              )}
              <button className="ac-page-btn" disabled={chatPage === totalPages} onClick={() => setChatPage(p => p + 1)}>›</button>
              <button className="ac-page-btn" disabled={chatPage === totalPages} onClick={() => setChatPage(totalPages)}>»</button>
            </div>
          </div>
        )}
      </div>

      {/* Chat detail modal */}
      {selectedChat && <ChatModal chat={selectedChat} onClose={() => setSelectedChat(null)} />}
    </div>
  );
}
