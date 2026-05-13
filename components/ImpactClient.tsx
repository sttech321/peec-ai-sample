"use client";

import { useMemo, useState } from "react";
import { Check, X, History, BarChart3 } from "lucide-react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImpactRow {
  id: string;
  kind: "earned" | "owned";
  title: string;
  description: string;
  sourceUrl: string | null;
  status: string;
  group: "UGC" | "Editorial" | "Owned";
  type: string;
  priority: string;
  updatedAt: string;
}

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ROWS: ImpactRow[] = [
  {
    id: "imp1", kind: "earned",
    title: "What are some trusted legit A+ social media marketing agencies?",
    description: "Get your brand mentioned in [What are some trusted legit A+ social media marketing agencies?]. Or look out for similar content and join those conversations early.",
    sourceUrl: "https://www.reddit.com/r/socialmedia/",
    status: "todo", group: "UGC", type: "reddit.com", priority: "High",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "imp2", kind: "earned",
    title: "The 10 Best Visibility Companies and Agencies for SEO and GEO?",
    description: "Get your brand mentioned in [The 10 Best Visibility Companies and Agencies for SEO and GEO?]. Or look out for similar content and join those conversations early.",
    sourceUrl: "https://www.reddit.com/r/b2bmarketing/",
    status: "todo", group: "UGC", type: "reddit.com", priority: "Medium",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "imp3", kind: "earned",
    title: "Best SEO Agencies 2026",
    description: "Get featured in [Best SEO Agencies 2026]. Their listicles are regularly cited by LLMs.",
    sourceUrl: "https://eubusinessnews.com/best-seo-agencies-2026",
    status: "todo", group: "Editorial", type: "Listicle", priority: "Medium",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "imp4", kind: "earned",
    title: "r/b2bmarketing",
    description: "Participate in [r/b2bmarketing] and mention your own brand favorably.",
    sourceUrl: "https://www.reddit.com/r/b2bmarketing/",
    status: "todo", group: "UGC", type: "reddit.com", priority: "Medium",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "imp5", kind: "owned",
    title: "Top U.S. Digital Marketing Agencies In 2026",
    description: "Create content similar to [Top U.S. Digital Marketing Agencies In 2026] on disruptiveadvertising.com and other top-performing listicles.",
    sourceUrl: "https://disruptiveadvertising.com/marketing/top-us-digital-marketing-agencies/",
    status: "todo", group: "Owned", type: "Listicle", priority: "High",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "imp6", kind: "owned",
    title: "Digital marketing agency",
    description: "Incorporate 'Digital marketing agency' and other common phrases into the copy of your homepage.",
    sourceUrl: null,
    status: "todo", group: "Owned", type: "Homepage", priority: "Medium",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "imp7", kind: "earned",
    title: "What are some AI SEO agencies? - Quora",
    description: "Get your brand mentioned in answers to [What are some AI SEO agencies? - Quora]. Or look out for similar questions and answer them early.",
    sourceUrl: "https://www.quora.com/What-are-some-AI-SEO-agencies",
    status: "todo", group: "UGC", type: "quora.com", priority: "Low",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "imp8", kind: "earned",
    title: "Best US-Based SEO Firms for Cleaning Services",
    description: "Get your brand mentioned in [Best US-Based SEO Firms for Cleaning Services].",
    sourceUrl: "https://medium.com/",
    status: "todo", group: "UGC", type: "medium.com", priority: "Low",
    updatedAt: new Date().toISOString(),
  },
];

// ── Styles maps ──────────────────────────────────────────────────────────────

const GROUP_STYLE: Record<string, { bg: string; text: string }> = {
  UGC:       { bg: "#ecfeff", text: "#0e7490" },
  Editorial: { bg: "#f5f3ff", text: "#6d28d9" },
  Owned:     { bg: "#fef3c7", text: "#92400e" },
};

const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  "reddit.com":   { bg: "#fff7ed", text: "#c2410c" },
  "linkedin.com": { bg: "#eff6ff", text: "#1d4ed8" },
  "g2.com":       { bg: "#fef2f2", text: "#b91c1c" },
  "quora.com":    { bg: "#fef2f2", text: "#b91c1c" },
  "medium.com":   { bg: "#f4f4f5", text: "#3f3f46" },
  "youtube.com":  { bg: "#fef2f2", text: "#b91c1c" },
  "Listicle":     { bg: "#ecfeff", text: "#0e7490" },
  "Article":      { bg: "#f5f3ff", text: "#6d28d9" },
  "Homepage":     { bg: "#fff7ed", text: "#c2410c" },
  "Product Page": { bg: "#fffbeb", text: "#a16207" },
};

function faviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function GroupBadge({ group }: { group: ImpactRow["group"] }) {
  const s = GROUP_STYLE[group] ?? { bg: "#f4f4f5", text: "#3f3f46" };
  return (
    <span className="ac-platform-badge" style={{ background: s.bg, color: s.text }}>
      {group}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const s = TYPE_STYLE[type] ?? { bg: "#f4f4f5", text: "#3f3f46" };
  const isDomain = type.includes(".");
  return (
    <span className="ac-platform-badge" style={{ background: s.bg, color: s.text }}>
      {isDomain && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={faviconUrl(type)} alt=""
          className="ac-badge-favicon"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      )}
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "done") {
    return (
      <span className="imp-status-badge imp-status-done">
        <Check size={11} /> Done
      </span>
    );
  }
  return (
    <span className="imp-status-badge imp-status-declined">
      <X size={11} /> Declined
    </span>
  );
}

function DescriptionCell({ row }: { row: ImpactRow }) {
  const linkMatch = row.description.match(/\[([^\]]+)\]/);
  const linkText = linkMatch ? linkMatch[1] : null;
  const before = linkText ? row.description.split(`[${linkText}]`)[0] : row.description;
  const after = linkText ? (row.description.split(`[${linkText}]`)[1] ?? "") : "";

  return (
    <div className="ac-list-text">
      {linkText && row.sourceUrl ? (
        <>
          {before}
          <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">{linkText}</a>
          {after}
        </>
      ) : (
        row.description
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ImpactClient({
  initialRows,
  updateStatusAction,
}: {
  initialRows: ImpactRow[];
  updateStatusAction: (args: {
    id: string;
    kind: "earned" | "owned";
    status: "done" | "declined" | "todo";
  }) => Promise<void>;
}) {
  const seed = useMemo(
    () => (initialRows.length > 0 ? initialRows : MOCK_ROWS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [rows, setRows] = useState<ImpactRow[]>(seed);
  const [tab, setTab] = useState<"todo" | "history">("todo");

  const handleUpdate = async (
    row: ImpactRow,
    status: "done" | "declined" | "todo",
  ) => {
    setRows((curr) =>
      curr.map((r) => (r.id === row.id ? { ...r, status, updatedAt: new Date().toISOString() } : r)),
    );
    if (!row.id.startsWith("imp")) {
      await updateStatusAction({ id: row.id, kind: row.kind, status });
    }
  };

  const todoRows = useMemo(() => rows.filter((r) => r.status === "todo"), [rows]);
  const historyRows = useMemo(
    () =>
      rows
        .filter((r) => r.status !== "todo")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [rows],
  );

  const renderTodoRow = (r: ImpactRow) => (
    <div key={r.id} className="imp-row">
      <DescriptionCell row={r} />
      <div><GroupBadge group={r.group} /></div>
      <div><TypeBadge type={r.type} /></div>
      <div className="imp-row-actions">
        <button
          className="ac-icon-btn-sm ac-icon-btn-sm-danger"
          title="Decline"
          onClick={() => handleUpdate(r, "declined")}
        >
          <X size={14} />
        </button>
        <button
          className="ac-icon-btn-sm ac-icon-btn-sm-success"
          title="Mark done"
          onClick={() => handleUpdate(r, "done")}
        >
          <Check size={14} />
        </button>
      </div>
    </div>
  );

  const renderHistoryRow = (r: ImpactRow) => (
    <div key={r.id} className="imp-row">
      <DescriptionCell row={r} />
      <div><GroupBadge group={r.group} /></div>
      <div><TypeBadge type={r.type} /></div>
      <div className="imp-row-actions">
        <StatusBadge status={r.status} />
        <button
          className="ac-icon-btn-sm"
          title="Move back to Todo"
          style={{ marginLeft: 6 }}
          onClick={() => handleUpdate(r, "todo")}
        >
          <History size={13} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="ac-page">

      {/* Breadcrumb */}
      <div className="ac-breadcrumb">
        <span className="ac-breadcrumb-part">Actions</span>
        <span className="ac-breadcrumb-sep">/</span>
        <span className="ac-breadcrumb-current">Impact</span>
      </div>

      {/* Tabs */}
      <div className="imp-tabs">
        <button
          className={`imp-tab ${tab === "todo" ? "imp-tab-active" : ""}`}
          onClick={() => setTab("todo")}
        >
          Todo
          {todoRows.length > 0 && (
            <span className="imp-tab-count">{todoRows.length}</span>
          )}
        </button>
        <button
          className={`imp-tab ${tab === "history" ? "imp-tab-active" : ""}`}
          onClick={() => setTab("history")}
        >
          History
        </button>
      </div>

      {tab === "todo" ? (
        todoRows.length === 0 ? (
          <div className="ac-empty">
            <div className="ac-empty-icon">
              <BarChart3 size={20} />
            </div>
            <h2 className="ac-empty-title">No pending actions. Great work! 🎉</h2>
            <p className="ac-empty-sub">
              You're all caught up. New recommendations will appear here as we
              analyze your brand against AI search results.
            </p>
            <div className="ac-empty-actions">
              <Link href="/earned" className="ac-empty-btn">Earned</Link>
              <Link href="/owned" className="ac-empty-btn ac-empty-btn-primary">Owned</Link>
            </div>
          </div>
        ) : (
          <div className="imp-table">
            <div className="imp-head">
              <span>Recommended action</span>
              <span>Group</span>
              <span>Type</span>
              <span style={{ textAlign: "right" }}>Action</span>
            </div>
            {todoRows.map(renderTodoRow)}
          </div>
        )
      ) : (
        historyRows.length === 0 ? (
          <div className="ac-empty">
            <div className="ac-empty-icon">
              <History size={20} />
            </div>
            <h2 className="ac-empty-title">No history yet.</h2>
            <p className="ac-empty-sub">
              Mark actions as Done or Declined from the Todo tab to track your progress here.
            </p>
            <div className="ac-empty-actions">
              <Link href="/owned" className="ac-empty-btn">Owned</Link>
              <Link href="/earned" className="ac-empty-btn ac-empty-btn-primary">Earned</Link>
            </div>
          </div>
        ) : (
          <div className="imp-table">
            <div className="imp-head">
              <span>Recommended action</span>
              <span>Group</span>
              <span>Type</span>
              <span style={{ textAlign: "right" }}>Status</span>
            </div>
            {historyRows.map(renderHistoryRow)}
          </div>
        )
      )}
    </div>
  );
}
