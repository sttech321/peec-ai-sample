"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Check, X, Square, ChevronDown, Tag as TagIcon,
  Layers, Info, TrendingUp, BarChart2, ExternalLink, Zap, Copy,
  RefreshCw, Play, AlertCircle,
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
interface Phrase { text: string; count: number; }
interface Domain { name: string; count: number; }
interface SourceRow {
  title: string;
  url: string;
  domain: string;
  retrievals: number;
  citationRate: number;
  mentions: number;
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

// ── Animated Counter ──────────────────────────────────────────────────────────

function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) return;
    const duration = 400;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(step);
      else prevRef.current = end;
    };
    requestAnimationFrame(step);
  }, [value]);

  return <>{display}</>;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SignalBars({ score }: { score: number }) {
  return (
    <span className="ac-signal-bars">
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
      <SignalBars score={score} />
      {score} {priority}
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
        <ScorePill priority={action.priority} />
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
      {/* 3 buttons only — Done / Decline / Todo */}
      <div className="ac-card-actions">
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
        <button
          className={`ac-action-btn ac-action-btn-todo ${action.status === "todo" ? "ac-action-btn-active" : ""}`}
          onClick={() => onUpdate(action.id, "todo")}
        >
          <Square size={12} /> Todo
        </button>
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

function SourcesTable({ rows, label }: { rows: SourceRow[]; label?: string }) {
  const isDomain = label && label.includes(".");
  const aboutHref = isDomain ? `https://${label}` : undefined;

  return (
    <div className="ac-section">
      <div className="ac-section-head">
        <h3 className="ac-section-title">Sources</h3>
        <span className="ac-section-note">Not mentioning your brand</span>
        {label && (
          <a
            href={aboutHref ?? "#"}
            target={aboutHref ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="ac-about-link"
          >
            <ExternalLink size={12} />
            About {label}
          </a>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="ac-empty-inline">No scan data yet. Sources will appear after your first AI scan.</p>
      ) : (
        <div className="ac-list">
          <div className="ac-list-head ac-list-head-earned">
            <span>URL</span>
            <span>Retrievals ↓</span>
            <span>Mentions</span>
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
              <span className="ac-list-num">{s.mentions}</span>
              <span className="ac-list-num">{s.citationRate.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
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
          {copied ? <Check size={13} style={{ color: "#22c55e" }} /> : <Copy size={13} />}
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

// ── Smart Empty State ─────────────────────────────────────────────────────────

function EmptyState({
  sourcesCount,
  promptCount,
}: {
  sourcesCount: number;
  promptCount: number;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/actions/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed. Please try again.");
        return;
      }
      if (data.alreadyGenerated) {
        router.refresh();
        return;
      }
      setDone(true);
      setTimeout(() => router.refresh(), 800);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [router]);

  if (promptCount === 0) {
    return (
      <div className="ac-empty">
        <div className="ac-empty-icon"><Zap size={20} /></div>
        <h2 className="ac-empty-title">Set up prompts first</h2>
        <p className="ac-empty-sub">
          Add AI prompts so the system can scan ChatGPT, Claude, Perplexity, and Gemini for brand mentions and citation gaps.
        </p>
        <div className="ac-empty-actions">
          <Link href="/setup" className="ac-empty-btn ac-empty-btn-primary">Run Setup Wizard</Link>
          <Link href="/prompts" className="ac-empty-btn">Go to Prompts</Link>
        </div>
      </div>
    );
  }

  if (sourcesCount === 0) {
    return (
      <div className="ac-empty">
        <div className="ac-empty-icon"><Play size={20} /></div>
        <h2 className="ac-empty-title">Run AI scans first</h2>
        <p className="ac-empty-sub">
          You have {promptCount} prompt{promptCount !== 1 ? "s" : ""} ready. Run your first AI scan to fetch responses from ChatGPT, Claude, Gemini, and Perplexity.
        </p>
        <div className="ac-empty-actions">
          <Link href="/prompts" className="ac-empty-btn ac-empty-btn-primary">
            <Play size={13} /> Go to Prompts &amp; Scan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-empty">
      <div className="ac-empty-icon" style={{ background: done ? "#ecfdf5" : undefined, color: done ? "#047857" : undefined }}>
        {done ? <Check size={20} /> : <RefreshCw size={20} className={generating ? "ac-spin" : ""} />}
      </div>
      <h2 className="ac-empty-title">
        {done ? "Recommendations generated!" : "Generate earned recommendations"}
      </h2>
      <p className="ac-empty-sub">
        {done
          ? "Reloading your recommendations…"
          : `${sourcesCount} citation source${sourcesCount !== 1 ? "s" : ""} found. Analyze competitor gaps and generate GEO action recommendations.`}
      </p>
      {error && (
        <div className="ac-error-banner">
          <AlertCircle size={13} />
          {error}
        </div>
      )}
      {!done && (
        <div className="ac-empty-actions">
          <button
            className="ac-empty-btn ac-empty-btn-primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <><RefreshCw size={13} className="ac-spin" /> Generating…</>
            ) : (
              <><Zap size={13} /> Generate Recommendations</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  active,
  onClick,
  accent,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
  accent?: string;
}) {
  return (
    <div
      className={`ac-metric${active ? " ac-metric-active" : ""}${onClick ? " ac-metric-clickable" : ""}`}
      onClick={onClick}
      style={active && accent ? { borderColor: accent, background: "#fafafa" } : undefined}
    >
      <span className="ac-metric-label">{label}</span>
      <span className="ac-metric-value" style={active && accent ? { color: accent } : undefined}>
        <AnimatedCount value={value} />
      </span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function EarnedClient({
  initialActions,
  projectName: _projectName,
  sourcesMap,
  channelsMap,
  phrasesMap = {},
  domainsMap = {},
  sourcesCount = 0,
  promptCount = 0,
  lastScanDate = null,
}: {
  initialActions: any[];
  projectName: string;
  sourcesMap: Record<string, SourceRow[]>;
  channelsMap: Record<string, ChannelRow[]>;
  phrasesMap?: Record<string, Phrase[]>;
  domainsMap?: Record<string, Domain[]>;
  sourcesCount?: number;
  promptCount?: number;
  lastScanDate?: string | null;
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
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus, updatedAt: new Date() } : a)),
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
      if (priorityFilter && a.priority !== priorityFilter) return false;
      if (selectedDomain && a.sourceDomain !== selectedDomain) return false;
      if (selectedType && a.type !== selectedType) return false;
      return true;
    });
  }, [actions, statusFilter, priorityFilter, selectedDomain, selectedType]);

  const stats = useMemo(
    () => ({
      total: actions.length,
      done: actions.filter((a) => a.status === "done").length,
      skipped: actions.filter((a) => a.status === "declined").length,
      todo: actions.filter((a) => a.status === "todo").length,
      high: actions.filter((a) => a.priority === "High").length,
      medium: actions.filter((a) => a.priority === "Medium").length,
      low: actions.filter((a) => a.priority === "Low").length,
    }),
    [actions],
  );

  const isOverview = !selectedDomain && !selectedType;

  const selectDomain = (d: string) => { setSelectedDomain(d); setSelectedType(null); setStatusFilter("all"); setPriorityFilter(null); };
  const selectType = (t: string) => { setSelectedType(t); setSelectedDomain(null); setStatusFilter("all"); setPriorityFilter(null); };
  const goOverview = () => { setSelectedDomain(null); setSelectedType(null); setStatusFilter("all"); setPriorityFilter(null); };

  const handleStatClick = (filter: typeof statusFilter | null, priority?: string) => {
    goOverview();
    if (priority) {
      setPriorityFilter((prev) => prev === priority ? null : priority);
    } else if (filter) {
      setStatusFilter((prev) => prev === filter ? "all" : filter);
    }
  };

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
                {lastScanDate && (
                  <p style={{ fontSize: 12, color: "#a1a1aa", marginTop: 4 }}>
                    Data from:{" "}
                    {new Date(lastScanDate).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}{" "}
                    scan
                  </p>
                )}
              </>
            )}
          </div>

          {/* Stats row (overview only, when there is data) */}
          {isOverview && actions.length > 0 && (
            <div className="ac-metrics ac-metrics-expanded">
              <StatCard
                label="All earned actions"
                value={stats.total}
                active={!statusFilter || statusFilter === "all"}
                onClick={() => handleStatClick("all")}
              />
              <StatCard
                label="Todo actions"
                value={stats.todo}
                active={statusFilter === "todo" && !priorityFilter}
                accent="#2563eb"
                onClick={() => handleStatClick("todo")}
              />
              <StatCard
                label="Done actions"
                value={stats.done}
                active={statusFilter === "done" && !priorityFilter}
                accent="#047857"
                onClick={() => handleStatClick("done")}
              />
              <StatCard
                label="Skipped actions"
                value={stats.skipped}
                active={statusFilter === "declined" && !priorityFilter}
                accent="#b91c1c"
                onClick={() => handleStatClick("declined")}
              />
              <StatCard
                label="High priority"
                value={stats.high}
                active={priorityFilter === "High"}
                accent="#16a34a"
                onClick={() => handleStatClick(null, "High")}
              />
              <StatCard
                label="Medium priority"
                value={stats.medium}
                active={priorityFilter === "Medium"}
                accent="#ca8a04"
                onClick={() => handleStatClick(null, "Medium")}
              />
              <StatCard
                label="Low priority"
                value={stats.low}
                active={priorityFilter === "Low"}
                accent="#71717a"
                onClick={() => handleStatClick(null, "Low")}
              />
            </div>
          )}

          {/* Recommendations */}
          {actions.length === 0 ? (
            <EmptyState sourcesCount={sourcesCount} promptCount={promptCount} />
          ) : (
            <div className="ac-recs">
              <div className="ac-recs-head">
                <div>
                  <h2 className="ac-recs-title">All recommendations</h2>
                  <p className="ac-recs-sub">
                    Act on these suggestions to increase your AI search visibility.
                  </p>
                </div>
                <div className="ac-recs-head-right">
                  {priorityFilter && (
                    <button
                      className="ac-filter-active-chip"
                      onClick={() => setPriorityFilter(null)}
                    >
                      {priorityFilter} priority <X size={11} />
                    </button>
                  )}
                  <div className="ac-status-toggle">
                    {(["all", "todo", "done", "declined"] as const).map((f) => (
                      <button
                        key={f}
                        className={`ac-status-btn ${statusFilter === f && !priorityFilter ? "ac-status-btn-active" : ""}`}
                        onClick={() => { setStatusFilter(f); setPriorityFilter(null); }}
                      >
                        {f === "declined" ? "Skipped" : f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`ac-cards ${!isOverview ? "ac-cards-detail" : ""}`}>
                {filtered.map((action) => (
                  <ActionCard key={action.id} action={action} onUpdate={handleStatusUpdate} />
                ))}
                {filtered.length === 0 && (
                  <div className="ac-empty-inline">No actions match this filter.</div>
                )}
              </div>
            </div>
          )}

          {/* Top Channels (domain detail only) */}
          {selectedDomain && (
            <TopChannelsChart
              domain={selectedDomain}
              channels={channelsMap[selectedDomain] ?? []}
            />
          )}

          {/* Phrases + Top Domains (editorial type detail only) */}
          {selectedType && (
            <div className="ow-analytics-grid">
              <PhrasesPanel contentType={selectedType} phrasesMap={phrasesMap} />
              <TopDomainsPanel contentType={selectedType} domainsMap={domainsMap} />
            </div>
          )}

          {/* Sources table (domain or type detail) */}
          {selectedDomain && (
            <SourcesTable rows={sourcesMap[selectedDomain] ?? []} label={selectedDomain} />
          )}
          {selectedType && (
            <SourcesTable
              rows={sourcesMap[selectedType] ?? sourcesMap["Editorial"] ?? []}
              label={selectedType}
            />
          )}

        </section>
      </div>
    </div>
  );
}
