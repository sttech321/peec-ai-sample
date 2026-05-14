"use client";

import { useState, useMemo } from "react";
import {
  Check, X, Square, ChevronDown, Tag as TagIcon,
  Layers, FileText, Info, TrendingUp, BarChart2,
} from "lucide-react";
import Link from "next/link";
import { updateActionStatus } from "../app/earned/actions";

// ── Types ────────────────────────────────────────────────────────────────────

interface EarnedAction {
  id: string;
  type: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  sourceUrl: string | null;
  sourceDomain: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ChannelRow { name: string; count: number; }
interface SourceRow {
  title: string;
  url: string;
  domain: string;
  retrievals: number;
  citationRate: number;
}

// Platform badge colors
const PLATFORM_BADGE: Record<string, { bg: string; text: string }> = {
  "reddit.com":   { bg: "#fff7ed", text: "#c2410c" },
  "linkedin.com": { bg: "#eff6ff", text: "#1d4ed8" },
  "g2.com":       { bg: "#fef2f2", text: "#b91c1c" },
  "quora.com":    { bg: "#fef2f2", text: "#b91c1c" },
  "medium.com":   { bg: "#f4f4f5", text: "#3f3f46" },
  "youtube.com":  { bg: "#fef2f2", text: "#b91c1c" },
};

const PLATFORM_DOT: Record<string, string> = {
  "reddit.com":   "#ef4444",
  "linkedin.com": "#3b82f6",
  "g2.com":       "#ef4444",
  "quora.com":    "#ef4444",
  "medium.com":   "#27272a",
  "youtube.com":  "#ef4444",
};

// ── Utilities ────────────────────────────────────────────────────────────────

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
}

function timeAgo(date: Date | string): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function scoreFromPriority(priority: string): number {
  if (priority === "High") return 3;
  if (priority === "Medium") return 2;
  return 1;
}

function ScoreBadge({ score }: { score: number }) {
  const s =
    score === 3 ? { bg: "#f0fdf4", color: "#16a34a", borderColor: "#bbf7d0" }
    : score === 2 ? { bg: "#fefce8", color: "#ca8a04", borderColor: "#fef08a" }
    : { bg: "#f4f4f5", color: "#71717a", borderColor: "#e4e4e7" };
  return (
    <span className="ac-score-badge" style={s} title={`Opportunity score: ${score}`}>
      {score}
    </span>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: string }) {
  const color =
    priority === "High" ? "#22c55e"
    : priority === "Medium" ? "#f59e0b"
    : "#9ca3af";
  return (
    <span className="ac-priority-dot-wrap">
      <span className="ac-priority-dot" style={{ background: color }} />
      {priority}
    </span>
  );
}

function PlatformBadge({ domain, type }: { domain: string | null; type: string | null }) {
  if (domain) {
    const colors = PLATFORM_BADGE[domain] || { bg: "#f4f4f5", text: "#3f3f46" };
    return (
      <span className="ac-platform-badge" style={{ background: colors.bg, color: colors.text }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={faviconUrl(domain)} alt=""
          className="ac-badge-favicon"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        {domain}
      </span>
    );
  }
  if (type) {
    const isReference = type === "Reference";
    const isContent = ["listicle", "article"].includes(type.toLowerCase());
    return (
      <span
        className="ac-platform-badge"
        style={{
          background: isReference ? "#f0f9ff" : isContent ? "#ecfeff" : "#f5f3ff",
          color: isReference ? "#0369a1" : isContent ? "#0e7490" : "#6d28d9",
        }}
      >
        {type}
      </span>
    );
  }
  return null;
}

function ActionCard({
  action,
  onUpdate,
}: {
  action: EarnedAction;
  onUpdate: (id: string, status: string) => void;
}) {
  const linkMatch = action.description.match(/\[([^\]]+)\]/);
  const linkText = linkMatch ? linkMatch[1] : null;
  const beforeLink = linkText ? action.description.split(`[${linkText}]`)[0] : action.description;
  const afterLink = linkText ? (action.description.split(`[${linkText}]`)[1] ?? "") : "";

  const toggle = (next: string) => onUpdate(action.id, action.status === next ? "todo" : next);

  return (
    <div className={`ac-card ${action.status === "done" ? "ac-card-done" : action.status === "declined" ? "ac-card-declined" : ""}`}>
      <div className="ac-card-meta">
        <ScoreBadge score={scoreFromPriority(action.priority)} />
        <PriorityDot priority={action.priority} />
        <PlatformBadge domain={action.sourceDomain} type={action.type} />
      </div>
      <div className="ac-card-body">
        {linkText && action.sourceUrl ? (
          <>
            {beforeLink}
            <a href={action.sourceUrl} target="_blank" rel="noopener noreferrer">{linkText}</a>
            {afterLink}
          </>
        ) : (
          action.description
        )}
      </div>
      <div className="ac-card-actions">
        <div className="ac-card-actions-left">
          <button
            className={`ac-action-btn ac-action-btn-done ${action.status === "done" ? "ac-action-btn-active" : ""}`}
            onClick={() => toggle("done")}
          >
            <Check size={12} /> Done
          </button>
          <button
            className={`ac-action-btn ac-action-btn-decline ${action.status === "declined" ? "ac-action-btn-active" : ""}`}
            onClick={() => toggle("declined")}
          >
            <X size={12} /> Decline
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="ac-card-date">{timeAgo(action.updatedAt)}</span>
          <button
            className={`ac-action-btn ac-action-btn-todo ${action.status === "todo" ? "ac-action-btn-active" : ""}`}
            onClick={() => onUpdate(action.id, "todo")}
          >
            <Square size={12} /> Todo
          </button>
        </div>
      </div>
    </div>
  );
}

function TopChannelsChart({ domain, channels }: { domain: string; channels: ChannelRow[] }) {
  const [showAll, setShowAll] = useState(false);
  if (channels.length === 0) return null;
  const max = Math.max(...channels.map((c) => c.count));
  const visible = showAll ? channels : channels.slice(0, 6);
  const channelLabel =
    domain === "reddit.com" ? "Top Subreddits"
    : domain === "linkedin.com" ? "Top Networks"
    : "Top Channels";

  return (
    <div className="ac-section">
      <div className="ac-section-head">
        <h3 className="ac-section-title">Top channels</h3>
      </div>
      <div className="ac-section-sublabel">
        {channelLabel}
        <Info size={12} style={{ marginLeft: 4, verticalAlign: "middle", color: "#a1a1aa" }} />
      </div>
      <div className="ac-bar-list">
        {visible.map((ch) => (
          <div key={ch.name} className="ac-bar-row">
            <span className="ac-bar-label">{ch.name}</span>
            <div className="ac-bar-track">
              <div className="ac-bar-fill" style={{ width: `${(ch.count / max) * 100}%` }} />
            </div>
            <span className="ac-bar-count">{ch.count}</span>
          </div>
        ))}
        {channels.length > 6 && (
          <button className="ac-show-all-btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show less" : `Show all (${channels.length})`}
          </button>
        )}
      </div>
    </div>
  );
}

function SourcesTable({ rows }: { rows: SourceRow[] }) {
  return (
    <div className="ac-section">
      <div className="ac-section-head">
        <h3 className="ac-section-title">Sources</h3>
        <span className="ac-section-note">Not mentioning your brand</span>
      </div>
      {rows.length === 0 ? (
        <p className="ac-empty-inline">No scan data yet. Sources will appear after your first AI scan.</p>
      ) : (
        <div className="ac-list">
          <div className="ac-list-head ac-list-head-earned">
            <span>URL</span>
            <span>Retrievals ↓</span>
            <span>Citation rate</span>
          </div>
          {rows.map((s, i) => (
            <div key={i} className="ac-list-row ac-list-row-earned">
              <div className="ac-list-text">
                <div style={{ fontWeight: 500, marginBottom: 2, color: "#18181b" }}>{s.title}</div>
                <div className="ac-list-url">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={faviconUrl(s.domain)} alt=""
                    style={{ width: 11, height: 11, borderRadius: 2, flexShrink: 0 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  {s.url}
                </div>
              </div>
              <span className="ac-list-num ac-list-num-bold">{s.retrievals}</span>
              <span className="ac-list-num">{s.citationRate.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function EarnedClient({
  initialActions,
  projectName: _projectName,
  sourcesMap,
  channelsMap,
}: {
  initialActions: any[];
  projectName: string;
  sourcesMap: Record<string, SourceRow[]>;
  channelsMap: Record<string, ChannelRow[]>;
}) {
  const seed = useMemo(
    () =>
      initialActions.map((a) => ({
        ...a,
        createdAt: new Date(a.createdAt),
        updatedAt: new Date(a.updatedAt),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [actions, setActions] = useState<EarnedAction[]>(seed);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "todo" | "done" | "declined">("all");

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)),
    );
    if (!id.startsWith("m")) {
      await updateActionStatus(id, newStatus);
    }
  };

  const { ugcDomains, editorialTypes, referenceCount } = useMemo(() => {
    const ugc = new Map<string, number>();
    const ed = new Map<string, number>();
    let refCount = 0;
    for (const a of actions) {
      if (a.sourceDomain) {
        ugc.set(a.sourceDomain, (ugc.get(a.sourceDomain) ?? 0) + 1);
      } else if (a.type === "Reference") {
        refCount++;
      } else if (a.type) {
        ed.set(a.type, (ed.get(a.type) ?? 0) + 1);
      }
    }
    return {
      ugcDomains: Array.from(ugc.entries()).sort((a, b) => b[1] - a[1]),
      editorialTypes: Array.from(ed.entries()).sort((a, b) => b[1] - a[1]),
      referenceCount: refCount,
    };
  }, [actions]);

  const filtered = useMemo(() => {
    return actions.filter((a) => {
      if (statusFilter === "todo" && a.status !== "todo") return false;
      if (statusFilter === "done" && a.status !== "done") return false;
      if (statusFilter === "declined" && a.status !== "declined") return false;
      if (selectedDomain && a.sourceDomain !== selectedDomain) return false;
      if (selectedType && a.type !== selectedType) return false;
      return true;
    });
  }, [actions, statusFilter, selectedDomain, selectedType]);

  const stats = useMemo(
    () => ({
      total: actions.length,
      done: actions.filter((a) => a.status === "done").length,
      skipped: actions.filter((a) => a.status === "declined").length,
      todo: actions.filter((a) => a.status === "todo").length,
    }),
    [actions],
  );

  const isOverview = !selectedDomain && !selectedType;

  const selectDomain = (d: string) => { setSelectedDomain(d); setSelectedType(null); setStatusFilter("all"); };
  const selectType = (t: string) => { setSelectedType(t); setSelectedDomain(null); setStatusFilter("all"); };
  const goOverview = () => { setSelectedDomain(null); setSelectedType(null); setStatusFilter("all"); };

  return (
    <div className="ac-page">

      {/* Filter chips */}
      <div className="ac-filter-bar">
        <button className="ac-chip">
          <TagIcon size={13} /> All Tags <ChevronDown size={12} />
        </button>
        <button className="ac-chip">
          <Layers size={13} /> All Models <ChevronDown size={12} />
        </button>
      </div>

      <div className="ac-main">

        {/* Left sub-nav */}
        <aside className="ac-subnav">
          <div className="ac-subnav-header">
            <TrendingUp size={14} /> Earned
          </div>

          <button
            className={`ac-subnav-item ${isOverview ? "ac-subnav-item-active" : ""}`}
            onClick={goOverview}
          >
            <span>Overview</span>
          </button>

          {ugcDomains.length > 0 && (
            <>
              <div className="ac-subnav-section-label">
                UGC
                <Info size={11} style={{ marginLeft: 3, color: "#c4c4cc" }} />
              </div>
              {ugcDomains.map(([domain, count]) => (
                <button
                  key={domain}
                  className={`ac-subnav-item ${selectedDomain === domain ? "ac-subnav-item-active" : ""}`}
                  onClick={() => selectDomain(domain)}
                >
                  <span className="ac-subnav-item-content">
                    <span
                      className="ac-subnav-dot"
                      style={{ background: PLATFORM_DOT[domain] ?? "#9ca3af" }}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={faviconUrl(domain)} alt=""
                      className="ac-subnav-favicon"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                    <span className="ac-subnav-label">{domain}</span>
                  </span>
                  <span className="ac-subnav-count">{count}</span>
                </button>
              ))}
            </>
          )}

          {editorialTypes.length > 0 && (
            <>
              <div className="ac-subnav-section-label">
                Editorial
                <Info size={11} style={{ marginLeft: 3, color: "#c4c4cc" }} />
              </div>
              {editorialTypes.map(([type, count]) => (
                <button
                  key={type}
                  className={`ac-subnav-item ${selectedType === type ? "ac-subnav-item-active" : ""}`}
                  onClick={() => selectType(type)}
                >
                  <span className="ac-subnav-item-content">
                    <span className="ac-subnav-dot" style={{ background: "#06b6d4" }} />
                    <span className="ac-subnav-label">{type}</span>
                  </span>
                  <span className="ac-subnav-count">{count}</span>
                </button>
              ))}
            </>
          )}

          {referenceCount > 0 && (
            <>
              <div className="ac-subnav-section-label">
                Reference
                <Info size={11} style={{ marginLeft: 3, color: "#c4c4cc" }} />
              </div>
              <button
                className={`ac-subnav-item ${selectedType === "Reference" ? "ac-subnav-item-active" : ""}`}
                onClick={() => selectType("Reference")}
              >
                <span className="ac-subnav-item-content">
                  <span className="ac-subnav-dot" style={{ background: "#0369a1" }} />
                  <span className="ac-subnav-label">Reference</span>
                </span>
                <span className="ac-subnav-count">{referenceCount}</span>
              </button>
            </>
          )}
        </aside>

        {/* Main content */}
        <section className="ac-content">

          {/* Breadcrumb */}
          <div className="ac-breadcrumb">
            <button className="ac-breadcrumb-link" onClick={goOverview}>
              <span className="ac-breadcrumb-icon"><BarChart2 size={13} /></span>
              Actions
            </button>
            {selectedDomain && (
              <>
                <span className="ac-breadcrumb-sep">/</span>
                <span className="ac-breadcrumb-part">UGC</span>
                <span className="ac-breadcrumb-sep">/</span>
                <span className="ac-breadcrumb-current">{selectedDomain}</span>
              </>
            )}
            {selectedType && (
              <>
                <span className="ac-breadcrumb-sep">/</span>
                <span className="ac-breadcrumb-part">Editorial</span>
                <span className="ac-breadcrumb-sep">/</span>
                <span className="ac-breadcrumb-current">{selectedType}</span>
              </>
            )}
            {isOverview && (
              <>
                <span className="ac-breadcrumb-sep">/</span>
                <span className="ac-breadcrumb-current">Overview</span>
              </>
            )}
          </div>

          {/* Page heading */}
          <div className="ac-content-heading">
            {(selectedDomain || selectedType) && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                {selectedDomain && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={faviconUrl(selectedDomain)} alt=""
                    style={{ width: 20, height: 20, borderRadius: 4 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <h1 className="ac-content-title">{selectedDomain ?? selectedType}</h1>
              </div>
            )}
            {isOverview && (
              <>
                <p className="ac-content-eyebrow">Overview</p>
                <h1 className="ac-content-title">
                  Address all suggestions and fill gaps in your earned content
                </h1>
              </>
            )}
          </div>

          {/* Stats row (overview only) */}
          {isOverview && (
            <div className="ac-metrics">
              <div className="ac-metric">
                <span className="ac-metric-label">All earned actions</span>
                <span className="ac-metric-value">{stats.total}</span>
              </div>
              <div className="ac-metric">
                <span className="ac-metric-label">Done actions</span>
                <span className="ac-metric-value">{stats.done}</span>
              </div>
              <div className="ac-metric">
                <span className="ac-metric-label">Skipped actions</span>
                <span className="ac-metric-value">{stats.skipped}</span>
              </div>
              <div className="ac-metric">
                <span className="ac-metric-label">Todo actions</span>
                <span className="ac-metric-value">{stats.todo}</span>
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="ac-recs">
            <div className="ac-recs-head">
              <div>
                <h2 className="ac-recs-title">All recommendations</h2>
                <p className="ac-recs-sub">
                  Act on these suggestions to increase your AI search visibility.
                </p>
              </div>
              <div className="ac-status-toggle">
                {(["all", "todo", "done", "declined"] as const).map((f) => (
                  <button
                    key={f}
                    className={`ac-status-btn ${statusFilter === f ? "ac-status-btn-active" : ""}`}
                    onClick={() => setStatusFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className={`ac-cards ${!isOverview ? "ac-cards-detail" : ""}`}>
              {filtered.map((action) => (
                <ActionCard key={action.id} action={action} onUpdate={handleStatusUpdate} />
              ))}
              {filtered.length === 0 && (
                <div className="ac-empty-inline">
                  No actions match this filter.
                </div>
              )}
            </div>
          </div>

          {/* Top Channels (domain detail only) */}
          {selectedDomain && (
            <TopChannelsChart
              domain={selectedDomain}
              channels={channelsMap[selectedDomain] ?? []}
            />
          )}

          {/* Sources table (domain or type detail) */}
          {selectedDomain && (
            <SourcesTable rows={sourcesMap[selectedDomain] ?? []} />
          )}
          {selectedType && (
            <SourcesTable
              rows={selectedType === "Reference"
                ? (sourcesMap["Reference"] ?? [])
                : (sourcesMap["Editorial"] ?? [])}
            />
          )}

        </section>
      </div>
    </div>
  );
}
