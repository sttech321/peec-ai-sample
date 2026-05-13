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
import { updateActionStatus } from "../app/earned/actions";

// ── Types ───────────────────────────────────────────────────────────────────
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

const UGC_DOMAINS = [
  "reddit.com",
  "linkedin.com",
  "g2.com",
  "quora.com",
  "medium.com",
  "youtube.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
];

const EDITORIAL_TYPES = ["Listicle", "Article", "Comparison", "Review", "Guide"];

function classify(action: EarnedAction): "ugc" | "editorial" {
  const t = (action.type || "").toLowerCase();
  const d = (action.sourceDomain || "").toLowerCase();
  if (UGC_DOMAINS.some((u) => d.includes(u.replace(".com", "")))) return "ugc";
  if (
    ["reddit", "forum", "youtube", "quora", "medium", "linkedin"].some((kw) =>
      t.includes(kw),
    )
  )
    return "ugc";
  return "editorial";
}

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
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

function SourcePill({
  domain,
  type,
}: {
  domain: string | null;
  type: string | null;
}) {
  if (domain) {
    return (
      <span className="ac-pill ac-pill-source">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={faviconUrl(domain)}
          alt={domain}
          className="ac-pill-favicon"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        {domain}
      </span>
    );
  }
  if (type) {
    const tLower = type.toLowerCase();
    const cls = tLower.includes("listicle")
      ? "ac-pill-type-listicle"
      : tLower.includes("article")
      ? "ac-pill-type-article"
      : tLower.includes("comparison")
      ? "ac-pill-type-comparison"
      : "ac-pill-type-default";
    return (
      <span className={`ac-pill ${cls}`}>
        <span className="ac-pill-dot" />
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
  return (
    <div className="ac-card">
      <div className="ac-card-meta">
        <PriorityPill priority={action.priority} />
        <SourcePill domain={action.sourceDomain} type={action.type} />
      </div>
      <div className="ac-card-body">
        {action.sourceUrl ? (
          <>
            {action.description.split(action.title)[0]}
            <a href={action.sourceUrl} target="_blank" rel="noopener noreferrer">
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
export default function EarnedClient({
  initialActions,
  projectName: _projectName,
}: {
  initialActions: any[];
  projectName: string;
}) {
  const [actions, setActions] = useState<EarnedAction[]>(
    initialActions.map((a) => ({
      ...a,
      createdAt: new Date(a.createdAt),
      updatedAt: new Date(a.updatedAt),
    })),
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "todo" | "done">(
    "all",
  );
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)),
    );
    await updateActionStatus(id, newStatus);
  };

  // Group sub-nav by classification
  const { ugcDomains, editorialTypes } = useMemo(() => {
    const ugc = new Map<string, number>();
    const ed = new Map<string, number>();
    for (const a of actions) {
      if (classify(a) === "ugc" && a.sourceDomain) {
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
          <h2 className="ac-empty-title">No earned actions yet</h2>
          <p className="ac-empty-sub">
            Actions surface as we analyze AI search results for your brand. Add
            more competitors and prompts to start receiving recommendations.
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

  const isOverview = !selectedDomain && !selectedType;

  return (
    <div className="ac-page">
      {/* Breadcrumb */}
      <div className="ac-breadcrumb">
        <FileText size={14} />
        <span className="ac-breadcrumb-current">Actions</span>
      </div>

      {/* Filter bar */}
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
        {/* Sub-nav */}
        <aside className="ac-subnav">
          <div className="ac-subnav-header">
            <FileText size={14} />
            Earned
          </div>
          <button
            className={`ac-subnav-item ${isOverview ? "ac-subnav-item-active" : ""}`}
            onClick={() => {
              setSelectedDomain(null);
              setSelectedType(null);
            }}
          >
            <span>Overview</span>
          </button>

          {ugcDomains.length > 0 && (
            <>
              <div className="ac-subnav-section-label">UGC</div>
              {ugcDomains.map(([domain, count]) => (
                <button
                  key={domain}
                  className={`ac-subnav-item ${selectedDomain === domain ? "ac-subnav-item-active" : ""}`}
                  onClick={() => {
                    setSelectedDomain(domain);
                    setSelectedType(null);
                  }}
                >
                  <span className="ac-subnav-item-content">
                    <span className="ac-subnav-bars">
                      <span style={{ height: 4 }} />
                      <span style={{ height: 7 }} />
                      <span style={{ height: 10 }} />
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={faviconUrl(domain)}
                      alt={domain}
                      className="ac-subnav-favicon"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />
                    {domain}
                  </span>
                  <span className="ac-metric-label">{count}</span>
                </button>
              ))}
            </>
          )}

          {editorialTypes.length > 0 && (
            <>
              <div className="ac-subnav-section-label">Editorial</div>
              {editorialTypes.map(([type, count]) => (
                <button
                  key={type}
                  className={`ac-subnav-item ${selectedType === type ? "ac-subnav-item-active" : ""}`}
                  onClick={() => {
                    setSelectedType(type);
                    setSelectedDomain(null);
                  }}
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

        {/* Content */}
        <section className="ac-content">
          <div>
            <p className="ac-content-eyebrow">
              {selectedDomain || selectedType || "Overview"}
            </p>
            <h1 className="ac-content-title">
              {selectedDomain
                ? `Actions for ${selectedDomain}`
                : selectedType
                ? `${selectedType} suggestions`
                : "Address all suggestions and fill gaps in your earned content"}
            </h1>
          </div>

          {/* Metric tiles */}
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
