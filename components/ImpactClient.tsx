"use client";

import React, { useMemo, useState } from "react";
import { Check, FileText, History, X } from "lucide-react";
import Link from "next/link";

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

function GroupPill({ group }: { group: ImpactRow["group"] }) {
  const cls =
    group === "UGC"
      ? "ac-pill-group-ugc"
      : group === "Editorial"
      ? "ac-pill-group-editorial"
      : "ac-pill-group-owned";
  return <span className={`ac-pill ${cls}`}>{group}</span>;
}

function TypePill({ type }: { type: string }) {
  return <span className="ac-pill ac-pill-source">{type}</span>;
}

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
  const [rows, setRows] = useState<ImpactRow[]>(initialRows);
  const [tab, setTab] = useState<"todo" | "history">("todo");

  const handleUpdate = async (
    row: ImpactRow,
    status: "done" | "declined" | "todo",
  ) => {
    setRows((curr) =>
      curr.map((r) => (r.id === row.id ? { ...r, status } : r)),
    );
    await updateStatusAction({ id: row.id, kind: row.kind, status });
  };

  const todoRows = useMemo(
    () => rows.filter((r) => r.status === "todo"),
    [rows],
  );
  const historyRows = useMemo(
    () =>
      rows
        .filter((r) => r.status !== "todo")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [rows],
  );

  const renderRow = (r: ImpactRow) => (
    <div key={r.id} className="ac-list-row">
      <div className="ac-list-text">
        {r.sourceUrl ? (
          <>
            {r.description.split(r.title)[0]}
            <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
              {r.title}
            </a>
            {r.description.includes(r.title)
              ? r.description.split(r.title).slice(1).join(r.title)
              : ` — ${r.description}`}
          </>
        ) : (
          r.description
        )}
      </div>
      <div>
        <GroupPill group={r.group} />
      </div>
      <div>
        <TypePill type={r.type} />
      </div>
      <div className="ac-list-actions">
        {tab === "todo" ? (
          <>
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
          </>
        ) : (
          <button
            className="ac-icon-btn-sm"
            title="Move back to Todo"
            onClick={() => handleUpdate(r, "todo")}
          >
            <History size={14} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="ac-page">
      {/* Breadcrumb */}
      <div className="ac-breadcrumb">
        <FileText size={14} />
        <span>Actions</span>
        <span className="ac-breadcrumb-sep">›</span>
        <span className="ac-breadcrumb-current">Impact</span>
      </div>

      {/* Tabs */}
      <div className="ac-tabs">
        <button
          className={`ac-tab ${tab === "todo" ? "ac-tab-active" : ""}`}
          onClick={() => setTab("todo")}
        >
          Todo
        </button>
        <button
          className={`ac-tab ${tab === "history" ? "ac-tab-active" : ""}`}
          onClick={() => setTab("history")}
        >
          History
        </button>
      </div>

      {tab === "todo" ? (
        todoRows.length === 0 ? (
          <div className="ac-empty">
            <div className="ac-empty-icon">
              <FileText size={20} />
            </div>
            <h2 className="ac-empty-title">No actions to do</h2>
            <p className="ac-empty-sub">
              You're all caught up. New recommendations will appear here as we
              analyze your brand against AI search results.
            </p>
            <div className="ac-empty-actions">
              <Link href="/earned" className="ac-empty-tab-btn">
                Earned
              </Link>
              <Link
                href="/owned"
                className="ac-empty-tab-btn ac-empty-tab-btn-primary"
              >
                Owned
              </Link>
            </div>
          </div>
        ) : (
          <div className="ac-list">
            <div className="ac-list-head">
              <span>Recommended action</span>
              <span>Group</span>
              <span>Type</span>
              <span style={{ textAlign: "right" }}>Action</span>
            </div>
            {todoRows.map(renderRow)}
          </div>
        )
      ) : historyRows.length === 0 ? (
        <div className="ac-empty">
          <div className="ac-empty-icon">
            <History size={20} />
          </div>
          <h2 className="ac-empty-title">No action history yet</h2>
          <p className="ac-empty-sub">
            Start by reviewing tasks on the Owned or Earned pages and mark them
            as done or declined to see them here.
          </p>
          <div className="ac-empty-actions">
            <Link href="/owned" className="ac-empty-tab-btn">
              Owned
            </Link>
            <Link
              href="/earned"
              className="ac-empty-tab-btn ac-empty-tab-btn-primary"
            >
              Earned
            </Link>
          </div>
        </div>
      ) : (
        <div className="ac-list">
          <div className="ac-list-head">
            <span>Recommended action</span>
            <span>Group</span>
            <span>Type</span>
            <span style={{ textAlign: "right" }}>Action</span>
          </div>
          {historyRows.map(renderRow)}
        </div>
      )}
    </div>
  );
}
