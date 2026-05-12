"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  Play,
  Trash2,
  Download,
  Filter,
  Calendar,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface PromptMetric {
  id: string;
  query: string;
  topicName: string;
  volumeTier: string;
  createdAt: string;
  visibility: number;
  visibilityTrend: number;
  sentiment: number;
  sentimentTrend: number;
  avgPosition: number;
  positionTrend: number;
  mentions: number;
  mentionsTrend: number;
  rank: number;
  enginesUsed: string[];
  lastRunDate: string | null;
}

interface Props {
  prompts: PromptMetric[];
  totalCount: number;
  addPromptAction: (formData: FormData) => Promise<void>;
  runNowAction: (promptId: string, query: string, selectedEngines: string[]) => Promise<void>;
}

// ── Engine Colors ──────────────────────────────────────────────────────────
const ENGINE_COLORS: Record<string, string> = {
  ChatGPT: "#10a37f",
  Claude: "#d97706",
  Perplexity: "#3b82f6",
  Gemini: "#8b5cf6",
  "AI Overviews": "#ef4444",
};

const ALL_ENGINES = ["ChatGPT", "Claude", "Perplexity", "Gemini", "AI Overviews"];

// ── Sort helpers ───────────────────────────────────────────────────────────
type SortField = "rank" | "query" | "visibility" | "sentiment" | "avgPosition" | "mentions" | "volumeTier" | "createdAt";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

// ── Component ──────────────────────────────────────────────────────────────
export default function PromptsComparisonClient({
  prompts,
  totalCount,
  addPromptAction,
  runNowAction,
}: Props) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "archived" | "attention">("all");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEngine, setSelectedEngine] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [runningPrompts, setRunningPrompts] = useState<Record<string, boolean>>({});

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const allAvailableModels = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Groq"];
  const [selectedModels, setSelectedModels] = useState<string[]>(allAvailableModels);

  const toggleModel = (model: string) => {
    if (selectedModels.includes(model)) {
      setSelectedModels(selectedModels.filter(m => m !== model));
    } else {
      setSelectedModels([...selectedModels, model]);
    }
  };

  const handleRun = async (id: string, query: string) => {
    setRunningPrompts(prev => ({ ...prev, [id]: true }));
    try {
      await runNowAction(id, query, selectedModels);
      // Show running state for 3 seconds to give feedback
      setTimeout(() => {
        setRunningPrompts(prev => ({ ...prev, [id]: false }));
      }, 3000);
    } catch (e) {
      setRunningPrompts(prev => ({ ...prev, [id]: false }));
    }
  };

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...prompts];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.query.toLowerCase().includes(q));
    }

    // Engine filter
    if (selectedEngine !== "all") {
      result = result.filter((p) => p.enginesUsed.includes(selectedEngine));
    }

    // Tab filter (all are "active" for now)
    if (activeTab === "attention") {
      result = result.filter((p) => p.visibility < 10 || p.sentiment < 30);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "rank": cmp = a.rank - b.rank; break;
        case "query": cmp = a.query.localeCompare(b.query); break;
        case "visibility": cmp = a.visibility - b.visibility; break;
        case "sentiment": cmp = a.sentiment - b.sentiment; break;
        case "avgPosition": cmp = a.avgPosition - b.avgPosition; break;
        case "mentions": cmp = a.mentions - b.mentions; break;
        case "volumeTier": cmp = a.volumeTier.localeCompare(b.volumeTier); break;
        case "createdAt": cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [prompts, search, activeTab, sortField, sortDir, selectedEngine]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={9} style={{ marginLeft: 3, opacity: 0.3 }} />;
    return sortDir === "asc" ? (
      <ChevronUp size={10} style={{ marginLeft: 3 }} />
    ) : (
      <ChevronDown size={10} style={{ marginLeft: 3 }} />
    );
  };

  const getTrendEl = (val: number) => {
    if (val > 0) return <span className="pc-trend-up">▲ +{val.toFixed(1)}</span>;
    if (val < 0) return <span className="pc-trend-down">▼ {val.toFixed(1)}</span>;
    return <span className="pc-trend-flat">—</span>;
  };

  const getSentimentClass = (val: number) => {
    if (val >= 60) return "pc-sentiment-positive";
    if (val >= 35) return "pc-sentiment-neutral";
    return "pc-sentiment-negative";
  };

  const getPositionClass = (val: number) => {
    if (val <= 3) return "pc-position-top";
    if (val <= 6) return "pc-position-mid";
    return "pc-position-low";
  };

  const getVolumeClass = (tier: string) => {
    const t = tier.toLowerCase();
    if (t.includes("high")) return "pc-vol-high";
    if (t.includes("medium")) return "pc-vol-medium";
    return "pc-vol-low";
  };

  // Spark bars (simple 5-bar visualization)
  const renderSpark = (base: number) => {
    const heights = [];
    for (let i = 0; i < 5; i++) {
      heights.push(Math.max(2, Math.min(16, base * 0.16 + Math.sin(i * 1.3) * 6 + 4)));
    }
    return (
      <span className="pc-spark">
        {heights.map((h, i) => (
          <span key={i} className="pc-spark-bar" style={{ height: `${h}px` }} />
        ))}
      </span>
    );
  };

  const attentionCount = prompts.filter((p) => p.visibility < 10 || p.sentiment < 30).length;

  return (
    <div className="pc-page">
      {/* Breadcrumb */}
      <div className="pc-breadcrumb">
        <a href="/">Dashboard</a> &gt; <span>Prompts</span>
      </div>

      {/* Filter Bar */}
      <div className="pc-filter-bar">
        <button className="pc-filter-chip">
          🏢 Thrive
          <ChevronDown size={11} />
        </button>
        <div className="pc-filter-sep" />
        <button className="pc-filter-chip">
          <Calendar size={11} />
          Last 30 days
          <ChevronDown size={11} />
        </button>
        <button className="pc-filter-chip">
          All Topics
          <ChevronDown size={11} />
        </button>
        {/* Models Dropdown */}
        <div className="relative inline-block text-left" style={{ position: "relative" }}>
          <button 
            className="pc-filter-chip"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
          >
            {selectedModels.length === allAvailableModels.length ? "All Models" : `${selectedModels.length} Models`} <ChevronDown size={11} />
          </button>
          
          {isModelDropdownOpen && (
            <div className="absolute left-0 z-50 mt-2 w-56 origin-top-left rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none" style={{ position: "absolute", zIndex: 50, marginTop: "8px", width: "14rem", borderRadius: "0.375rem", backgroundColor: "#141418", border: "1px solid #1e293b", padding: "4px 0" }}>
              <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ borderBottom: "1px solid #1e293b", padding: "8px 16px", color: "#64748b", fontSize: "12px", textTransform: "uppercase" }}>
                Active models
              </div>
              <div className="max-h-60 overflow-y-auto" style={{ maxHeight: "15rem", overflowY: "auto" }}>
                {allAvailableModels.map((model) => (
                  <label key={model} className="flex items-center px-4 py-2 cursor-pointer group" style={{ display: "flex", alignItems: "center", padding: "8px 16px", cursor: "pointer" }}>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input 
                        type="checkbox" 
                        style={{ width: "16px", height: "16px", borderRadius: "4px", accentColor: "#6366f1", cursor: "pointer", appearance: "auto" }}
                        checked={selectedModels.includes(model)}
                        onChange={() => toggleModel(model)}
                      />
                    </div>
                    <div className="ml-3 flex items-center gap-2" style={{ marginLeft: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ENGINE_COLORS[model] || "#64748b" }} />
                      <span style={{ fontSize: "14px", fontWeight: 500, color: "#cbd5e1" }}>{model}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Row */}
      <div className="pc-tabs-row">
        <div className="pc-tabs-left">
          {([
            { key: "all", label: "All", count: totalCount },
            { key: "active", label: "Active", count: totalCount },
            { key: "archived", label: "Archived", count: 0 },
            { key: "attention", label: "Attention", count: attentionCount },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              className={`pc-tab ${activeTab === tab.key ? "pc-tab-active" : ""}`}
              onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
            >
              {tab.label}
              <span className="pc-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="pc-tabs-right">
          <div className="pc-search-box">
            <Search size={13} className="pc-search-icon" />
            <input
              className="pc-search-input"
              placeholder="Search prompts..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <button className="pc-action-btn">
            <Filter size={12} />
            Filters
          </button>
          <button className="pc-action-btn">
            <Download size={12} />
            Export
          </button>
          <button className="pc-add-btn" onClick={() => setShowAddForm(true)}>
            <Plus size={13} />
            Add Prompt
          </button>
        </div>
      </div>

      {/* Engine Pills */}
      <div className="pc-engines-row">
        <button
          className={`pc-engine-pill ${selectedEngine === "all" ? "pc-engine-pill-active" : ""}`}
          onClick={() => { setSelectedEngine("all"); setCurrentPage(1); }}
        >
          All engines
        </button>
        {ALL_ENGINES.map((eng) => (
          <button
            key={eng}
            className={`pc-engine-pill ${selectedEngine === eng ? "pc-engine-pill-active" : ""}`}
            onClick={() => { setSelectedEngine(eng); setCurrentPage(1); }}
          >
            <span className="pc-engine-dot" style={{ background: ENGINE_COLORS[eng] }} />
            {eng}
          </button>
        ))}
      </div>

      {/* Main Table */}
      <div className="pc-table-wrapper">
        <table className="pc-table">
          <thead>
            <tr>
              <th onClick={() => handleSort("rank")} className={sortField === "rank" ? "pc-th-sort" : ""}>
                # {renderSortIcon("rank")}
              </th>
              <th onClick={() => handleSort("query")} className={sortField === "query" ? "pc-th-sort" : ""}>
                Prompt {renderSortIcon("query")}
              </th>
              <th onClick={() => handleSort("visibility")} className={sortField === "visibility" ? "pc-th-sort" : ""}>
                Visibility {renderSortIcon("visibility")}
              </th>
              <th onClick={() => handleSort("sentiment")} className={sortField === "sentiment" ? "pc-th-sort" : ""}>
                Sentiment {renderSortIcon("sentiment")}
              </th>
              <th onClick={() => handleSort("avgPosition")} className={sortField === "avgPosition" ? "pc-th-sort" : ""}>
                Position {renderSortIcon("avgPosition")}
              </th>
              <th onClick={() => handleSort("mentions")} className={sortField === "mentions" ? "pc-th-sort" : ""}>
                Mentions {renderSortIcon("mentions")}
              </th>
              <th onClick={() => handleSort("volumeTier")} className={sortField === "volumeTier" ? "pc-th-sort" : ""}>
                Volume {renderSortIcon("volumeTier")}
              </th>
              <th>Rank</th>
              <th>Type</th>
              <th onClick={() => handleSort("createdAt")} className={sortField === "createdAt" ? "pc-th-sort" : ""}>
                Date {renderSortIcon("createdAt")}
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <div className="pc-empty">
                    <div className="pc-empty-icon">📊</div>
                    <div className="pc-empty-text">No prompts found</div>
                    <div className="pc-empty-sub">Add a prompt to start tracking AI visibility</div>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((p, idx) => {
                const rowNum = (currentPage - 1) * PAGE_SIZE + idx + 1;
                const dateStr = p.lastRunDate
                  ? new Date(p.lastRunDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "—";
                return (
                  <tr key={p.id}>
                    <td><span className="pc-row-num">{rowNum}</span></td>
                    <td className="pc-prompt-cell">
                      <a href={`/prompts/${p.id}`} className="pc-prompt-link">
                        {p.query}
                      </a>
                    </td>
                    <td>
                      <span className="pc-metric pc-metric-vis">{p.visibility}%</span>
                      {renderSpark(p.visibility)}
                      <br />
                      {getTrendEl(p.visibilityTrend)}
                    </td>
                    <td>
                      <div className="pc-sentiment-bar-container">
                        <div className="pc-sentiment-bar-track">
                          <div
                            className={`pc-sentiment-bar-fill ${getSentimentClass(p.sentiment)}`}
                            style={{ width: `${Math.min(100, p.sentiment)}%` }}
                          />
                        </div>
                        <span className="pc-metric">{p.sentiment.toFixed(0)}</span>
                      </div>
                      {getTrendEl(p.sentimentTrend)}
                    </td>
                    <td>
                      <span className={`pc-position-badge ${getPositionClass(p.avgPosition)}`}>
                        #{p.avgPosition.toFixed(1)}
                      </span>
                      <br />
                      {getTrendEl(p.positionTrend)}
                    </td>
                    <td>
                      <span className="pc-mentions-count">{p.mentions}</span>
                      <br />
                      {getTrendEl(p.mentionsTrend)}
                    </td>
                    <td>
                      <span className={`pc-volume-badge ${getVolumeClass(p.volumeTier)}`}>
                        {p.volumeTier}
                      </span>
                    </td>
                    <td className="pc-rank-cell">{p.rank}</td>
                    <td className="pc-type-cell">
                      <span className="pc-status-active">Active</span>
                    </td>
                    <td className="pc-date-cell">{dateStr}</td>
                    <td>
                      <div className="pc-actions-cell">
                        <form action={() => handleRun(p.id, p.query)} style={{ display: "inline" }}>
                          <button type="submit" className="pc-action-icon-btn pc-action-run" title="Run Now" disabled={runningPrompts[p.id]}>
                            {runningPrompts[p.id] ? (
                              <Loader2 size={13} className="animate-spin text-indigo-500" style={{ animation: "spin 2s linear infinite" }} />
                            ) : (
                              <Play size={13} />
                            )}
                          </button>
                        </form>
                        <button className="pc-action-icon-btn pc-action-delete" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="pc-pagination">
            <div className="pc-pagination-info">
              <span className="pc-pagination-count">{filtered.length} Prompts</span>
              <span>·</span>
              <span>Page {currentPage} of {totalPages}</span>
            </div>
            <div className="pc-pagination-nav">
              <button
                className="pc-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    className={`pc-page-btn ${currentPage === pageNum ? "pc-page-btn-active" : ""}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                className="pc-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Prompt Modal */}
      {showAddForm && (
        <div className="pc-add-form-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setShowAddForm(false);
        }}>
          <div className="pc-add-form-card">
            <div className="pc-add-form-title">Add New Prompt</div>
            <form action={async (formData) => {
              await addPromptAction(formData);
              setShowAddForm(false);
            }}>
              <input
                className="pc-add-form-input"
                name="query"
                placeholder="e.g. Best CRM software for small business 2026"
                required
                autoFocus
              />
              <div className="pc-add-form-actions">
                <button type="button" className="pc-add-form-cancel" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="pc-add-form-submit">
                  Add Prompt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
