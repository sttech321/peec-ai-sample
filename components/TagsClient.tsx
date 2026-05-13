"use client";

import { useState, useMemo } from "react";
import { Search, Plus, MoreHorizontal, X, Tag } from "lucide-react";
import { createTag, updateTag, deleteTag } from "../app/tags/actions";

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

function hexForColor(color: string): string {
  return COLOR_OPTIONS.find((c) => c.value === color)?.hex ?? "#6b7280";
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface TagRow {
  id: string;
  name: string;
  slug: string | null;
  color: string;
  category: string | null;
  description: string | null;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Tag badge chip ───────────────────────────────────────────────────────────
function TagChip({ name, color }: { name: string; color: string }) {
  const hex = hexForColor(color);
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 9px", borderRadius: 6,
        fontSize: 12, fontWeight: 500,
        background: `${hex}18`, color: hex,
        border: `1px solid ${hex}30`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: hex, flexShrink: 0 }} />
      {name}
    </span>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function TagsClient({
  initialTags, projectId, workspaceId,
}: {
  initialTags: TagRow[];
  projectId: string;
  workspaceId: string;
}) {
  const [tagList,   setTagList]   = useState<TagRow[]>(initialTags);
  const [search,    setSearch]    = useState("");
  const [openMenu,  setOpenMenu]  = useState<string | null>(null);
  const [modal,     setModal]     = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<TagRow | null>(null);

  // form state
  const [fName,  setFName]  = useState("");
  const [fColor, setFColor] = useState("gray");
  const [fCat,   setFCat]   = useState("");
  const [fDesc,  setFDesc]  = useState("");

  const filtered = useMemo(() =>
    tagList.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.category ?? "").toLowerCase().includes(search.toLowerCase())
    ), [tagList, search]);

  // ── open modals ──
  const openCreate = () => {
    setFName(""); setFColor("gray"); setFCat(""); setFDesc("");
    setEditTarget(null);
    setModal("create");
  };

  const openEdit = (tag: TagRow) => {
    setFName(tag.name); setFColor(tag.color);
    setFCat(tag.category ?? ""); setFDesc(tag.description ?? "");
    setEditTarget(tag);
    setModal("edit");
    setOpenMenu(null);
  };

  const closeModal = () => { setModal(null); setEditTarget(null); };

  // ── handlers ──
  const doCreate = async () => {
    if (!fName.trim()) return;
    const tmp: TagRow = {
      id: crypto.randomUUID(), name: fName.trim(), slug: null,
      color: fColor, category: fCat.trim() || null,
      description: fDesc.trim() || null, usageCount: 0,
      createdAt: new Date(), updatedAt: new Date(),
    };
    setTagList((p) => [...p, tmp]);
    closeModal();
    await createTag({ projectId, workspaceId, name: tmp.name, color: fColor, category: tmp.category ?? undefined, description: tmp.description ?? undefined });
  };

  const doUpdate = async () => {
    if (!editTarget || !fName.trim()) return;
    const patch = { name: fName.trim(), color: fColor, category: fCat.trim() || null, description: fDesc.trim() || null };
    setTagList((p) => p.map((t) => t.id === editTarget.id ? { ...t, ...patch } : t));
    closeModal();
    await updateTag(editTarget.id, { name: patch.name, color: patch.color, category: patch.category ?? undefined, description: patch.description ?? undefined });
  };

  const doDelete = async (id: string) => {
    setTagList((p) => p.filter((t) => t.id !== id));
    setOpenMenu(null);
    await deleteTag(id);
  };

  const isEdit = modal === "edit";

  // ── render ──
  return (
    <div className="tc-page" onClick={() => setOpenMenu(null)}>

      {/* Top bar */}
      <div className="tc-topbar">
        <h1 className="tc-title">Tags <span className="tc-title-count">· {tagList.length}</span></h1>
        <button className="tc-btn-add" onClick={openCreate}>
          <Plus size={14} strokeWidth={2.5} /> Create tag
        </button>
      </div>

      {/* Search */}
      <div className="tc-search-wrap">
        <Search size={13} className="tc-search-icon" />
        <input
          className="tc-search-input"
          placeholder="Search tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="tc-table-wrap">
        {tagList.length === 0 ? (
          <div className="tc-empty">
            <div className="tc-empty-icon"><Tag size={20} className="text-zinc-400" /></div>
            <h2 className="tc-empty-h">No tags yet</h2>
            <p className="tc-empty-p">Tags help you organize and filter your prompts by theme or campaign.</p>
            <button className="tc-btn-add" onClick={openCreate}><Plus size={14} /> Create tag</button>
          </div>
        ) : (
          <table className="tc-table">
            <thead>
              <tr>
                <th className="tc-th">Tag</th>
                <th className="tc-th">Category</th>
                <th className="tc-th">Description</th>
                <th className="tc-th tc-th--num">Prompts</th>
                <th className="tc-th" style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((tag) => (
                <tr key={tag.id} className="tc-row">
                  <td className="tc-td"><TagChip name={tag.name} color={tag.color} /></td>
                  <td className="tc-td tc-td--muted">{tag.category || "—"}</td>
                  <td className="tc-td tc-td--muted tc-td--desc">{tag.description || "—"}</td>
                  <td className="tc-td tc-td--num">{tag.usageCount}</td>
                  <td className="tc-td tc-td--actions">
                    <button
                      className="tc-more-btn"
                      onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === tag.id ? null : tag.id); }}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                    {openMenu === tag.id && (
                      <div className="tc-popover" onClick={(e) => e.stopPropagation()}>
                        <button className="tc-pop-item" onClick={() => openEdit(tag)}>Edit tag</button>
                        <button className="tc-pop-item tc-pop-item--danger" onClick={() => doDelete(tag.id)}>Delete tag</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="tc-modal-overlay" onClick={closeModal}>
          <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-header">
              <span className="tc-modal-title">{isEdit ? "Edit tag" : "Create tag"}</span>
              <button className="tc-modal-close" onClick={closeModal}><X size={17} /></button>
            </div>

            <div className="tc-modal-body">
              {/* Name */}
              <div className="tc-field">
                <label className="tc-label">Name</label>
                <input className="tc-input" placeholder="e.g. SEO Content"
                  value={fName} onChange={(e) => setFName(e.target.value)} />
              </div>

              {/* Color */}
              <div className="tc-field">
                <label className="tc-label">Color</label>
                <div className="tc-color-grid">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      title={c.label}
                      className={`tc-color-swatch${fColor === c.value ? " tc-color-swatch--active" : ""}`}
                      style={{ background: c.hex }}
                      onClick={() => setFColor(c.value)}
                    />
                  ))}
                </div>
                {/* Preview */}
                <div className="tc-color-preview">
                  <TagChip name={fName || "Preview"} color={fColor} />
                </div>
              </div>

              {/* Category */}
              <div className="tc-field">
                <label className="tc-label">Category <span className="tc-optional">(optional)</span></label>
                <input className="tc-input" placeholder="e.g. Campaign"
                  value={fCat} onChange={(e) => setFCat(e.target.value)} />
              </div>

              {/* Description */}
              <div className="tc-field">
                <label className="tc-label">Description <span className="tc-optional">(optional)</span></label>
                <textarea className="tc-textarea" placeholder="What is this tag used for?"
                  rows={3} value={fDesc} onChange={(e) => setFDesc(e.target.value)} />
              </div>
            </div>

            <div className="tc-modal-footer">
              <button className="tc-btn-cancel" onClick={closeModal}>Cancel</button>
              <button className="tc-btn-create" onClick={isEdit ? doUpdate : doCreate}>
                {isEdit ? "Save changes" : "Create tag"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
