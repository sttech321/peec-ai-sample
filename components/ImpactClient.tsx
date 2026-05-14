"use client";

import { useMemo, useState } from "react";
import { Check, X, History, BarChart3, BarChart2 } from "lucide-react";
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

function timeAgo(date: string): string {
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
  const score = scoreFromPriority(row.priority);

  return (
    <div className="ac-list-text">
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <ScoreBadge score={score} />
      </div>
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
    () => initialRows,
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
        <span className="ac-card-date" style={{ marginLeft: 4 }}>{timeAgo(r.updatedAt)}</span>
        <button
          className="ac-icon-btn-sm"
          title="Move back to Todo"
          style={{ marginLeft: 2 }}
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
        <span className="ac-breadcrumb-part" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <BarChart2 size={13} style={{ color: "#71717a" }} />
          Actions
        </span>
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
