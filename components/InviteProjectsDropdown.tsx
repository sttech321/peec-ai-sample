"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Users, Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";

interface InvitedProject {
  id: string;
  name: string;
  workspaceId: string;
  isOwn: boolean;
  invitedBy?: string | null;
}

interface Props {
  invitedProjects: InvitedProject[];
  switchAction: (projectId: string, workspaceId: string) => Promise<{ ok: boolean; error?: string }>;
  switchToOwnAction: (projectId: string) => Promise<{ ok: boolean; error?: string }>;
}

const COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#3b82f6","#ec4899","#14b8a6"];

function Avatar({ name, idx }: { name: string; idx: number }) {
  const parts = name.split(" ").filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
  return (
    <span style={{
      width: 28, height: 28, borderRadius: 7,
      background: COLORS[idx % COLORS.length],
      color: "#fff", fontSize: 11, fontWeight: 700,
      display: "inline-flex", alignItems: "center",
      justifyContent: "center", flexShrink: 0,
    }}>
      {initials}
    </span>
  );
}

export default function InviteProjectsDropdown({ invitedProjects, switchAction, switchToOwnAction }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setError(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleSwitch(project: InvitedProject) {
    setLoading(project.id);
    setError(null);
    const result = project.isOwn
      ? await switchToOwnAction(project.id)
      : await switchAction(project.id, project.workspaceId);
    setLoading(null);
    if (!result.ok) {
      setError(result.error ?? "Failed to switch");
      return;
    }
    setOpen(false);
    router.refresh();
    router.push("/");
  }

  if (invitedProjects.length === 0) return null;

  const ownProjects = invitedProjects.filter(p => p.isOwn);
  const sharedProjects = invitedProjects.filter(p => !p.isOwn);

  const renderItem = (p: InvitedProject, idx: number) => {
    const isLoading = loading === p.id;
    return (
      <button
        key={p.id}
        onClick={() => handleSwitch(p)}
        disabled={isLoading}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "8px 16px", background: "transparent", border: "none",
          cursor: isLoading ? "wait" : "pointer", textAlign: "left",
          transition: "background 0.12s",
        }}
        onMouseEnter={e => !isLoading && (e.currentTarget.style.background = "#f9fafb")}
        onMouseLeave={e => !isLoading && (e.currentTarget.style.background = "transparent")}
      >
        <Avatar name={p.name} idx={idx} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.name}
          </div>
          {!p.isOwn && p.invitedBy && (
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.invitedBy}
            </div>
          )}
        </div>
        {isLoading
          ? <Loader2 size={14} style={{ color: "#6366f1", animation: "spin 1s linear infinite", flexShrink: 0 }} />
          : <Check size={14} style={{ color: "#d1d5db", flexShrink: 0 }} />
        }
      </button>
    );
  };

  return (
    <div ref={ref} style={{ position: "relative"/* , zIndex: 9999 */ }}>
      <button
        onClick={() => { setOpen(v => !v); setError(null); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px",
          border: `1px solid ${open ? "#c7d2fe" : "#e5e7eb"}`,
          borderRadius: 8, background: open ? "#eef2ff" : "#fff",
          cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#374151",
          boxShadow: open ? "0 0 0 3px #e0e7ff" : "none",
          transition: "all 0.15s", whiteSpace: "nowrap",
        }}
      >
        <Users size={14} style={{ color: "#6366f1" }} />
        <span>Invite projects</span>
        <span style={{ background: "#6366f1", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "1px 7px" }}>
          {invitedProjects.length}
        </span>
        <ChevronDown size={13} style={{ color: "#6b7280", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          minWidth: 280, background: "#fff",
          border: "1px solid #e5e7eb", borderRadius: 12,
          boxShadow: "0 10px 40px rgba(0,0,0,0.12)", zIndex: 9999,
        }}>
          {ownProjects.length > 0 && (
            <>
              <div style={{ padding: "10px 16px 6px", fontSize: 11, fontWeight: 700, color: "#10b981", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                ↩ Your workspace
              </div>
              <div style={{ padding: "0 0 4px" }}>
                {ownProjects.map((p, i) => renderItem(p, i))}
              </div>
            </>
          )}

          {sharedProjects.length > 0 && (
            <>
              <div style={{
                padding: "10px 16px 6px", fontSize: 11, fontWeight: 700, color: "#6b7280",
                letterSpacing: "0.07em", textTransform: "uppercase",
                borderTop: ownProjects.length > 0 ? "1px solid #f3f4f6" : "none",
              }}>
                Shared with you
              </div>
              <div style={{ padding: "0 0 4px" }}>
                {sharedProjects.map((p, i) => renderItem(p, i + ownProjects.length))}
              </div>
            </>
          )}

          {error && (
            <div style={{ margin: "0 12px 8px", padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#dc2626" }}>
              {error}
            </div>
          )}

          <div style={{ padding: "8px 16px 10px", borderTop: "1px solid #f3f4f6", fontSize: 11, color: "#9ca3af" }}>
            Click to switch into that workspace
          </div>
        </div>
      )}
    </div>
  );
}
