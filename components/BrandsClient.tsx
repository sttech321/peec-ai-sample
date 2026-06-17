"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import BrandColorPicker from "./BrandColorPicker";
import { useRouter } from "next/navigation";
import {
  Search, Plus, MoreHorizontal, Check, X,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";
import {
  deleteBrand, acceptSuggestion, rejectSuggestion, createBrand,
} from "../app/brands/actions";
import { useBrandsModal } from "../lib/brands-modal-context";

// ─── Color palette (matches Peec AI brand colors) ──────────────────────────
const PALETTE = [
  "#f59e0b", "#3b82f6", "#eab308", "#f97316", "#ef4444",
  "#8b5cf6", "#10b981", "#06b6d4", "#ec4899", "#6366f1",
  "#84cc16", "#14b8a6", "#f43f5e", "#a855f7", "#0ea5e9",
  "#d97706", "#7c3aed", "#059669", "#dc2626", "#2563eb",
];

/** Stable color derived from a brand's UUID */
function colorFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h) + id.charCodeAt(i);
    h |= 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

// ─── Types ──────────────────────────────────────────────────────────────────
type SortField = "name" | "aliases" | "domains" | "mentions";
type SortDir   = "asc" | "desc";

interface Brand {
  id: string;
  name: string;
  isOwn?: boolean;
  color?: string | null;
  aliases: string[];
  domains: string[];
  mentions?: number;
}

interface Suggestion {
  id: string;
  name: string;
  domain?: string | null;
  mentions?: number;
}

interface Props {
  initialBrands: Brand[];
  initialSuggestions: Suggestion[];
  projectId: string;
  workspaceId: string;
  updateBrandColorAction?: (brandId: string, color: string) => Promise<{ ok: boolean; error?: string }>;
  renameBrandAction?: (args: { brandId: string; displayName: string }) => Promise<{ ok: boolean; error?: string }>;
  updateBrandAliasesAction?: (args: { brandId: string; aliases: string[] }) => Promise<{ ok: boolean; error?: string }>;
  updateBrandDomainsAction?: (args: { brandId: string; domains: string[] }) => Promise<{ ok: boolean; error?: string }>;
  reprocessAllBrandsAction?: () => Promise<{ ok: boolean; scanned: number; created: number; brandsProcessed: number; error?: string }>;
}

// ─── BrandAvatar ─────────────────────────────────────────────────────────────
// Tries to load the real favicon for `domain`; falls back to a colored-initial
// square if the domain is missing or the favicon fails to load.
function BrandAvatar({
  id, name, domain, size = 22,
}: {
  id: string;
  name: string;
  domain?: string | null;
  size?: number;
}) {
  const [err, setErr] = useState(false);
  const color = colorFromId(id);
  // Normalise domain: strip protocol/path so the favicon service gets just the hostname
  const host = domain ? domain.replace(/^https?:\/\//, "").split("/")[0] : null;
  const faviconSrc = host && !err
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
    : null;

  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, borderRadius: 6, flexShrink: 0,
        overflow: "hidden",
        background: faviconSrc ? "#f3f4f6" : color,
      }}
    >
      {faviconSrc ? (
        <img
          src={faviconSrc}
          alt=""
          width={size - 2}
          height={size - 2}
          style={{ objectFit: "contain", display: "block" }}
          onError={() => setErr(true)}
        />
      ) : (
        <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", letterSpacing: 0 }}>
          {initials(name)}
        </span>
      )}
    </span>
  );
}

// ─── SortIcon ────────────────────────────────────────────────────────────────
function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  const active = field === sortField;
  const Icon   = active && sortDir === "asc" ? ChevronUp : ChevronDown;
  return <Icon size={11} className={`bp-sort-icon${active ? " bp-sort-icon--active" : ""}`} />;
}

// ─── BrandRow ────────────────────────────────────────────────────────────────
function BrandRow({
  brand, openMenu, onMenu, onDelete, onColorDotClick,
  isNameEditing, isAliasEditing, isDomainEditing,
  onNameClick, onAliasClick, onDomainClick,
}: {
  brand: Brand;
  openMenu: string | null;
  onMenu: (id: string) => void;
  onDelete: (id: string) => void;
  onColorDotClick: (id: string, e: React.MouseEvent) => void;
  isNameEditing: boolean;
  isAliasEditing: boolean;
  isDomainEditing: boolean;
  onNameClick: (brand: Brand) => void;
  onAliasClick: (brand: Brand) => void;
  onDomainClick: (brand: Brand) => void;
}) {
  const paletteColor = colorFromId(brand.id);
  const color = brand.color ?? paletteColor;
  const isAnyEditing = isNameEditing || isAliasEditing || isDomainEditing;
  // Position for the delete popover, captured from the "more" button click so it
  // can be rendered in a fixed-position portal (escapes the table's overflow clip).
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const POP_W = 204;
    const top  = rect.bottom + 4;
    const left = Math.max(8, Math.min(rect.right - POP_W, window.innerWidth - POP_W - 8));
    setMenuPos({ top, left });
    onMenu(brand.id);
  };

  return (
    <tr className={`bp-row${isAnyEditing ? " bp-row--editing" : ""}`}>
      <td className="bp-td bp-td--color">
        <span
          className="brand-color-dot"
          style={{ background: color, width: 18, height: 18, borderRadius: "50%" }}
          title="Change brand color"
          onClick={e => onColorDotClick(brand.id, e)}
        />
      </td>
      <td className={`bp-td bp-td--name${isNameEditing ? " bp-td--active-edit" : ""}`}
        onClick={() => onNameClick(brand)} title="Click to edit display name">
        <div className="bp-name-cell">
          <BrandAvatar id={brand.id} name={brand.name} domain={brand.domains?.[0]} />
          <span className="bp-name-text">{brand.name}</span>
          {brand.isOwn && <span className="bp-badge-you">You</span>}
        </div>
      </td>
      <td className={`bp-td bp-td--muted bp-td--alias${isAliasEditing ? " bp-td--active-edit" : ""}`}
        onClick={() => onAliasClick(brand)} title="Click to edit tracked names">
        {brand.aliases?.join(", ") || "—"}
      </td>
      <td className={`bp-td bp-td--muted bp-td--alias${isDomainEditing ? " bp-td--active-edit" : ""}`}
        onClick={() => onDomainClick(brand)} title="Click to edit domains">
        {brand.domains?.join(", ") || "—"}
      </td>
      <td className="bp-td bp-td--num">{(brand.mentions ?? 0).toLocaleString()}</td>
      <td className="bp-td bp-td--actions">
        <button
          className="bp-more-btn"
          onClick={handleMenuClick}
        >
          <MoreHorizontal size={15} />
        </button>
        {openMenu === brand.id && menuPos && typeof document !== "undefined" &&
          ReactDOM.createPortal(
            <div
              className="bp-popover"
              style={{ position: "fixed", top: menuPos.top, left: menuPos.left, right: "auto", zIndex: 99999 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="bp-popover-text">
                Permanently delete this brand and all associated data.
              </p>
              <button className="bp-btn-delete" onClick={() => onDelete(brand.id)}>
                Delete brand
              </button>
            </div>,
            document.body
          )}
      </td>
    </tr>
  );
}

// ─── SuggestionCard ──────────────────────────────────────────────────────────
function SuggestionCard({ s, onAccept, onReject }: {
  s: Suggestion;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const domainHost = s.domain
    ? s.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
    : null;

  const hasMentions = (s.mentions ?? 0) > 0;

  return (
    <div
      className={`bp-sug-card ${hovered ? "bp-sug-card--hovered" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top row: mentions count + action buttons (visible on hover) */}
      <div className="bp-sug-top">
        <span className="bp-sug-mentions">
          {hasMentions
            ? `${(s.mentions ?? 0).toLocaleString()} mentions`
            : <span className="bp-sug-suggested-label">Suggested</span>
          }
        </span>
        <div className={`bp-sug-btns ${hovered ? "bp-sug-btns--visible" : ""}`}>
          <button
            className="bp-sug-btn bp-sug-btn--reject"
            title="Dismiss"
            onClick={(e) => { e.stopPropagation(); onReject(s.id); }}
          >
            <X size={12} />
          </button>
          <button
            className="bp-sug-btn bp-sug-btn--accept"
            title="Add brand"
            onClick={(e) => { e.stopPropagation(); onAccept(s.id); }}
          >
            <Check size={12} />
          </button>
        </div>
      </div>

      {/* Brand info row */}
      <div className="bp-sug-name-row">
        <BrandAvatar id={s.id} name={s.name} domain={s.domain} size={22} />
        <div className="bp-sug-info">
          <span className="bp-sug-name">{s.name}</span>
          {domainHost && (
            <a
              href={`https://${domainHost}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bp-sug-domain"
              onClick={(e) => e.stopPropagation()}
            >
              {domainHost}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Domain normalizer ────────────────────────────────────────────────────────
function normalizeDomain(raw: string): string {
  return raw.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function BrandsClient({
  initialBrands, initialSuggestions, projectId, workspaceId,
  updateBrandColorAction, renameBrandAction, updateBrandAliasesAction, updateBrandDomainsAction,
  reprocessAllBrandsAction,
}: Props) {
  const router = useRouter();

  const [brands,      setBrands]      = useState<Brand[]>(initialBrands);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions);
  const [search,      setSearch]      = useState("");
  const [openMenu,    setOpenMenu]    = useState<string | null>(null);
  const [pickerInfo, setPickerInfo] = useState<{ id: string; pos: { top: number; left: number } } | null>(null);

  // ── Re-process past chats state ───────────────────────────────────────────
  const [reprocessBusy,   setReprocessBusy]   = useState(false);
  const [reprocessResult, setReprocessResult] = useState<{ created: number; brandsProcessed: number } | null>(null);
  const [reprocessError,  setReprocessError]  = useState<string | null>(null);

  async function doReprocess() {
    if (reprocessBusy || !reprocessAllBrandsAction) return;
    setReprocessBusy(true);
    setReprocessResult(null);
    setReprocessError(null);
    const res = await reprocessAllBrandsAction();
    setReprocessBusy(false);
    if (res.ok) {
      setReprocessResult({ created: res.created, brandsProcessed: res.brandsProcessed });
      router.refresh();
    } else {
      setReprocessError(res.error ?? "Re-process failed");
    }
  }

  // ── Inline display-name edit state ───────────────────────────────────────
  const [editingBrandId,  setEditingBrandId]  = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBusy,        setEditBusy]        = useState(false);
  const [editError,       setEditError]       = useState<string | null>(null);
  const editCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editingBrandId) return;
    const handler = (e: MouseEvent) => {
      if (editCardRef.current && !editCardRef.current.contains(e.target as Node)) {
        setEditingBrandId(null); setEditError(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editingBrandId]);

  function startEdit(brand: Brand) {
    setEditingBrandId(brand.id);
    setEditDisplayName(brand.name);
    setEditError(null);
    setAliasEditId(null);          // close alias card if open
    setOpenMenu(null);
    setPickerInfo(null);
  }

  async function doRename() {
    if (!editingBrandId || !editDisplayName.trim() || editBusy) return;
    setEditBusy(true);
    setEditError(null);
    const res = await renameBrandAction?.({ brandId: editingBrandId, displayName: editDisplayName.trim() });
    setEditBusy(false);
    if (!res || res.ok) {
      setBrands(prev => prev.map(b => b.id === editingBrandId ? { ...b, name: editDisplayName.trim() } : b));
      setEditingBrandId(null);
      router.refresh();
    } else {
      setEditError(res.error ?? "Failed to rename");
    }
  }

  // ── Inline tracked-names (alias) edit state ───────────────────────────────
  const [aliasEditId,    setAliasEditId]    = useState<string | null>(null);
  const [editAliases,    setEditAliases]    = useState<string[]>([]);
  const [newAliasInput,  setNewAliasInput]  = useState("");
  const [useRegex,       setUseRegex]       = useState(false);
  const [aliasBusy,      setAliasBusy]      = useState(false);
  const [aliasError,     setAliasError]     = useState<string | null>(null);
  const [dragIdx,        setDragIdx]        = useState<number | null>(null);
  // Individual alias item inline rename
  const [editingAliasIdx,   setEditingAliasIdx]   = useState<number | null>(null);
  const [editingAliasValue, setEditingAliasValue] = useState("");
  const aliasCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Always reset inline item edit when alias card opens for a new brand
    setEditingAliasIdx(null);
    setEditingAliasValue("");
  }, [aliasEditId]);

  useEffect(() => {
    if (!aliasEditId) return;
    const handler = (e: MouseEvent) => {
      if (aliasCardRef.current && !aliasCardRef.current.contains(e.target as Node)) {
        setAliasEditId(null); setAliasError(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [aliasEditId]);

  function startAliasEdit(brand: Brand) {
    setAliasEditId(brand.id);
    setEditAliases([...brand.aliases]);
    setNewAliasInput("");
    setUseRegex(false);
    setAliasError(null);
    setEditingAliasIdx(null);    // reset inline item edit
    setEditingAliasValue("");
    setEditingBrandId(null);       // close display-name card if open
    setOpenMenu(null);
    setPickerInfo(null);
  }

  function addAlias() {
    const val = newAliasInput.trim();
    if (!val || editAliases.includes(val)) return;
    setEditAliases(prev => [...prev, val]);
    setNewAliasInput("");
  }

  function removeAlias(idx: number) {
    setEditAliases(prev => prev.filter((_, i) => i !== idx));
  }

  async function doSaveAliases() {
    if (!aliasEditId || aliasBusy) return;
    setAliasBusy(true);
    setAliasError(null);
    const res = await updateBrandAliasesAction?.({ brandId: aliasEditId, aliases: editAliases });
    setAliasBusy(false);
    if (!res || res.ok) {
      setBrands(prev => prev.map(b => b.id === aliasEditId ? { ...b, aliases: editAliases } : b));
      setAliasEditId(null);
      router.refresh();
    } else {
      setAliasError(res.error ?? "Failed to save");
    }
  }

  // ── Inline domain edit state ──────────────────────────────────────────────
  const [domainEditId,      setDomainEditId]      = useState<string | null>(null);
  const [editDomains,       setEditDomains]       = useState<string[]>([]);
  const [newDomainInput,    setNewDomainInput]    = useState("");
  const [domainBusy,        setDomainBusy]        = useState(false);
  const [domainError,       setDomainError]       = useState<string | null>(null);
  const [dragDomainIdx,     setDragDomainIdx]     = useState<number | null>(null);
  const [editingDomainIdx,  setEditingDomainIdx]  = useState<number | null>(null);
  const [editingDomainValue,setEditingDomainValue]= useState("");
  const domainCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!domainEditId) return;
    const handler = (e: MouseEvent) => {
      if (domainCardRef.current && !domainCardRef.current.contains(e.target as Node)) {
        setDomainEditId(null); setDomainError(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [domainEditId]);

  function startDomainEdit(brand: Brand) {
    setDomainEditId(brand.id);
    setEditDomains([...brand.domains]);
    setNewDomainInput("");
    setDomainError(null);
    setEditingDomainIdx(null);
    setEditingBrandId(null);
    setAliasEditId(null);
    setOpenMenu(null);
    setPickerInfo(null);
  }

  function addDomain() {
    const val = newDomainInput.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
    if (!val || editDomains.includes(val)) return;
    setEditDomains(prev => [...prev, val]);
    setNewDomainInput("");
  }

  function removeDomain(idx: number) {
    setEditDomains(prev => prev.filter((_, i) => i !== idx));
  }

  async function doSaveDomains() {
    if (!domainEditId || domainBusy) return;
    setDomainBusy(true);
    setDomainError(null);
    const res = await updateBrandDomainsAction?.({ brandId: domainEditId, domains: editDomains });
    setDomainBusy(false);
    if (!res || res.ok) {
      setBrands(prev => prev.map(b => b.id === domainEditId ? { ...b, domains: editDomains } : b));
      setDomainEditId(null);
      router.refresh();
    } else {
      setDomainError(res.error ?? "Failed to save");
    }
  }

  function openPickerAt(brandId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (pickerInfo?.id === brandId) { setPickerInfo(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const top  = window.innerHeight - rect.bottom > 300 ? rect.bottom + 8 : rect.top - 300;
    const left = Math.max(8, Math.min(rect.right + 8, window.innerWidth - 230));
    setPickerInfo({ id: brandId, pos: { top, left } });
  }
  const { isOpen: modal, open: openModal, close: closeModal } = useBrandsModal();

  const [sortField, setSortField] = useState<SortField>("mentions");
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");

  // modal form
  const [mName,    setMName]    = useState("");
  const [mAliases, setMAliases] = useState([""]);
  const [mDomains, setMDomains] = useState([""]);
  const [mIsOwn,   setMIsOwn]   = useState(false);
  const [mError,   setMError]   = useState("");

  // ── sort ──
  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(f); setSortDir(f === "mentions" ? "desc" : "asc"); }
  };

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = brands.filter((b) =>
      b.name.toLowerCase().includes(q) ||
      b.domains?.some((d) => d.toLowerCase().includes(q)) ||
      b.aliases?.some((a) => a.toLowerCase().includes(q))
    );
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name")    cmp = a.name.localeCompare(b.name);
      if (sortField === "aliases") cmp = (a.aliases?.[0] ?? "").localeCompare(b.aliases?.[0] ?? "");
      if (sortField === "domains") cmp = (a.domains?.[0] ?? "").localeCompare(b.domains?.[0] ?? "");
      if (sortField === "mentions") cmp = (a.mentions ?? 0) - (b.mentions ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [brands, search, sortField, sortDir]);

  // ── handlers ──
  const resetModal = () => {
    setMName(""); setMAliases([""]); setMDomains([""]); setMIsOwn(false); setMError("");
  };

  const doDelete = async (id: string) => {
    setBrands((p) => p.filter((b) => b.id !== id));
    setOpenMenu(null);
    await deleteBrand(id);
    router.refresh();
  };

  const doCreate = async () => {
    const trimmed = mName.trim();
    if (!trimmed) {
      setMError("Brand name is required.");
      return;
    }
    // Duplicate check
    if (brands.some((b) => b.name.toLowerCase() === trimmed.toLowerCase())) {
      setMError(`"${trimmed}" is already in your brand list.`);
      return;
    }
    const normalizedDomains = mDomains.map(normalizeDomain).filter(Boolean);
    const data = {
      projectId,
      workspaceId,
      name: trimmed,
      isOwn: mIsOwn,
      aliases: mAliases.map((a) => a.trim()).filter(Boolean),
      domains: normalizedDomains,
    };
    // Optimistic update
    setBrands((p) => [...p, { ...data, id: crypto.randomUUID(), mentions: 0 }]);
    closeModal();
    resetModal();
    await createBrand(data);
    router.refresh(); // sync real server-assigned UUID
  };

  const doAccept = async (id: string) => {
    const s = suggestions.find((x) => x.id === id);
    if (!s) return;
    setSuggestions((p) => p.filter((x) => x.id !== id));
    setBrands((p) => [...p, {
      id: crypto.randomUUID(), name: s.name, isOwn: false,
      aliases: [s.name], domains: s.domain ? [normalizeDomain(s.domain)] : [],
      mentions: s.mentions ?? 0,
    }]);
    await acceptSuggestion(id);
    router.refresh(); // sync real server-assigned UUID
  };

  const doReject = async (id: string) => {
    setSuggestions((p) => p.filter((x) => x.id !== id));
    await rejectSuggestion(id);
  };

  // ── render ──
  return (
    <div className="bp-page" onClick={() => setOpenMenu(null)}>

      {/* ── Top bar (full-width) ── */}
      <div className="bp-topbar">
        <h1 className="bp-title">Your brands <span className="bp-title-count">· {brands.length}</span></h1>

        {/* Re-process past chats button — shown when past chats may have missing brand data */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {reprocessResult && (
            <span style={{ fontSize: 12, color: "#10b981" }}>
              ✓ {reprocessResult.created} mentions found across {reprocessResult.brandsProcessed} brands
            </span>
          )}
          {reprocessError && (
            <span style={{ fontSize: 12, color: "#ef4444" }}>{reprocessError}</span>
          )}
          {reprocessAllBrandsAction && (
            <button
              className="bp-reprocess-btn"
              onClick={doReprocess}
              disabled={reprocessBusy}
              title="Scan all past chat responses and create brand mentions for tracked brands"
            >
              {reprocessBusy ? (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "bp-spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> Processing…</>
              ) : (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Re-process past chats</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="bp-body">

        {/* Left column: search + table */}
        <div className="bp-main">
          {/* Search */}
          <div className="bp-search-wrap">
            <Search size={13} className="bp-search-icon" />
            <input
              className="bp-search-input"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Table */}
          <div className="bp-table-wrap">
            {brands.length === 0 ? (
              <div className="bp-empty">
                <div className="bp-empty-icon">
                  <Search size={20} className="text-zinc-400" />
                </div>
                <h2 className="bp-empty-h">Track your first competitor</h2>
                <p className="bp-empty-p">
                  Add brands to track how often they appear in AI-generated answers
                  vs. your own visibility.
                </p>
                <button className="bp-btn-add" onClick={() => openModal()}>
                  <Plus size={14} /> Add brand
                </button>
              </div>
            ) : (
              <table className="bp-table">
                <thead>
                  <tr>
                    <th className="bp-th bp-th--nosort" style={{ width: 44 }}>Brand color</th>
                    <th className="bp-th" onClick={() => handleSort("name")}>
                      Display name <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className="bp-th" onClick={() => handleSort("aliases")}>
                      Tracked names <SortIcon field="aliases" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className="bp-th" onClick={() => handleSort("domains")}>
                      Domains <SortIcon field="domains" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className="bp-th" onClick={() => handleSort("mentions")}>
                      Mentions <SortIcon field="mentions" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className="bp-th bp-th--nosort" style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((brand) => {
                    const brandColor     = brand.color ?? colorFromId(brand.id);
                    const isNameEditing  = editingBrandId === brand.id;
                    const isAliasEditing = aliasEditId    === brand.id;
                    const isDomainEditing = domainEditId  === brand.id;
                    return (
                      <React.Fragment key={brand.id}>
                        <BrandRow
                          brand={brand}
                          openMenu={openMenu}
                          onMenu={(id) => setOpenMenu(openMenu === id ? null : id)}
                          onDelete={doDelete}
                          onColorDotClick={(id, e) => openPickerAt(id, e)}
                          isNameEditing={isNameEditing}
                          isAliasEditing={isAliasEditing}
                          isDomainEditing={isDomainEditing}
                          onNameClick={startEdit}
                          onAliasClick={startAliasEdit}
                          onDomainClick={startDomainEdit}
                        />

                        {/* ── Display-name inline edit card ────────────── */}
                        {isNameEditing && (
                          <tr className="bp-edit-tr">
                            <td colSpan={6} className="bp-edit-td">
                              <div className="bp-edit-card" ref={editCardRef}>
                                <label className="bp-edit-label">Display name</label>
                                <div className="bp-edit-input-wrap">
                                  <input
                                    className="bp-edit-input"
                                    value={editDisplayName}
                                    autoFocus
                                    maxLength={255}
                                    onChange={e => { setEditDisplayName(e.target.value); setEditError(null); }}
                                    onKeyDown={e => {
                                      if (e.key === "Enter") { e.preventDefault(); doRename(); }
                                      if (e.key === "Escape") { setEditingBrandId(null); setEditError(null); }
                                    }}
                                  />
                                  {editDisplayName && (
                                    <button className="bp-edit-clear" onClick={() => setEditDisplayName("")} tabIndex={-1}>
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                                {editError
                                  ? <p className="bp-edit-error">{editError}</p>
                                  : <p className="bp-edit-hint">Press <kbd>↵ enter</kbd> to save edit</p>
                                }
                                <button className="bp-edit-save-btn" disabled={editBusy || !editDisplayName.trim()} onClick={doRename}>
                                  {editBusy ? "Saving…" : "Save changes"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* ── Tracked-names inline edit card ───────────── */}
                        {isAliasEditing && (
                          <tr className="bp-edit-tr">
                            <td colSpan={6} className="bp-edit-td bp-edit-td--alias">
                              <div className="bp-alias-card" ref={aliasCardRef} style={{ left: "calc(44px + 14px + 300px + 14px)" }}>
                                {/* Add input */}
                                <div className="bp-alias-add-wrap">
                                  <input
                                    className="bp-alias-add-input"
                                    placeholder="Create and add tracked names"
                                    value={newAliasInput}
                                    autoFocus
                                    onChange={e => setNewAliasInput(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === "Enter") { e.preventDefault(); addAlias(); }
                                      if (e.key === "Escape") { setAliasEditId(null); setAliasError(null); }
                                    }}
                                  />
                                  {newAliasInput && (
                                    <button className="bp-edit-clear" onClick={() => setNewAliasInput("")} tabIndex={-1}>
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>

                                {/* Tracked names list */}
                                {editAliases.length > 0 && (
                                  <>
                                    <div className="bp-alias-section-label">Tracked names</div>
                                    <ul className="bp-alias-list">
                                      {editAliases.map((alias, idx) => (
                                        <li
                                          key={idx}
                                          className={`bp-alias-item${dragIdx === idx ? " bp-alias-item--dragging" : ""}${editingAliasIdx === idx ? " bp-alias-item--editing" : ""}`}
                                          draggable={editingAliasIdx !== idx}
                                          onDragStart={() => editingAliasIdx === null && setDragIdx(idx)}
                                          onDragOver={e => { e.preventDefault(); }}
                                          onDrop={e => {
                                            e.preventDefault();
                                            if (dragIdx === null || dragIdx === idx) return;
                                            const next = [...editAliases];
                                            const [moved] = next.splice(dragIdx, 1);
                                            next.splice(idx, 0, moved);
                                            setEditAliases(next);
                                            setDragIdx(null);
                                          }}
                                          onDragEnd={() => setDragIdx(null)}
                                        >
                                          <span className="bp-alias-grip">⠿</span>

                                          {/* Inline alias rename input OR static name */}
                                          {editingAliasIdx === idx ? (
                                            <input
                                              className="bp-alias-inline-input"
                                              value={editingAliasValue}
                                              autoFocus
                                              onChange={e => setEditingAliasValue(e.target.value)}
                                              onKeyDown={e => {
                                                if (e.key === "Enter") {
                                                  e.preventDefault();
                                                  const val = editingAliasValue.trim();
                                                  if (val) {
                                                    setEditAliases(prev => prev.map((a, i) => i === idx ? val : a));
                                                  }
                                                  setEditingAliasIdx(null);
                                                }
                                                if (e.key === "Escape") {
                                                  setEditingAliasIdx(null);
                                                }
                                              }}
                                              onBlur={() => {
                                                const val = editingAliasValue.trim();
                                                if (val) setEditAliases(prev => prev.map((a, i) => i === idx ? val : a));
                                                setEditingAliasIdx(null);
                                              }}
                                              onClick={e => e.stopPropagation()}
                                            />
                                          ) : (
                                            <span className="bp-alias-name">{alias}</span>
                                          )}

                                          {/* Pencil edit + X remove buttons */}
                                          {editingAliasIdx !== idx && (
                                            <div className="bp-alias-actions">
                                              <button
                                                className="bp-alias-edit-btn"
                                                title="Edit tracked name"
                                                onClick={e => {
                                                  e.stopPropagation();
                                                  setEditingAliasIdx(idx);
                                                  setEditingAliasValue(alias);
                                                }}
                                                tabIndex={-1}
                                              >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                              </button>
                                              <button className="bp-alias-rm" onClick={() => removeAlias(idx)} tabIndex={-1}>
                                                <X size={11} />
                                              </button>
                                            </div>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </>
                                )}

                                {/* Advanced: Regular Expression toggle */}
                                <div className="bp-alias-regex-row">
                                  <span className="bp-alias-regex-label">or Advanced: Regular Expression</span>
                                  <button
                                    role="switch"
                                    aria-checked={useRegex}
                                    className={`bp-alias-toggle${useRegex ? " bp-alias-toggle--on" : ""}`}
                                    onClick={() => setUseRegex(v => !v)}
                                  >
                                    <span className="bp-alias-toggle-thumb" />
                                  </button>
                                </div>

                                {aliasError && <p className="bp-edit-error">{aliasError}</p>}

                                <button
                                  className="bp-edit-save-btn"
                                  disabled={aliasBusy}
                                  onClick={doSaveAliases}
                                >
                                  {aliasBusy ? "Saving…" : "Save changes"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* ── Domain inline edit card ──────────────────── */}
                        {isDomainEditing && (
                          <tr className="bp-edit-tr">
                            <td colSpan={6} className="bp-edit-td bp-edit-td--domain">
                              <div className="bp-alias-card" ref={domainCardRef} style={{ left: "calc(44px + 14px + 300px + 14px + 220px + 14px)" }}>
                                {/* Add domain input */}
                                <div className="bp-alias-add-wrap">
                                  <input
                                    className="bp-alias-add-input"
                                    placeholder="Create and add domains"
                                    value={newDomainInput}
                                    autoFocus
                                    onChange={e => setNewDomainInput(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === "Enter") { e.preventDefault(); addDomain(); }
                                      if (e.key === "Escape") { setDomainEditId(null); setDomainError(null); }
                                    }}
                                  />
                                  {newDomainInput && (
                                    <button className="bp-edit-clear" onClick={() => setNewDomainInput("")} tabIndex={-1}>
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>

                                {/* Domain list */}
                                {editDomains.length > 0 && (
                                  <>
                                    <div className="bp-alias-section-label">Primary domain</div>
                                    <ul className="bp-alias-list">
                                      {editDomains.map((domain, idx) => (
                                        <li
                                          key={idx}
                                          className={`bp-alias-item${dragDomainIdx === idx ? " bp-alias-item--dragging" : ""}${editingDomainIdx === idx ? " bp-alias-item--editing" : ""}`}
                                          draggable={editingDomainIdx !== idx}
                                          onDragStart={() => editingDomainIdx === null && setDragDomainIdx(idx)}
                                          onDragOver={e => e.preventDefault()}
                                          onDrop={e => {
                                            e.preventDefault();
                                            if (dragDomainIdx === null || dragDomainIdx === idx) return;
                                            const next = [...editDomains];
                                            const [moved] = next.splice(dragDomainIdx, 1);
                                            next.splice(idx, 0, moved);
                                            setEditDomains(next);
                                            setDragDomainIdx(null);
                                          }}
                                          onDragEnd={() => setDragDomainIdx(null)}
                                        >
                                          <span className="bp-alias-grip">⠿</span>
                                          {editingDomainIdx === idx ? (
                                            <input
                                              className="bp-alias-inline-input"
                                              value={editingDomainValue}
                                              autoFocus
                                              onChange={e => setEditingDomainValue(e.target.value)}
                                              onKeyDown={e => {
                                                if (e.key === "Enter") {
                                                  e.preventDefault();
                                                  const val = editingDomainValue.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
                                                  if (val) setEditDomains(prev => prev.map((d, i) => i === idx ? val : d));
                                                  setEditingDomainIdx(null);
                                                }
                                                if (e.key === "Escape") setEditingDomainIdx(null);
                                              }}
                                              onBlur={() => {
                                                const val = editingDomainValue.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
                                                if (val) setEditDomains(prev => prev.map((d, i) => i === idx ? val : d));
                                                setEditingDomainIdx(null);
                                              }}
                                              onClick={e => e.stopPropagation()}
                                            />
                                          ) : (
                                            <span className="bp-alias-name">{domain}</span>
                                          )}
                                          {editingDomainIdx !== idx && (
                                            <div className="bp-alias-actions">
                                              <button
                                                className="bp-alias-edit-btn"
                                                title="Edit domain"
                                                onClick={e => { e.stopPropagation(); setEditingDomainIdx(idx); setEditingDomainValue(domain); }}
                                                tabIndex={-1}
                                              >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                              </button>
                                              <button className="bp-alias-rm" onClick={() => removeDomain(idx)} tabIndex={-1}>
                                                <X size={11} />
                                              </button>
                                            </div>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </>
                                )}

                                {domainError && <p className="bp-edit-error" style={{ padding: "4px 12px" }}>{domainError}</p>}

                                <button
                                  className="bp-edit-save-btn"
                                  disabled={domainBusy}
                                  onClick={doSaveDomains}
                                >
                                  {domainBusy ? "Saving…" : "Save changes"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}

                        {pickerInfo?.id === brand.id && (
                          <BrandColorPicker
                            key={`picker-${brand.id}`}
                            color={brandColor}
                            position={pickerInfo.pos}
                            onChange={async (color) => {
                              setBrands(prev => prev.map(b => b.id === brand.id ? { ...b, color } : b));
                              await updateBrandColorAction?.(brand.id, color);
                            }}
                            onClose={() => setPickerInfo(null)}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column: suggestions */}
        <div className="bp-sidebar">
          <div className="bp-sidebar-head">
            <span className="bp-sidebar-title">Brand suggestions</span>
            <span className="bp-sidebar-count">· {suggestions.length}</span>
            <Info size={13} className="bp-sidebar-info" />
          </div>

          <div className="bp-sidebar-cards">
            {suggestions.length === 0 ? (
              <div className="bp-sidebar-empty-state">
                <p className="bp-sidebar-empty">No suggestions yet.</p>
                <p className="bp-sidebar-empty-hint">
                  Run some prompts — brands that frequently appear in AI responses
                  but aren&apos;t tracked will be suggested here.
                </p>
              </div>
            ) : (
              suggestions.map((s) => (
                <SuggestionCard key={s.id} s={s} onAccept={doAccept} onReject={doReject} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Add Brand Modal ── */}
      {modal && (
        <div className="bp-modal-overlay" onClick={() => { closeModal(); resetModal(); }}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bp-modal-header">
              <span className="bp-modal-title">Add brand</span>
              <button className="bp-modal-close" onClick={() => { closeModal(); resetModal(); }}>
                <X size={17} />
              </button>
            </div>

            <div className="bp-modal-body">
              {/* Display name */}
              <div className="bp-field">
                <label className="bp-label">
                  Display Name <span className="bp-label-required">*</span>
                </label>
                <input
                  className={`bp-input${mError ? " bp-input--error" : ""}`}
                  placeholder="e.g. Acme Corp"
                  value={mName}
                  onChange={(e) => { setMName(e.target.value); if (mError) setMError(""); }}
                  autoFocus
                />
                {mError && <p className="bp-field-error">{mError}</p>}
              </div>

              {/* Own brand toggle */}
              <label className="bp-own-label">
                <input
                  type="checkbox"
                  className="bp-own-checkbox"
                  checked={mIsOwn}
                  onChange={(e) => setMIsOwn(e.target.checked)}
                />
                <span className="bp-own-text">This is my brand <span className="bp-badge-you" style={{ marginLeft: 4 }}>You</span></span>
              </label>

              {/* Tracked names / aliases */}
              <div className="bp-field">
                <label className="bp-label">Tracked Names</label>
                <p className="bp-hint">
                  Only tracked names and aliases are matched in AI answers to identify this brand.
                </p>
                {mAliases.map((a, i) => (
                  <div key={i} className="bp-field-row">
                    <input className="bp-input" placeholder="e.g. Acme" value={a}
                      onChange={(e) => {
                        const n = [...mAliases]; n[i] = e.target.value; setMAliases(n);
                      }} />
                    {mAliases.length > 1 && (
                      <button className="bp-field-rm" onClick={() => setMAliases(mAliases.filter((_, j) => j !== i))}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
                <button className="bp-field-add" onClick={() => setMAliases([...mAliases, ""])}>
                  <Plus size={12} /> Add alias
                </button>
              </div>

              {/* Domains */}
              <div className="bp-field">
                <label className="bp-label">Domains</label>
                <p className="bp-hint">Used to fetch the brand favicon and match citation URLs.</p>
                {mDomains.map((d, i) => (
                  <div key={i} className="bp-field-row">
                    <input className="bp-input" placeholder="e.g. example.com" value={d}
                      onChange={(e) => {
                        const n = [...mDomains]; n[i] = e.target.value; setMDomains(n);
                      }}
                      onBlur={(e) => {
                        const norm = normalizeDomain(e.target.value);
                        const n = [...mDomains]; n[i] = norm; setMDomains(n);
                      }}
                    />
                    {mDomains.length > 1 && (
                      <button className="bp-field-rm" onClick={() => setMDomains(mDomains.filter((_, j) => j !== i))}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
                <button className="bp-field-add" onClick={() => setMDomains([...mDomains, ""])}>
                  <Plus size={12} /> Add domain
                </button>
              </div>
            </div>

            <div className="bp-modal-footer">
              <button className="bp-btn-cancel" onClick={() => { closeModal(); resetModal(); }}>Cancel</button>
              <button className="bp-btn-create" onClick={doCreate} disabled={!mName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
