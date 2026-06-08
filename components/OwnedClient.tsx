"use client";

import { useState, useMemo } from "react";
import {
  Check, X, Square, ChevronDown, Tag as TagIcon,
  Layers, Crosshair, Info, Copy, Check as CheckIcon, BarChart2, ExternalLink, Zap,
} from "lucide-react";
import Link from "next/link";
import { updateOwnedActionStatus } from "../app/owned/actions";

// ── Types ────────────────────────────────────────────────────────────────────

interface OwnedAction {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  pageUrl: string | null;
  contentType?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Phrase { text: string; count: number; }
interface Domain { name: string; count: number; }
interface Source { title: string; url: string; domain: string; mentioned: string; retrievals: number; citationRate: number; }

// ── Content-type metadata ────────────────────────────────────────────────────

const TYPE_META: Record<string, { color: string; bg: string; dot: string }> = {
  "Listicle":      { color: "#1d4ed8", bg: "#eff6ff", dot: "#3b82f6" },
  "Product Page":  { color: "#a16207", bg: "#fffbeb", dot: "#f59e0b" },
  "Homepage":      { color: "#c2410c", bg: "#fff7ed", dot: "#f97316" },
  "Article":       { color: "#52525b", bg: "#f4f4f5", dot: "#9ca3af" },
  "How-To Guide":  { color: "#52525b", bg: "#f4f4f5", dot: "#9ca3af" },
  "Category Page": { color: "#52525b", bg: "#f4f4f5", dot: "#9ca3af" },
  "Comparison":    { color: "#7c3aed", bg: "#f5f3ff", dot: "#a78bfa" },
  "Other":         { color: "#52525b", bg: "#f4f4f5", dot: "#9ca3af" },
};


// ── Utilities ────────────────────────────────────────────────────────────────

function faviconUrl(domain: string) {
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

// Infer content type from action text
function inferContentType(action: { title?: string; description?: string }): string {
  const text = `${action.title ?? ""} ${action.description ?? ""}`.toLowerCase();
  if (/listicle|top\s+\d+|best\s+\w+\s+(agencies|companies|tools)/i.test(text)) return "Listicle";
  if (/homepage|home page|landing page/i.test(text)) return "Homepage";
  if (/product page|product/i.test(text)) return "Product Page";
  if (/how[\s-]to|guide|tutorial/i.test(text)) return "How-To Guide";
  if (/category page|category/i.test(text)) return "Category Page";
  if (/comparison|vs\.|versus/i.test(text)) return "Comparison";
  if (/article|blog/i.test(text)) return "Article";
  return "Article";
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SignalBars({ score, color }: { score: number; color: string }) {
  return (
    <span className="ac-signal-bars" style={{ "--bar-color": color } as React.CSSProperties}>
      <span style={{ height: 4 }} />
      <span style={{ height: 7, opacity: score >= 2 ? 1 : 0.25 }} />
      <span style={{ height: 10, opacity: score >= 3 ? 1 : 0.25 }} />
    </span>
  );
}

function ScorePill({ priority }: { priority: string }) {
  const score = scoreFromPriority(priority);
  const s =
    priority === "High"   ? { bg: "#f0fdf4", color: "#16a34a" }
    : priority === "Medium" ? { bg: "#fefce8", color: "#ca8a04" }
    : { bg: "#f4f4f5", color: "#71717a" };
  return (
    <span className="ac-score-pill" style={{ background: s.bg, color: s.color }}>
      <SignalBars score={score} color={s.color} />
      {priority}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? TYPE_META["Other"];
  return (
    <span className="ac-platform-badge" style={{ background: meta.bg, color: meta.color }}>
      <span className="ac-priority-dot" style={{ background: meta.dot }} />
      {type}
    </span>
  );
}

function ActionCard({ action, onUpdate }: { action: OwnedAction; onUpdate: (id: string, status: string) => void }) {
  const linkMatch = action.description.match(/\[([^\]]+)\]/);
  const linkText = linkMatch ? linkMatch[1] : null;
  const beforeLink = linkText ? action.description.split(`[${linkText}]`)[0] : action.description;
  const afterLink = linkText ? (action.description.split(`[${linkText}]`)[1] ?? "") : "";
  const toggle = (next: string) => onUpdate(action.id, action.status === next ? "todo" : next);

  return (
    <div className={`ac-card ${action.status === "done" ? "ac-card-done" : action.status === "declined" ? "ac-card-declined" : ""}`}>
      <div className="ac-card-meta">
        <ScorePill priority={action.priority} />
        <TypeBadge type={action.contentType ?? "Other"} />
      </div>
      <div className="ac-card-body">
        {linkText && action.pageUrl ? (
          <>{beforeLink}<a href={action.pageUrl} target="_blank" rel="noopener noreferrer">{linkText}</a>{afterLink}</>
        ) : (action.description)}
      </div>
      {/* 3 buttons only — Done / Decline / Todo */}
      <div className="ac-card-actions">
        <button className={`ac-action-btn ac-action-btn-done ${action.status === "done" ? "ac-action-btn-active" : ""}`} onClick={() => toggle("done")}>
          <Check size={12} /> Done
        </button>
        <button className={`ac-action-btn ac-action-btn-decline ${action.status === "declined" ? "ac-action-btn-active" : ""}`} onClick={() => toggle("declined")}>
          <X size={12} /> Decline
        </button>
        <button className={`ac-action-btn ac-action-btn-todo ${action.status === "todo" ? "ac-action-btn-active" : ""}`} onClick={() => onUpdate(action.id, "todo")}>
          <Square size={12} /> Todo
        </button>
      </div>
    </div>
  );
}

function PhrasesPanel({ contentType, phrasesMap }: { contentType: string; phrasesMap: Record<string, Phrase[]> }) {
  const [tab, setTab] = useState<"phrases" | "themes">("phrases");
  const [copied, setCopied] = useState(false);
  const phrases = phrasesMap[contentType] ?? [];
  const max = phrases.length > 0 ? Math.max(...phrases.map((p) => p.count)) : 1;

  const handleCopy = () => {
    const text = phrases.map((p) => p.text).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="ow-panel">
      <div className="ow-panel-head">
        <div className="ac-tabs" style={{ borderBottom: "none" }}>
          <button className={`ac-tab ${tab === "phrases" ? "ac-tab-active" : ""}`} onClick={() => setTab("phrases")}>Phrases</button>
          <button className={`ac-tab ${tab === "themes" ? "ac-tab-active" : ""}`} onClick={() => setTab("themes")}>Themes</button>
        </div>
        <button className="ow-copy-btn" onClick={handleCopy} title="Copy phrases">
          {copied ? <CheckIcon size={13} style={{ color: "#22c55e" }} /> : <Copy size={13} />}
        </button>
      </div>
      {tab === "phrases" ? (
        <div className="ac-bar-list" style={{ marginTop: 8 }}>
          {phrases.map((p) => (
            <div key={p.text} className="ac-bar-row">
              <span className="ac-bar-label">{p.text}</span>
              <div className="ac-bar-track"><div className="ac-bar-fill" style={{ width: `${(p.count / max) * 100}%` }} /></div>
              <span className="ac-bar-count">{p.count}</span>
            </div>
          ))}
          {phrases.length === 0 && <p style={{ fontSize: 12, color: "#71717a" }}>No phrase data yet. Run your first AI scan to populate this.</p>}
        </div>
      ) : (
        <div style={{ padding: "16px 0", fontSize: 13, color: "#71717a", textAlign: "center" }}>
          Theme groupings will appear once enough scan data is collected.
        </div>
      )}
    </div>
  );
}

function TopDomainsPanel({ contentType, domainsMap }: { contentType: string; domainsMap: Record<string, Domain[]> }) {
  const [showAll, setShowAll] = useState(false);
  const domains = domainsMap[contentType] ?? [];
  const max = domains.length > 0 ? Math.max(...domains.map((d) => d.count)) : 1;
  const visible = showAll ? domains : domains.slice(0, 7);

  return (
    <div className="ow-panel">
      <div className="ow-panel-head" style={{ paddingBottom: 8 }}>
        <h4 className="ow-panel-title">
          Top Domains
          <Info size={12} style={{ marginLeft: 4, verticalAlign: "middle", color: "#a1a1aa" }} />
        </h4>
      </div>
      <div className="ac-bar-list">
        {visible.map((d) => (
          <div key={d.name} className="ac-bar-row">
            <span className="ac-bar-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={faviconUrl(d.name)} alt="" style={{ width: 11, height: 11, borderRadius: 2 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              {d.name}
            </span>
            <div className="ac-bar-track"><div className="ac-bar-fill" style={{ width: `${(d.count / max) * 100}%`, background: "#6366f1" }} /></div>
            <span className="ac-bar-count">{d.count}</span>
          </div>
        ))}
        {domains.length > 7 && (
          <button className="ac-show-all-btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show less" : `Show all (${domains.length})`}
          </button>
        )}
        {domains.length === 0 && <p style={{ fontSize: 12, color: "#71717a" }}>No domain data yet.</p>}
      </div>
    </div>
  );
}

function SourcesTable({ contentType, sourcesMap }: { contentType: string; sourcesMap: Record<string, Source[]> }) {
  const sourcesList = sourcesMap[contentType] ?? [];
  if (sourcesList.length === 0) return null;

  return (
    <div className="ac-section">
      <div className="ac-section-head">
        <h3 className="ac-section-title">Sources</h3>
      </div>
      <div className="ac-list">
        <div className="ow-sources-head">
          <span>URL</span><span>Mentioned</span><span>Mentions</span><span>Retrievals ↓</span><span>Citation rate</span>
        </div>
        {sourcesList.map((s, i) => (
          <div key={i} className="ow-sources-row">
            <div className="ac-list-text">
              <div style={{ fontWeight: 500, marginBottom: 2, color: "#18181b" }}>{s.title}</div>
              <div className="ac-list-url">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={faviconUrl(s.domain)} alt="" style={{ width: 11, height: 11, borderRadius: 2, flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                {s.url}
              </div>
            </div>
            <span className="ac-list-num">{s.mentioned}</span>
            <span className="ac-list-num">—</span>
            <span className="ac-list-num ac-list-num-bold">{s.retrievals}</span>
            <span className="ac-list-num">{s.citationRate.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function OwnedClient({
  initialActions,
  projectName: _projectName,
  phrasesMap = {},
  domainsMap = {},
  sourcesMap = {},
}: {
  initialActions: any[];
  projectName: string;
  phrasesMap?: Record<string, Phrase[]>;
  domainsMap?: Record<string, Domain[]>;
  sourcesMap?: Record<string, Source[]>;
}) {
  const seed = useMemo(
    () =>
      initialActions.map((a) => ({
        ...a,
        contentType: inferContentType(a),
        createdAt: new Date(a.createdAt),
        updatedAt: new Date(a.updatedAt),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [actions, setActions] = useState<OwnedAction[]>(seed);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "todo" | "done" | "declined">("all");

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus, updatedAt: new Date() } : a)));
    if (!id.startsWith("ow")) {
      await updateOwnedActionStatus(id, newStatus);
    }
  };

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of actions) {
      const t = a.contentType ?? "Other";
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [actions]);

  const filtered = useMemo(() => {
    return actions.filter((a) => {
      if (statusFilter === "todo" && a.status !== "todo") return false;
      if (statusFilter === "done" && a.status !== "done") return false;
      if (statusFilter === "declined" && a.status !== "declined") return false;
      if (selectedType && a.contentType !== selectedType) return false;
      return true;
    });
  }, [actions, statusFilter, selectedType]);

  const stats = useMemo(
    () => ({
      total: actions.length,
      done: actions.filter((a) => a.status === "done").length,
      skipped: actions.filter((a) => a.status === "declined").length,
      todo: actions.filter((a) => a.status === "todo").length,
    }),
    [actions],
  );

  const isOverview = !selectedType;
  const goOverview = () => { setSelectedType(null); setStatusFilter("all"); };
  const selectType = (t: string) => { setSelectedType(t); setStatusFilter("all"); };

  return (
    <div className="ac-page">

      {/* Filter chips */}
      <div className="ac-filter-bar">
        <button className="ac-chip"><TagIcon size={13} /> All Tags <ChevronDown size={12} /></button>
        <button className="ac-chip"><Layers size={13} /> All Models <ChevronDown size={12} /></button>
      </div>

      <div className="ac-main">

        {/* Left sub-nav */}
        <aside className="ac-subnav">
          <div className="ac-subnav-header">
            <Crosshair size={14} /> Owned
          </div>

          <button className={`ac-subnav-item ${isOverview ? "ac-subnav-item-active" : ""}`} onClick={goOverview}>
            <span>Overview</span>
          </button>

          {typeCounts.length > 0 && (
            <>
              <div className="ac-subnav-section-label">
                Owned <Info size={11} style={{ marginLeft: 3, color: "#c4c4cc" }} />
              </div>
              {typeCounts.map(([type, count]) => {
                const meta = TYPE_META[type] ?? TYPE_META["Other"];
                return (
                  <button
                    key={type}
                    className={`ac-subnav-item ${selectedType === type ? "ac-subnav-item-active" : ""}`}
                    onClick={() => selectType(type)}
                  >
                    <span className="ac-subnav-item-content">
                      <span className="ac-signal-bars ac-signal-bars--sm">
                        <span style={{ height: 3 }} />
                        <span style={{ height: 6 }} />
                        <span style={{ height: 9 }} />
                      </span>
                      <span className="ac-subnav-label">{type}</span>
                    </span>
                    <span className="ac-subnav-count">{count}</span>
                  </button>
                );
              })}
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
            {selectedType && (
              <>
                <span className="ac-breadcrumb-sep">/</span>
                <span className="ac-breadcrumb-part">Owned</span>
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

            {/* About link in detail view */}
            {selectedType && (
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
                <button className="ac-about-link">
                  <ExternalLink size={12} style={{ marginRight: 4 }} />
                  About {selectedType}s
                </button>
              </span>
            )}
          </div>

          {/* Heading */}
          <div className="ac-content-heading">
            <p className="ac-content-eyebrow">{selectedType ? "Owned" : "Overview"}</p>
            <h1 className="ac-content-title">
              {selectedType
                ? selectedType
                : "Address all suggestions and fill gaps in your owned content"}
            </h1>
          </div>

          {/* Stats (overview only, when there is data) */}
          {isOverview && actions.length > 0 && (
            <div className="ac-metrics">
              <div className="ac-metric">
                <span className="ac-metric-label">All owned actions</span>
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
          {actions.length === 0 ? (
            <div className="ac-empty">
              <div className="ac-empty-icon"><Zap size={20} /></div>
              <h2 className="ac-empty-title">No owned recommendations yet</h2>
              <p className="ac-empty-sub">
                Run AI scans on your prompts to generate on-page recommendations.
              </p>
              <div className="ac-empty-actions">
                <Link href="/prompts" className="ac-empty-btn ac-empty-btn-primary">Go to Prompts</Link>
              </div>
            </div>
          ) : (
            <div className="ac-recs">
              <div className="ac-recs-head">
                <div>
                  <h2 className="ac-recs-title">All recommendations</h2>
                  <p className="ac-recs-sub">Act on these suggestions to increase your AI search visibility.</p>
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
                {filtered.length === 0 && <div className="ac-empty-inline">No actions match this filter.</div>}
              </div>
            </div>
          )}

          {/* Phrases + Domains two-column (type detail only) */}
          {selectedType && (
            <div className="ow-analytics-grid">
              <PhrasesPanel contentType={selectedType} phrasesMap={phrasesMap} />
              <TopDomainsPanel contentType={selectedType} domainsMap={domainsMap} />
            </div>
          )}

          {/* Sources table (type detail only) */}
          {selectedType && (
            <SourcesTable contentType={selectedType} sourcesMap={sourcesMap} />
          )}

        </section>
      </div>
    </div>
  );
}
