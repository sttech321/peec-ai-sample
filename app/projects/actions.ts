"use server";

import { db } from "../../db";
import { projects, topics, workspaceMembers } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getWorkspaceId } from "../../lib/project-context";
import { verifySession, signSession, SESSION_COOKIE, SETUP_DONE_COOKIE, SESSION_MAX_AGE } from "../../lib/session";

const ACTIVE_PROJECT_COOKIE = "active_project_id";

const PROJECT_COLORS = [
  "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#3b82f6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#d946ef", "#0ea5e9", "#78716c", "#a3e635",
];

export async function createProject(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  const workspaceId = await getWorkspaceId();

  // Ensure workspace exists — if not, upsert via the user's session email
  const { workspaces } = await import("../../db/schema");
  const [wsExists] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!wsExists) {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    const session = raw ? verifySession(raw) : null;
    if (!session?.email) {
      console.error("[createProject] No session email — cannot create workspace");
      return;
    }
    const { upsertUser } = await import("../../lib/upsert-user");
    await upsertUser({ email: session.email, provider: "magic_link", role: "owner" });
  }

  const existingCount = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId));

  const color = PROJECT_COLORS[existingCount.length % PROJECT_COLORS.length];

  const domainRaw = (formData.get("domain") as string) ?? "";
  const domain = domainRaw.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null;

  const allocatedPrompts = parseInt(formData.get("allocatedPrompts") as string) || 100;
  const allocatedCredits = parseInt(formData.get("allocatedCredits") as string) || 3000;
  const frequency = (formData.get("frequency") as string) || "Daily";
  const projectType = (formData.get("projectType") as string) || "Customer";
  const modelsRaw = formData.get("models") as string;
  const models = modelsRaw ? modelsRaw.split(",").filter(Boolean) : null;

  const [project] = await db.insert(projects).values({
    workspaceId,
    name,
    domain,
    allocatedPrompts,
    allocatedCredits,
    frequency,
    projectType,
    color,
    models,
  }).returning();

  await db.insert(topics).values({
    workspaceId,
    projectId: project.id,
    name: "General Topic",
  });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROJECT_COOKIE, project.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  revalidatePath("/projects");
}

export async function updateProject(projectId: string, data: {
  name?: string;
  brandName?: string | null;
  domain?: string | null;
  allocatedPrompts?: number;
  allocatedCredits?: number;
  frequency?: string;
  projectType?: string;
  models?: string[] | null;
  location?: string | null;
  language?: string | null;
  timezone?: string | null;
}) {
  const workspaceId = await getWorkspaceId();
  const domainVal = data.domain
    ? data.domain.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null
    : data.domain;

  await db.update(projects)
    .set({
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.brandName !== undefined ? { brandName: data.brandName?.trim() || null } : {}),
      ...(data.domain !== undefined ? { domain: domainVal } : {}),
      ...(data.allocatedPrompts !== undefined ? { allocatedPrompts: data.allocatedPrompts } : {}),
      ...(data.allocatedCredits !== undefined ? { allocatedCredits: data.allocatedCredits } : {}),
      ...(data.frequency !== undefined ? { frequency: data.frequency } : {}),
      ...(data.projectType !== undefined ? { projectType: data.projectType } : {}),
      ...(data.models !== undefined ? { models: data.models } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.language !== undefined ? { language: data.language } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  void workspaceId;
  revalidatePath("/", "layout");
  revalidatePath("/projects");
}

export async function toggleProjectStatus(projectId: string) {
  const [project] = await db
    .select({ status: projects.status })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) return;

  const newStatus = project.status === "active" ? "paused" : "active";
  await db.update(projects)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  revalidatePath("/", "layout");
  revalidatePath("/projects");
}

export async function deleteProject(projectId: string) {
  // Only owners can delete projects
  const { getCurrentRole } = await import("../../lib/project-context");
  const { canManageWorkspace } = await import("../../lib/permissions");
  const role = await getCurrentRole();
  if (!canManageWorkspace(role)) {
    console.warn("[deleteProject] Unauthorized attempt by role:", role);
    return;
  }

  const workspaceId = await getWorkspaceId();
  const cookieStore = await cookies();

  await db.delete(projects).where(eq(projects.id, projectId));

  // Check remaining projects after deletion
  const [next] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .limit(1);

  const active = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value;
  if (active === projectId) {
    if (next) {
      cookieStore.set(ACTIVE_PROJECT_COOKIE, next.id, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    } else {
      cookieStore.delete(ACTIVE_PROJECT_COOKIE);
    }
  }

  // No projects left → clear setup-done cookie so middleware redirects to /setup
  if (!next) {
    cookieStore.delete("tv_setup_done");
  }

  revalidatePath("/", "layout");
  revalidatePath("/projects");
}

export async function switchProject(projectId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROJECT_COOKIE, projectId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}

/**
 * Switch current session to an invited workspace's project.
 * Validates the user is actually a member before switching.
 */
export async function switchToInvitedWorkspace(projectId: string, targetWorkspaceId: string) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  const session = raw ? verifySession(raw) : null;
  if (!session) return { ok: false, error: "Not authenticated" };

  // Verify user is actually a member of the target workspace
  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, targetWorkspaceId),
        eq(workspaceMembers.email, session.email),
      ),
    )
    .limit(1);

  if (!membership) return { ok: false, error: "Not a member of this workspace" };

  // Verify the project belongs to that workspace
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, targetWorkspaceId)))
    .limit(1);

  if (!project) return { ok: false, error: "Project not found" };

  // Update session to the invited workspace
  const newSession = signSession({
    email: session.email,
    userId: session.userId,
    workspaceId: targetWorkspaceId,
    role: membership.role,
  });

  const COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  };

  cookieStore.set(SESSION_COOKIE, newSession, COOKIE_OPTS);
  cookieStore.set(SETUP_DONE_COOKIE, "1", COOKIE_OPTS);
  cookieStore.set(ACTIVE_PROJECT_COOKIE, projectId, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Switch back to the user's own workspace from an invited workspace.
 */
export async function switchToOwnWorkspace(projectId: string) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  const session = raw ? verifySession(raw) : null;
  if (!session) return { ok: false, error: "Not authenticated" };

  // Find the user's own workspace
  const { workspaces } = await import("../../db/schema");
  const [ownWorkspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, session.userId))
    .limit(1);

  if (!ownWorkspace) return { ok: false, error: "Own workspace not found" };

  // Verify project belongs to own workspace
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ownWorkspace.id)))
    .limit(1);

  if (!project) return { ok: false, error: "Project not found in your workspace" };

  const COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  };

  // Restore session to own workspace as owner
  const newSession = signSession({
    email: session.email,
    userId: session.userId,
    workspaceId: ownWorkspace.id,
    role: "owner",
  });

  cookieStore.set(SESSION_COOKIE, newSession, COOKIE_OPTS);
  cookieStore.set(SETUP_DONE_COOKIE, "1", COOKIE_OPTS);
  cookieStore.set(ACTIVE_PROJECT_COOKIE, projectId, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  revalidatePath("/", "layout");
  return { ok: true };
}
