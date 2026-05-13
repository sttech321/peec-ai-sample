"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  Layers,
  Tag as TagIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { updateOwnedActionStatus } from "../app/owned/actions";

// ── Types ───────────────────────────────────────────────────────────────────
interface OwnedAction {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  pageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PAGE_TYPES: { label: string; match: RegExp }[] = [
  { label: "Listicle", match: /listicle|top\s+\d|best\s+\w+\s+for/i },
  { label: "Product Page", match: /product\s+page|product/i },
  { label: "Homepage", match: /homepage|home\s+page|landing/i },
  { label: "Article", match: /article|blog\s+post|post/i },
  { label: "How-To Guide", match: /how[\s-]to|guide|tutorial/i },
  { label: "Category Page", match: /category\s+page|category/i },
  { label: "Comparison", match: /comparison|vs\.|versus/i },
];

function inferPageType(action: OwnedAction): string {
  const text = `${action.title} ${action.description}`;
  for (const { label, match } of PAGE_TYPES) {
    if (match.test(text)) return label;
  }
  return "Other";
}

function PriorityPill({ priority }: { priority: string }) {
  const cls =
    priority === "High"
      ? "ac-pill-priority-high"
      : priority === "Medium"
      ? "ac-pill-priority-medium"
      : "ac-pill-priority-low";
  return (
    <span className={`ac-pill ${cls}`}>
      <span className="ac-pill-bars">
        <span style={{ height: 4 }} />
        <span style={{ height: 7 }} />
        <span style={{ height: 10 }} />
      </span>
      {priority}
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  const t = type.toLowerCase();
  const cls = t.includes("listicle")
    ? "ac-pill-type-listicle"
    : t.includes("article")
    ? "ac-pill-type-article"
    : t.includes("comparison")
    ? "ac-pill-type-comparison"
    : "ac-pill-type-default";
  return (
    <span className={`ac-pill ${cls}`}>
      <span className="ac-pill-dot" />
      {type}
    </span>
  );
}

function ActionCard({
  action,
  pageType,
  onUpdate,
}: {
  action: OwnedAction;
  pageType: string;
  onUpdate: (id: string, status: string) => void;
}) {
  return (
    <div className="ac-card">
      <div className="ac-card-meta">
        <PriorityPill priority={action.priority} />
        <TypePill type={pageType} />
      </div>
      <div className="ac-card-body">
        {action.pageUrl ? (
          <>
            {action.description.split(action.title)[0]}
            <a href={action.pageUrl} target="_blank" rel="noopener noreferrer">
              {action.title}
            </a>
            {action.description.includes(action.title)
              ? action.description.split(action.title).slice(1).join(action.title)
              : ` — ${action.description}`}
          </>
        ) : (
          action.description
        )}
      </div>
      <div className="ac-card-actions">
        <div className="ac-card-actions-left">
          <button
            className={`ac-action-btn ac-action-btn-done ${action.status === "done" ? "ac-action-btn-active" : ""}`}
            onClick={() => onUpdate(action.id, "done")}
          >
            <Check size={12} />
            Done
          </button>
          <button
            className={`ac-action-btn ac-action-btn-decline ${action.status === "declined" ? "ac-action-btn-active" : ""}`}
            onClick={() => onUpdate(action.id, "declined")}
          >
            <X size={12} />
            Decline
          </button>
        </div>
        <button
          className={`ac-action-btn ac-action-btn-todo ${action.status === "todo" ? "ac-action-btn-active" : ""}`}
          onClick={() => onUpdate(action.id, "todo")}
        >
          <ClipboardList size={12} />
          Todo
        </button>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function OwnedClient({
  initialActions,
  projectName: _projectName,
}: {
  initialActions: any[];
  projectName: string;
}) {
  const [actions, setActions] = useState<OwnedAction[]>(
    initialActions.map((a) => ({
      ...a,
      createdAt: new Date(a.createdAt),
      updatedAt: new Date(a.updatedAt),
    })),
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "todo" | "done">(
    "all",
  );
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)),
    );
    await updateOwnedActionStatus(id, newStatus);
  };

  // Compute page type per action once
  const pageTypeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of actions) map.set(a.id, inferPageType(a));
    return map;
  }, [actions]);

  // Aggregate types for the sub-nav
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of actions) {
      const t = pageTypeById.get(a.id) ?? "Other";
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [actions, pageTypeById]);

  const filtered = useMemo(() => {
    return actions.filter((a) => {
      if (statusFilter === "todo" && a.status !== "todo") return false;
      if (statusFilter === "done" && a.status !== "done") return false;
      if (selectedType && pageTypeById.get(a.id) !== selectedType) return false;
      return true;
    });
  }, [actions, statusFilter, selectedType, pageTypeById]);

  const stats = useMemo(
    () => ({
      total: actions.length,
      done: actions.filter((a) => a.status === "done").length,
      skipped: actions.filter((a) => a.status === "declined").length,
      todo: actions.filter((a) => a.status === "todo").length,
    }),
    [actions],
  );

  if (actions.length === 0) {
    return (
      <div className="ac-page">
        <div className="ac-breadcrumb">
          <FileText size={14} />
          <span className="ac-breadcrumb-current">Actions</span>
        </div>
        <div className="ac-empty">
          <div className="ac-empty-icon">
            <FileText size={20} />
          </div>
          <h2 className="ac-empty-title">No owned actions yet</h2>
          <p className="ac-empty-sub">
            On-page suggestions appear once we've analyzed your site against AI
            search results. Add competitors and prompts to receive
            recommendations.
          </p>
          <div className="ac-empty-actions">
            <Link href="/brands" className="ac-empty-btn">
              Manage brands
            </Link>
            <Link href="/prompts" className="ac-empty-btn ac-empty-btn-primary">
              View prompts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isOverview = !selectedType;

  return (
    <div className="ac-page">
      <div className="ac-breadcrumb">
        <FileText size={14} />
        <span className="ac-breadcrumb-current">Actions</span>
      </div>

      <div className="ac-filter-bar">
        <button className="ac-chip">
          <TagIcon size={13} />
          All Tags
          <ChevronDown size={12} />
        </button>
        <button className="ac-chip">
          <Layers size={13} />
          All Models
          <ChevronDown size={12} />
        </button>
      </div>

      <div className="ac-main">
        <aside className="ac-subnav">
          <div className="ac-subnav-header">
            <FileText size={14} />
            Owned
          </div>
          <button
            className={`ac-subnav-item ${isOverview ? "ac-subnav-item-active" : ""}`}
            onClick={() => setSelectedType(null)}
          >
            <span>Overview</span>
          </button>

          {typeCounts.length > 0 && (
            <>
              <div className="ac-subnav-section-label">Owned</div>
              {typeCounts.map(([type, count]) => (
                <button
                  key={type}
                  className={`ac-subnav-item ${selectedType === type ? "ac-subnav-item-active" : ""}`}
                  onClick={() => setSelectedType(type)}
                >
                  <span className="ac-subnav-item-content">
                    <span className="ac-subnav-bars">
                      <span style={{ height: 4 }} />
                      <span style={{ height: 7 }} />
                      <span style={{ height: 10 }} />
                    </span>
                    {type}
                  </span>
                  <span className="ac-metric-label">{count}</span>
                </button>
              ))}
            </>
          )}
        </aside>

        <section className="ac-content">
          <div>
            <p className="ac-content-eyebrow">
              {selectedType || "Overview"}
            </p>
            <h1 className="ac-content-title">
              {selectedType
                ? `${selectedType} suggestions`
                : "Address all suggestions and fill gaps in your owned content"}
            </h1>
          </div>

          {isOverview && (
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

          <div className="ac-recs">
            <div className="ac-recs-head">
              <div>
                <h2 className="ac-recs-title">All recommendations</h2>
                <p className="ac-recs-sub">
                  Act on these suggestions to increase your AI search visibility.
                </p>
              </div>
              <div className="ac-status-toggle">
                <button
                  className={`ac-status-btn ${statusFilter === "all" ? "ac-status-btn-active" : ""}`}
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </button>
                <button
                  className={`ac-status-btn ${statusFilter === "todo" ? "ac-status-btn-active" : ""}`}
                  onClick={() => setStatusFilter("todo")}
                >
                  Todo
                </button>
                <button
                  className={`ac-status-btn ${statusFilter === "done" ? "ac-status-btn-active" : ""}`}
                  onClick={() => setStatusFilter("done")}
                >
                  Done
                </button>
              </div>
            </div>

            <div className="ac-cards">
              {filtered.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  pageType={pageTypeById.get(action.id) ?? "Other"}
                  onUpdate={handleStatusUpdate}
                />
              ))}
              {filtered.length === 0 && (
                <div className="ac-empty" style={{ gridColumn: "1 / -1" }}>
                  <p className="ac-empty-sub">
                    No actions match this filter.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
