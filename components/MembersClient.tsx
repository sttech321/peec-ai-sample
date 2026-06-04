"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface Member {
  id: string;
  email: string;
  role: string;
  invitedBy: string;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
}

interface RolePermission {
  view: boolean;
  edit: boolean;
  runScans: boolean;
  manageMembers: boolean;
  workspaceSettings: boolean;
}

interface Props {
  members: Member[];
  pendingInvites: PendingInvite[];
  currentEmail: string;
  currentRole: string;
  canManage: boolean;
  workspaceId: string;
  roleLabels: Record<string, string>;
  roleColors: Record<string, string>;
  roleDescriptions: Record<string, string>;
  rolePermissions: Record<string, RolePermission>;
}

const ROLE_OPTIONS = [
  { value: "company_member", label: "Company Member", desc: "Manage members + edit everything" },
  { value: "project_member", label: "Project Member", desc: "Edit projects & brands, no member mgmt" },
  { value: "project_viewer", label: "Project Viewer", desc: "View-only, no editing" },
];

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  const hr   = Math.floor(diff / 3600000);
  const day  = Math.floor(diff / 86400000);
  const mo   = Math.floor(day / 30);
  if (min < 2)   return "just now";
  if (min < 60)  return `${min} min ago`;
  if (hr  < 24)  return `${hr} hr ago`;
  if (day < 30)  return `${day} day${day !== 1 ? "s" : ""} ago`;
  return `${mo} mo ago`;
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    owner:          { label: "Owner",          cls: "mbr-badge--amber" },
    company_member: { label: "Company Member", cls: "mbr-badge--blue"  },
    project_member: { label: "Project Member", cls: "mbr-badge--green" },
    project_viewer: { label: "Project Viewer", cls: "mbr-badge--gray"  },
  };
  const { label, cls } = map[role] ?? { label: role, cls: "mbr-badge--gray" };
  return <span className={`mbr-badge ${cls}`}>{label}</span>;
}

export default function MembersClient({
  members: initialMembers,
  pendingInvites: initialInvites,
  currentEmail,
  currentRole,
  canManage,
  workspaceId,
  roleLabels,
  roleColors,
  roleDescriptions,
  rolePermissions,
}: Props) {
  const router = useRouter();
  const [members, setMembers]         = useState(initialMembers);
  const [pendingInvites]              = useState(initialInvites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState("company_member");
  const [inviting, setInviting]       = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [devLink, setDevLink]         = useState("");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(""); setInviteSuccess(""); setDevLink("");
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? "Failed to send invitation");
      } else {
        setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`);
        setInviteEmail("");
        if (data.devLink) setDevLink(data.devLink);
        router.refresh();
      }
    } catch {
      setInviteError("Network error. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    const res = await fetch(`/api/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
    }
  }

  async function handleRemove(memberId: string, email: string) {
    if (!confirm(`Remove ${email} from the workspace?`)) return;
    const res = await fetch(`/api/members/${memberId}`, { method: "DELETE" });
    if (res.ok) setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  return (
    <div className="mbr-page">

      {/* ── Invite form ─────────────────────────────────────────────── */}
      {canManage ? (
        <div className="mbr-invite-card">
          <p className="mbr-invite-title">Invite Members</p>
          <form className="mbr-invite-form" onSubmit={handleInvite}>
            <div className="mbr-invite-email-wrap">
              <label className="mbr-label">Email</label>
              <input
                className="mbr-invite-input"
                type="email"
                placeholder="friend@provider.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="mbr-invite-role-wrap">
              <label className="mbr-label">Invite to</label>
              <select
                className="mbr-invite-select"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <button className="mbr-invite-btn" type="submit" disabled={inviting}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" />
              </svg>
              {inviting ? "Sending…" : "Invite"}
            </button>
          </form>
          {inviteError   && <p className="mbr-error">{inviteError}</p>}
          {inviteSuccess && <p className="mbr-success">{inviteSuccess}</p>}
          {devLink && (
            <div className="mbr-devlink">
              <strong>Dev mode</strong> — Share this link:{" "}
              <a href={devLink} target="_blank" rel="noreferrer">{devLink}</a>
            </div>
          )}
        </div>
      ) : (
        <p className="mbr-readonly">
          You have view-only access. Contact your workspace owner to manage members.
        </p>
      )}

      {/* ── Members table ───────────────────────────────────────────── */}
      <div className="mbr-list-card">
        <table className="mbr-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Created</th>
              {canManage && <th style={{ width: 44 }}></th>}
            </tr>
          </thead>
          <tbody>
            {/* Current user row */}
            <tr>
              <td>
                <div className="mbr-row-email">
                  <RoleBadge role={currentRole} />
                  <span className="mbr-email-text">
                    {currentEmail || workspaceId}
                    <span className="mbr-you">You</span>
                  </span>
                </div>
              </td>
              <td className="mbr-date">—</td>
              {canManage && <td />}
            </tr>

            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <div className="mbr-row-email">
                    {canManage && m.email !== currentEmail ? (
                      <select
                        className={`mbr-role-select mbr-role-select--${m.role}`}
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge role={m.role} />
                    )}
                    <span className="mbr-email-text">
                      {m.email}
                      {m.email === currentEmail && <span className="mbr-you">You</span>}
                    </span>
                  </div>
                </td>
                <td className="mbr-date">{formatTimeAgo(m.createdAt)}</td>
                {canManage && (
                  <td>
                    <button
                      className="mbr-delete-btn"
                      onClick={() => handleRemove(m.id, m.email)}
                      title={`Remove ${m.email}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pending invitations ─────────────────────────────────────── */}
      {canManage && pendingInvites.length > 0 && (
        <div className="mbr-list-card" style={{ marginTop: 16 }}>
          <div className="mbr-section-header">
            <span className="mbr-section-title">Pending invitations</span>
            <span className="mbr-count">{pendingInvites.length}</span>
          </div>
          <table className="mbr-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Expires</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <div className="mbr-row-email">
                      <RoleBadge role={inv.role} />
                      <span className="mbr-email-text">{inv.email}</span>
                      <span className="mbr-pending-tag">Pending</span>
                    </div>
                  </td>
                  <td className="mbr-date">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
