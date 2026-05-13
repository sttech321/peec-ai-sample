"use client";

import { useState, useMemo } from "react";
import {
  Check, X, Square, ChevronDown, Tag as TagIcon,
  Layers, FileText, Info, TrendingUp,
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

interface Channel { name: string; count: number; }
interface Source {
  title: string; url: string; domain: string;
  mentions: number | null; retrievals: number; citationRate: number;
}

// ── Mock data (used when DB has no records) ──────────────────────────────────

const MOCK_ACTIONS: EarnedAction[] = [
  {
    id: "m1", type: null, title: "Best digital marketing agency?",
    description: "Get your brand mentioned in [Best digital marketing agency?]. Or look out for similar content and join those conversations early.",
    priority: "Medium", status: "todo",
    sourceUrl: "https://www.reddit.com/r/LawFirm/",
    sourceDomain: "reddit.com", createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "m2", type: null, title: "r/b2bmarketing",
    description: "Participate in [r/b2bmarketing] and mention your own brand favorably.",
    priority: "Medium", status: "todo",
    sourceUrl: "https://www.reddit.com/r/b2bmarketing/",
    sourceDomain: "reddit.com", createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "m3", type: null, title: "Best saas seo",
    description: "Create posts around the topic 'Best saas seo' and mention your own brand favorably.",
    priority: "Medium", status: "todo",
    sourceUrl: null, sourceDomain: "reddit.com",
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "m4", type: "Listicle", title: "Best SEO Agencies 2026",
    description: "Get featured in [Best SEO Agencies 2026]. Their listicles are regularly cited by LLMs.",
    priority: "Medium", status: "todo",
    sourceUrl: "https://eubusinessnews.com/best-seo-agencies-2026",
    sourceDomain: null, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "m5", type: "Listicle", title: "Best SEO Agencies 2026",
    description: "Contact the author of [Best SEO Agencies 2026] on eubusinessnews.com to be included in their listicle.",
    priority: "Medium", status: "todo",
    sourceUrl: "https://eubusinessnews.com/best-seo-agencies-2026",
    sourceDomain: null, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "m6", type: null, title: "7 Best PPC Agencies for 2026",
    description: "Take inspiration from this review [7 Best PPC Agencies for 2026]. Create a similar review mentioning your brand.",
    priority: "Low", status: "todo",
    sourceUrl: "https://www.g2.com/",
    sourceDomain: "g2.com", createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "m7", type: null, title: "Ppc agencies 2026 top picks",
    description: "Create reviews around the topic 'Ppc agencies 2026 top picks' and mention your own brand favorably.",
    priority: "Low", status: "todo",
    sourceUrl: null, sourceDomain: "g2.com",
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "m8", type: null, title: "Best US-Based SEO Firms for Cleaning Services",
    description: "Get your brand mentioned in [Best US-Based SEO Firms for Cleaning Services].",
    priority: "Low", status: "todo",
    sourceUrl: "https://medium.com/",
    sourceDomain: "medium.com", createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "m9", type: null, title: "@stoufferak on Medium",
    description: "Contact @stoufferak on Medium and ask them to mention your brand favorably in their articles.",
    priority: "Low", status: "todo",
    sourceUrl: "https://medium.com/@stoufferak",
    sourceDomain: "medium.com", createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "m10", type: null, title: "What are some AI SEO agencies? - Quora",
    description: "Get your brand mentioned in answers to [What are some AI SEO agencies? - Quora]. Or look out for similar questions and answer them early.",
    priority: "Low", status: "todo",
    sourceUrl: "https://www.quora.com/",
    sourceDomain: "quora.com", createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "m11", type: null, title: "Top 10 Enterprise SEO Companies",
    description: "Take inspiration from [Top 10 Enterprise SEO Companies]. Can you create similar content on linkedin.com?",
    priority: "Low", status: "todo",
    sourceUrl: "https://www.linkedin.com/",
    sourceDomain: "linkedin.com", createdAt: new Date(), updatedAt: new Date(),
  },
];

// ── Static analytics data ────────────────────────────────────────────────────

const TOP_CHANNELS: Record<string, Channel[]> = {
  "reddit.com": [
    { name: "r/b2bmarketing", count: 6 },
    { name: "r/SaaS", count: 5 },
    { name: "r/LawFirm", count: 4 },
    { name: "r/DigitalMarketing", count: 3 },
    { name: "r/growmybusiness", count: 3 },
    { name: "r/SocialMediaMarketing", count: 3 },
    { name: "r/AISEOTricks", count: 2 },
  ],
  "linkedin.com": [
    { name: "Digital Marketing", count: 3 },
    { name: "SEO Professionals", count: 2 },
    { name: "B2B Growth", count: 2 },
    { name: "Agency Leaders", count: 1 },
  ],
  "youtube.com": [
    { name: "SEO Tips & Tricks", count: 4 },
    { name: "Marketing Agencies", count: 3 },
    { name: "Digital Marketing", count: 2 },
  ],
};

const SOURCES_DATA: Record<string, Source[]> = {
  "reddit.com": [
    { title: "The 10 Best Visibility Companies and Agencies for SEO and GEO?", url: "reddit.com/r/b2bmarketing/...", domain: "reddit.com", mentions: null, retrievals: 4, citationRate: 0.8 },
    { title: "Best digital marketing agency?", url: "reddit.com/r/LawFirm/...", domain: "reddit.com", mentions: null, retrievals: 4, citationRate: 2.0 },
    { title: "Who are the top SEO agencies right now that actually deliver results...", url: "reddit.com/r/growmybusiness/...", domain: "reddit.com", mentions: null, retrievals: 3, citationRate: 1.0 },
    { title: "Can anyone recommend marketing agencies or SaaS with expertise...", url: "reddit.com/r/DigitalMarketing/...", domain: "reddit.com", mentions: null, retrievals: 3, citationRate: 0.7 },
  ],
  "linkedin.com": [
    { title: "Top 10 Enterprise SEO Companies", url: "linkedin.com/posts/...", domain: "linkedin.com", mentions: null, retrievals: 2, citationRate: 1.0 },
    { title: "Top Website Design Services That Will Generate Leads For You (202...", url: "linkedin.com/pulse/...", domain: "linkedin.com", mentions: null, retrievals: 1, citationRate: 0.0 },
    { title: "Top 15 PPC Companies: Clutch Global Spring 2025", url: "linkedin.com/pulse/...", domain: "linkedin.com", mentions: null, retrievals: 1, citationRate: 0.0 },
    { title: "AI Optimization Agencies: Who Can Rank Your Brand on ChatGPT a...", url: "linkedin.com/pulse/...", domain: "linkedin.com", mentions: null, retrievals: 1, citationRate: 0.0 },
    { title: "Top Amazon Agencies With the Team Depth to Handle 2026 Market...", url: "linkedin.com/pulse/...", domain: "linkedin.com", mentions: null, retrievals: 1, citationRate: 0.0 },
    { title: "Best 6 Digital Marketing Agencies for Startups [UPDATED 2025]", url: "linkedin.com/pulse/...", domain: "linkedin.com", mentions: null, retrievals: 1, citationRate: 2.0 },
  ],
  "g2.com": [
    { title: "7 Best PPC Agencies for 2026", url: "g2.com/categories/ppc/...", domain: "g2.com", mentions: null, retrievals: 3, citationRate: 0.8 },
    { title: "Best SEO Software in 2026", url: "g2.com/categories/seo/...", domain: "g2.com", mentions: null, retrievals: 2, citationRate: 0.5 },
  ],
  "quora.com": [
    { title: "What are some AI SEO agencies? - Quora", url: "quora.com/What-are-some-AI-SEO-agencies", domain: "quora.com", mentions: null, retrievals: 3, citationRate: 1.0 },
    { title: "Best digital marketing agencies for B2B SaaS?", url: "quora.com/...", domain: "quora.com", mentions: null, retrievals: 2, citationRate: 0.5 },
  ],
  "medium.com": [
    { title: "Best US-Based SEO Firms for Cleaning Services", url: "medium.com/@stoufferak/...", domain: "medium.com", mentions: null, retrievals: 2, citationRate: 0.5 },
    { title: "Top Digital Marketing Agencies to Watch in 2026", url: "medium.com/...", domain: "medium.com", mentions: null, retrievals: 1, citationRate: 0.0 },
  ],
  "Listicle": [
    { title: "Best SEO Agencies 2026", url: "eubusinessnews.com/best-seo-agencies-2026", domain: "eubusinessnews.com", mentions: null, retrievals: 5, citationRate: 1.2 },
    { title: "Top U.S. Digital Marketing Agencies In 2026", url: "disruptiveadvertising.com/...", domain: "disruptiveadvertising.com", mentions: null, retrievals: 4, citationRate: 0.8 },
    { title: "The 18 Best SEO Companies + Services of 2025", url: "searchbloom.com/...", domain: "searchbloom.com", mentions: null, retrievals: 3, citationRate: 0.5 },
  ],
  "Article": [
    { title: "How AI is Changing SEO: What Agencies Need to Know", url: "searchengineland.com/...", domain: "searchengineland.com", mentions: null, retrievals: 3, citationRate: 0.7 },
    { title: "The Future of Brand Visibility in AI Search", url: "moz.com/blog/...", domain: "moz.com", mentions: null, retrievals: 2, citationRate: 0.5 },
  ],
};

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
    const isContent = ["listicle", "article"].includes(type.toLowerCase());
    return (
      <span
        className="ac-platform-badge"
        style={{ background: isContent ? "#ecfeff" : "#f5f3ff", color: isContent ? "#0e7490" : "#6d28d9" }}
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

function TopChannelsChart({ domain }: { domain: string }) {
  const [showAll, setShowAll] = useState(false);
  const channels = TOP_CHANNELS[domain] ?? [];
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

function SourcesTable({ dataKey }: { dataKey: string }) {
  const sources = SOURCES_DATA[dataKey] ?? [];
  if (sources.length === 0) return null;

  return (
    <div className="ac-section">
      <div className="ac-section-head">
        <h3 className="ac-section-title">Sources</h3>
        <span className="ac-section-note">Not mentioning your brand</span>
      </div>
      <div className="ac-list">
        <div className="ac-list-head ac-list-head-earned">
          <span>URL</span>
          <span>Mentions</span>
          <span>Retrievals ↓</span>
          <span>Citation rate</span>
        </div>
        {sources.map((s, i) => (
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
            <span className="ac-list-num">{s.mentions ?? "—"}</span>
            <span className="ac-list-num ac-list-num-bold">{s.retrievals}</span>
            <span className="ac-list-num">{s.citationRate.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function EarnedClient({
  initialActions,
  projectName: _projectName,
}: {
  initialActions: any[];
  projectName: string;
}) {
  const seed = useMemo(
    () =>
      initialActions.length > 0
        ? initialActions.map((a) => ({
            ...a,
            createdAt: new Date(a.createdAt),
            updatedAt: new Date(a.updatedAt),
          }))
        : MOCK_ACTIONS,
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

  const { ugcDomains, editorialTypes } = useMemo(() => {
    const ugc = new Map<string, number>();
    const ed = new Map<string, number>();
    for (const a of actions) {
      if (a.sourceDomain) {
        ugc.set(a.sourceDomain, (ugc.get(a.sourceDomain) ?? 0) + 1);
      } else if (a.type) {
        ed.set(a.type, (ed.get(a.type) ?? 0) + 1);
      }
    }
    return {
      ugcDomains: Array.from(ugc.entries()).sort((a, b) => b[1] - a[1]),
      editorialTypes: Array.from(ed.entries()).sort((a, b) => b[1] - a[1]),
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
        </aside>

        {/* Main content */}
        <section className="ac-content">

          {/* Breadcrumb */}
          <div className="ac-breadcrumb">
            <button className="ac-breadcrumb-link" onClick={goOverview}>Actions</button>
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
              <h1 className="ac-content-title">
                Address all suggestions and fill gaps in your earned content
              </h1>
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
          {selectedDomain && <TopChannelsChart domain={selectedDomain} />}

          {/* Sources table (domain or type detail) */}
          {selectedDomain && <SourcesTable dataKey={selectedDomain} />}
          {selectedType && <SourcesTable dataKey={selectedType} />}

        </section>
      </div>
    </div>
  );
}
