import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import DashboardLayout from "../../components/DashboardLayout";
import MembersClient from "../../components/MembersClient";
import { db } from "../../db";
import { workspaceMembers, workspaceInvitations } from "../../db/schema";
import { verifySession, SESSION_COOKIE } from "../../lib/session";
import { canManageMembers, ROLE_LABELS, ROLE_COLORS } from "../../lib/permissions";
import "./members.css";

export default async function MembersPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  const session = raw ? verifySession(raw) : null;
  const workspaceId = session?.workspaceId ?? "";
  const currentEmail = session?.email ?? "";
  const currentRole = session?.role ?? "project_viewer";
  const canManage = canManageMembers(currentRole);

  const members = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(workspaceMembers.createdAt);

  const pendingInvites = canManage
    ? await db
        .select()
        .from(workspaceInvitations)
        .where(eq(workspaceInvitations.workspaceId, workspaceId))
        .orderBy(workspaceInvitations.createdAt)
    : [];

  // Serialize for client
  const membersData = members.map((m) => ({
    id: m.id,
    email: m.email,
    role: m.role,
    invitedBy: m.invitedBy,
    createdAt: m.createdAt.toISOString(),
  }));

  const invitesData = pendingInvites
    .filter((i) => !i.used && new Date() < i.expiresAt)
    .map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      invitedBy: i.invitedBy,
      expiresAt: i.expiresAt.toISOString(),
    }));

  return (
    <DashboardLayout currentPath="/members">
      <MembersClient
        members={membersData}
        pendingInvites={invitesData}
        currentEmail={currentEmail}
        currentRole={currentRole}
        canManage={canManage}
        workspaceId={workspaceId}
        roleLabels={ROLE_LABELS}
        roleColors={ROLE_COLORS}
      />
    </DashboardLayout>
  );
}
