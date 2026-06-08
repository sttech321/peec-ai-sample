"use client";

import { useState, useMemo } from "react";
import BrandColorPicker from "./BrandColorPicker";
import { useRouter } from "next/navigation";
import {
  Search, Plus, MoreHorizontal, Check, X,
  ExternalLink, ChevronDown, ChevronUp, Info,
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
function BrandRow({ brand, openMenu, onMenu, onDelete, onColorDotClick }: {
  brand: Brand;
  openMenu: string | null;
  onMenu: (id: string) => void;
  onDelete: (id: string) => void;
  onColorDotClick: (id: string, e: React.MouseEvent) => void;
}) {
  const paletteColor = colorFromId(brand.id);
  const color = brand.color ?? paletteColor;
  return (
    <tr className="bp-row">
      <td className="bp-td bp-td--color">
        <span
          className="brand-color-dot"
          style={{ background: color, width: 18, height: 18, borderRadius: "50%" }}
          title="Change brand color"
          onClick={e => onColorDotClick(brand.id, e)}
        />
      </td>
      <td className="bp-td">
        <div className="bp-name-cell">
          <BrandAvatar id={brand.id} name={brand.name} domain={brand.domains?.[0]} />
          <span className="bp-name-text">{brand.name}</span>
          {brand.isOwn && <span className="bp-badge-you">You</span>}
        </div>
      </td>
      <td className="bp-td bp-td--muted">{brand.aliases?.join(", ") || "—"}</td>
      <td className="bp-td bp-td--muted">{brand.domains?.join(", ") || "—"}</td>
      <td className="bp-td bp-td--num">{(brand.mentions ?? 0).toLocaleString()}</td>
      <td className="bp-td bp-td--actions">
        <button
          className="bp-more-btn"
          onClick={(e) => { e.stopPropagation(); onMenu(brand.id); }}
        >
          <MoreHorizontal size={15} />
        </button>
        {openMenu === brand.id && (
          <div className="bp-popover" onClick={(e) => e.stopPropagation()}>
            <p className="bp-popover-text">
              Permanently delete this brand and all associated data.
            </p>
            <button className="bp-btn-delete" onClick={() => onDelete(brand.id)}>
              Delete brand
            </button>
          </div>
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
  const domainHost = s.domain
    ? s.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
    : null;

  return (
    <div className="bp-sug-card">
      <div className="bp-sug-top">
        <span className="bp-sug-mentions">{(s.mentions ?? 0).toLocaleString()} mentions</span>
        <div className="bp-sug-btns">
          <button className="bp-sug-btn bp-sug-btn--reject" title="Reject" onClick={() => onReject(s.id)}>
            <X size={11} />
          </button>
          <button className="bp-sug-btn bp-sug-btn--accept" title="Accept" onClick={() => onAccept(s.id)}>
            <Check size={11} />
          </button>
        </div>
      </div>
      <div className="bp-sug-name-row">
        <BrandAvatar id={s.id} name={s.name} domain={s.domain} size={20} />
        <span className="bp-sug-name">{s.name}</span>
      </div>
      {domainHost && (
        <a
          href={`https://${domainHost}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bp-sug-domain"
          onClick={(e) => e.stopPropagation()}
        >
          {domainHost}
          <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}

// ─── Domain normalizer ────────────────────────────────────────────────────────
function normalizeDomain(raw: string): string {
  return raw.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function BrandsClient({
  initialBrands, initialSuggestions, projectId, workspaceId, updateBrandColorAction,
}: {
  initialBrands: Brand[];
  initialSuggestions: Suggestion[];
  projectId: string;
  workspaceId: string;
  updateBrandColorAction?: (brandId: string, color: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();

  const [brands,      setBrands]      = useState<Brand[]>(initialBrands);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions);
  const [search,      setSearch]      = useState("");
  const [openMenu,    setOpenMenu]    = useState<string | null>(null);
  const [pickerInfo, setPickerInfo] = useState<{ id: string; pos: { top: number; left: number } } | null>(null);

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
                    const brandColor = brand.color ?? colorFromId(brand.id);
                    return (
                      <>
                        <BrandRow
                          key={brand.id}
                          brand={brand}
                          openMenu={openMenu}
                          onMenu={(id) => setOpenMenu(openMenu === id ? null : id)}
                          onDelete={doDelete}
                          onColorDotClick={(id, e) => openPickerAt(id, e)}
                        />
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
                      </>
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
              <p className="bp-sidebar-empty">No suggestions yet.</p>
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
