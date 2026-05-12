"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Search, Plus, Check } from "lucide-react";
import { addBrand } from "../app/actions/brands";

interface ProjectBrand {
  name: string;
  isOwn: boolean;
}

interface Props {
  projectBrands: ProjectBrand[];
  projectName: string;
  value: string[] | null; // null = all brands selected
  onChange: (v: string[] | null) => void;
}

export default function BrandsDropdown({ projectBrands, projectName, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
        setError(null);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const tracked = useMemo(
    () => projectBrands.filter((b) => b.isOwn).map((b) => b.name),
    [projectBrands],
  );
  const all = useMemo(
    () => projectBrands.filter((b) => !b.isOwn).map((b) => b.name),
    [projectBrands],
  );

  const q = query.toLowerCase().trim();
  const filteredTracked = q ? tracked.filter((n) => n.toLowerCase().includes(q)) : tracked;
  const filteredAll = q ? all.filter((n) => n.toLowerCase().includes(q)) : all;

  const isAllSelected = value === null;
  const selectedSet = new Set(value ?? []);

  const triggerLabel =
    isAllSelected
      ? "All Brands"
      : value!.length === 0
      ? "0 Brands"
      : value!.length === 1
      ? value![0]
      : `${value!.length} Brands`;

  const toggleBrand = (name: string) => {
    if (isAllSelected) {
      // Switch to specific selection — start with all-but-this unchecked? Or just this one?
      // Peec behavior: clicking a brand from "All" turns into a specific selection.
      // Easier UX: clicking unchecks it from full list (i.e. all minus this).
      const next = projectBrands.map((b) => b.name).filter((n) => n !== name);
      onChange(next);
      return;
    }
    if (selectedSet.has(name)) {
      onChange((value ?? []).filter((n) => n !== name));
    } else {
      onChange([...(value ?? []), name]);
    }
  };

  const selectAll = () => onChange(null);

  const handleAdd = () => {
    setError(null);
    const name = newBrand.trim();
    if (!name) {
      setError("Enter a brand name");
      return;
    }
    startTransition(async () => {
      const res = await addBrand(name);
      if (!res.ok) {
        setError(res.error || "Failed to add brand");
        return;
      }
      setNewBrand("");
      setAdding(false);
      router.refresh();
    });
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button className="pd-filter-chip" onClick={() => setOpen(!open)}>
        <Building2 size={11} /> {triggerLabel} <ChevronDown size={11} />
      </button>

      {open && (
        <div className="pd-brands-panel">
          <div className="pd-brands-search">
            <Search size={12} className="pd-brands-search-icon" />
            <input
              type="text"
              placeholder="Search brands..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          <button
            className={`pd-brands-row pd-brands-allrow ${isAllSelected ? "active" : ""}`}
            onClick={selectAll}
          >
            <span className="pd-brands-row-label">All brands</span>
            {isAllSelected && <Check size={13} />}
          </button>

          <div className="pd-brands-scroll custom-scrollbar">
            {filteredTracked.length > 0 && (
              <>
                <div className="pd-brands-section-label">Tracked brand</div>
                {filteredTracked.map((name) => {
                  const checked = isAllSelected || selectedSet.has(name);
                  return (
                    <label key={name} className="pd-brands-row pd-brands-tracked">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBrand(name)}
                      />
                      <span className="pd-brands-row-label">{name}</span>
                      {projectName === name && <span className="pd-brands-you-badge">You</span>}
                    </label>
                  );
                })}
              </>
            )}

            {filteredAll.length > 0 && (
              <>
                <div className="pd-brands-section-label">All brands</div>
                {filteredAll.map((name) => {
                  const checked = isAllSelected || selectedSet.has(name);
                  return (
                    <label key={name} className="pd-brands-row">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBrand(name)}
                      />
                      <span className="pd-brands-row-label">{name}</span>
                    </label>
                  );
                })}
              </>
            )}

            {filteredTracked.length === 0 && filteredAll.length === 0 && (
              <div className="pd-brands-empty">No brands match.</div>
            )}
          </div>

          <div className="pd-brands-add">
            {adding ? (
              <div className="pd-brands-add-form">
                <input
                  type="text"
                  placeholder="Brand name"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  autoFocus
                />
                <button onClick={handleAdd} disabled={pending} className="pd-brands-add-confirm">
                  {pending ? "..." : "Add"}
                </button>
                <button
                  onClick={() => {
                    setAdding(false);
                    setNewBrand("");
                    setError(null);
                  }}
                  className="pd-brands-add-cancel"
                >
                  ×
                </button>
              </div>
            ) : (
              <button className="pd-brands-add-trigger" onClick={() => setAdding(true)}>
                <Plus size={12} /> Add brand
              </button>
            )}
            {error && <div className="pd-brands-error">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
