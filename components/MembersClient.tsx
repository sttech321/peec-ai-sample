"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

interface Props {
  members: Member[];
  pendingInvites: PendingInvite[];
  currentEmail: string;
  currentRole: string;
  canManage: boolean;
  workspaceId: string;
  roleLabels: Record<string, string>;
  roleColors: Record<string, string>;
}

const ROLE_OPTIONS = [
  { value: "company_member", label: "Company Member" },
  { value: "project_member", label: "Project Member" },
  { value: "project_viewer", label: "Project Viewer" },
];

function getInitial(email: string) {
  return email.charAt(0).toUpperCase();
}

function RoleBadge({ role, roleLabels, roleColors }: { role: string; roleLabels: Record<string, string>; roleColors: Record<string, string> }) {
  const label = role === "owner" ? "Owner" : (roleLabels[role] ?? role);
  const colorClass = role === "owner" ? "member-badge--amber" : (roleColors[role] ?? "member-badge--gray");
  return <span className={`member-badge ${colorClass}`}>{label}</span>;
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
}: Props) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [pendingInvites] = useState(initialInvites);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("company_member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [devLink, setDevLink] = useState("");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    setDevLink("");
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
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    }
  }

  async function handleRemove(memberId: string, email: string) {
    if (!confirm(`Remove ${email} from the workspace?`)) return;
    const res = await fetch(`/api/members/${memberId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
  }

  return (
    <div className="members-page">
      <div className="members-header">
        <h1 className="members-title">Team Members</h1>
        <p className="members-subtitle">
          Manage who has access to your workspace and their roles.
        </p>
      </div>

      {!canManage && (
        <p className="members-readonly-notice">
          You have view-only access to this page. Contact your workspace owner to change member settings.
        </p>
      )}

      {/* Invite form — admin only */}
      {canManage && (
        <div className="invite-section">
          <p className="invite-section-title">Invite a team member</p>
          <form className="invite-form" onSubmit={handleInvite}>
            <div className="invite-field invite-field-email">
              <label>Email address</label>
              <input
                className="invite-input"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="invite-field">
              <label>Role</label>
              <select
                className="invite-select"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <button className="invite-btn" type="submit" disabled={inviting}>
              {inviting ? "Sending…" : "Send invite"}
            </button>
          </form>
          {inviteError && <p className="invite-error">{inviteError}</p>}
          {inviteSuccess && <p className="invite-success">{inviteSuccess}</p>}
          {devLink && (
            <div className="invite-dev-link">
              <strong>Dev mode</strong> — no SMTP configured. Share this link manually:{" "}
              <a href={devLink} target="_blank" rel="noreferrer">{devLink}</a>
            </div>
          )}
        </div>
      )}

      {/* Members table */}
      <div className="members-table-section">
        <div className="members-table-header">
          <span className="members-table-title">Workspace members</span>
          <span className="members-count-badge">{members.length + 1}</span>
        </div>
        <table className="members-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Invited by</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {/* Owner row (the workspace creator = workspaceId email) */}
            <tr>
              <td>
                <div className="member-info">
                  <div className="member-avatar">{getInitial(workspaceId)}</div>
                  <span className="member-email">
                    {workspaceId}
                    {workspaceId === currentEmail && (
                      <span className="member-you-tag" style={{ marginLeft: 6 }}>You</span>
                    )}
                  </span>
                </div>
              </td>
              <td>
                <RoleBadge role="owner" roleLabels={roleLabels} roleColors={roleColors} />
              </td>
              <td style={{ color: "#aaa", fontSize: 13 }}>—</td>
              {canManage && <td />}
            </tr>

            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <div className="member-info">
                    <div className="member-avatar">{getInitial(m.email)}</div>
                    <span className="member-email">
                      {m.email}
                      {m.email === currentEmail && (
                        <span className="member-you-tag" style={{ marginLeft: 6 }}>You</span>
                      )}
                    </span>
                  </div>
                </td>
                <td>
                  {canManage ? (
                    <select
                      className="role-select-inline"
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  ) : (
                    <RoleBadge role={m.role} roleLabels={roleLabels} roleColors={roleColors} />
                  )}
                </td>
                <td style={{ fontSize: 13, color: "#666" }}>{m.invitedBy}</td>
                {canManage && (
                  <td>
                    <div className="member-actions">
                      <button
                        className="member-remove-btn"
                        onClick={() => handleRemove(m.id, m.email)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invitations */}
      {canManage && pendingInvites.length > 0 && (
        <div className="pending-section">
          <div className="members-table-header">
            <span className="members-table-title">Pending invitations</span>
            <span className="members-count-badge">{pendingInvites.length}</span>
          </div>
          <table className="members-table pending-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Invited by</th>
                <th>Expires</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <div className="member-info">
                      <div className="member-avatar">{getInitial(inv.email)}</div>
                      <span className="member-email">{inv.email}</span>
                    </div>
                  </td>
                  <td>
                    <RoleBadge role={inv.role} roleLabels={roleLabels} roleColors={roleColors} />
                  </td>
                  <td style={{ fontSize: 13, color: "#666" }}>{inv.invitedBy}</td>
                  <td style={{ fontSize: 13, color: "#888" }}>
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  <td>
                    <span className="pending-badge">
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d97706", display: "inline-block" }} />
                      Pending
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
