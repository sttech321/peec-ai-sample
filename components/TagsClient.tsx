"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, X, ChevronsUpDown } from "lucide-react";
import { createTag, updateTag, deleteTag, deleteInvalidTags } from "../app/tags/actions";

// ─── Tag color palette ───────────────────────────────────────────────────────
const COLOR_OPTIONS = [
  { label: "Gray",   value: "gray",   hex: "#6b7280" },
  { label: "Red",    value: "red",    hex: "#ef4444" },
  { label: "Orange", value: "orange", hex: "#f97316" },
  { label: "Amber",  value: "amber",  hex: "#f59e0b" },
  { label: "Green",  value: "green",  hex: "#10b981" },
  { label: "Teal",   value: "teal",   hex: "#14b8a6" },
  { label: "Blue",   value: "blue",   hex: "#3b82f6" },
  { label: "Indigo", value: "indigo", hex: "#6366f1" },
  { label: "Purple", value: "purple", hex: "#8b5cf6" },
  { label: "Pink",   value: "pink",   hex: "#ec4899" },
];

function colorOption(color: string) {
  return COLOR_OPTIONS.find((c) => c.value === color) ?? COLOR_OPTIONS[0];
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface TagRow {
  id: string;
  name: string;
  slug: string | null;
  color: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Tag badge chip ───────────────────────────────────────────────────────────
function TagChip({ name, color }: { name: string; color: string }) {
  const { hex } = colorOption(color);
  return (
    <span
      className="tc-tag-chip"
      style={{
        background: `${hex}1F`,
        color: hex,
      }}
    >
      {name}
    </span>
  );
}

// ─── Color select (dropdown) ─────────────────────────────────────────────────
function ColorSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = colorOption(value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="tc-select" ref={ref}>
      <button
        type="button"
        className="tc-select-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="tc-select-value">
          <span
            className="tc-select-dot"
            style={{ background: current.hex }}
          />
          {current.label}
        </span>
        <ChevronsUpDown size={14} className="tc-select-caret" />
      </button>
      {open && (
        <div className="tc-select-menu">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`tc-select-option ${
                value === c.value ? "tc-select-option-active" : ""
              }`}
              onClick={() => {
                onChange(c.value);
                setOpen(false);
              }}
            >
              <span
                className="tc-select-dot"
                style={{ background: c.hex }}
              />
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function TagsClient({
  initialTags,
  projectId,
  workspaceId,
}: {
  initialTags: TagRow[];
  projectId: string;
  workspaceId: string;
}) {
  const [tagList, setTagList] = useState<TagRow[]>(initialTags);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<TagRow | null>(null);

  // form state
  const [fName, setFName] = useState("");
  const [fColor, setFColor] = useState("green");

  const filtered = useMemo(
    () =>
      tagList.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [tagList, search],
  );

  const openCreate = () => {
    setFName("");
    setFColor("green");
    setEditTarget(null);
    setModal("create");
  };

  const openEdit = (tag: TagRow) => {
    setFName(tag.name);
    setFColor(tag.color);
    setEditTarget(tag);
    setModal("edit");
  };

  const closeModal = () => {
    setModal(null);
    setEditTarget(null);
  };

  const doCreate = async () => {
    if (!fName.trim()) return;
    const tmp: TagRow = {
      id: crypto.randomUUID(),
      name: fName.trim(),
      slug: null,
      color: fColor,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setTagList((p) => [...p, tmp]);
    closeModal();
    await createTag({
      projectId,
      workspaceId,
      name: tmp.name,
      color: fColor,
    });
  };

  const doUpdate = async () => {
    if (!editTarget || !fName.trim()) return;
    const patch = { name: fName.trim(), color: fColor };
    setTagList((p) =>
      p.map((t) => (t.id === editTarget.id ? { ...t, ...patch } : t)),
    );
    closeModal();
    await updateTag(editTarget.id, patch);
  };

  const doDelete = async (id: string) => {
    setTagList((p) => p.filter((t) => t.id !== id));
    await deleteTag(id);
  };

  const [cleaning, setCleaning] = useState(false);
  const doCleanup = async () => {
    if (!window.confirm("Delete all invalid tags (IDs, questions, long phrases)?")) return;
    setCleaning(true);
    const result = await deleteInvalidTags();
    setTagList((p) => p.filter((t) => {
      if (/^pr_[a-f0-9-]{8,}$/i.test(t.name)) return false;
      if (/[?!]/.test(t.name)) return false;
      if (t.name.length > 50) return false;
      if ((t.name.match(/\s+/g) ?? []).length > 4) return false;
      return true;
    }));
    setCleaning(false);
    alert(`Cleaned up ${result.deleted} invalid tags.`);
  };

  const isEdit = modal === "edit";

  return (
    <div className="tc-page">
      {/* Header */}
      <div className="tc-topbar">
        <h1 className="tc-title">Tags</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="tc-btn-add"
            onClick={doCleanup}
            disabled={cleaning}
            style={{ background: "#ef4444", color: "#fff" }}
          >
            {cleaning ? "Cleaning…" : "Clean up invalid tags"}
          </button>
          <button className="tc-btn-add" onClick={openCreate}>
            <Plus size={14} strokeWidth={2.5} /> Create Tag
          </button>
        </div>
      </div>

      {/* Search + count */}
      <div className="tc-toolbar">
        <div className="tc-search-wrap">
          <Search size={13} className="tc-search-icon" />
          <input
            className="tc-search-input"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="tc-count">
          Your tags <span className="tc-count-num">{tagList.length}</span>
        </div>
      </div>

      {/* List */}
      <div className="tc-list">
        <div className="tc-list-head">Tags</div>
        {filtered.length === 0 ? (
          <div className="tc-empty">
            <p className="tc-empty-p">
              {tagList.length === 0
                ? "No tags yet — create one to organize your prompts."
                : "No tags match your search."}
            </p>
          </div>
        ) : (
          filtered.map((tag) => (
            <div key={tag.id} className="tc-row">
              <TagChip name={tag.name} color={tag.color} />
              <div className="tc-row-actions">
                <button
                  className="tc-row-edit"
                  onClick={() => openEdit(tag)}
                >
                  Edit
                </button>
                <button
                  className="tc-row-delete"
                  onClick={() => doDelete(tag.id)}
                  title="Delete tag"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="tc-modal-overlay" onClick={closeModal}>
          <div
            className="tc-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tc-modal-header">
              <div className="tc-modal-heading">
                <h2 className="tc-modal-title">
                  {isEdit ? "Edit Tag" : "Create Tag"}
                </h2>
                <p className="tc-modal-sub">
                  Tags help you filter, search, and group related prompts together and stay organized.
                </p>
              </div>
              <button className="tc-modal-close" onClick={closeModal}>
                <X size={17} />
              </button>
            </div>

            <div className="tc-modal-body">
              <div className="tc-field">
                <label className="tc-label">Name</label>
                <input
                  autoFocus
                  className="tc-input"
                  placeholder="Tag, category, or label name"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (isEdit ? doUpdate : doCreate)();
                    if (e.key === "Escape") closeModal();
                  }}
                />
              </div>

              <div className="tc-field">
                <label className="tc-label">Color</label>
                <ColorSelect value={fColor} onChange={setFColor} />
              </div>
            </div>

            <div className="tc-modal-footer">
              <button className="tc-btn-cancel" onClick={closeModal}>
                Cancel
              </button>
              <button
                className="tc-btn-create"
                onClick={isEdit ? doUpdate : doCreate}
                disabled={!fName.trim()}
              >
                {isEdit ? "Save" : "Create Tag"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
