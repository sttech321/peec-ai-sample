import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "../db";
import { projects, brands } from "../db/schema";
import { and, eq } from "drizzle-orm";

const FALLBACK_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";
const ACTIVE_PROJECT_COOKIE = "active_project_id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getWorkspaceId = cache(async (): Promise<string> => {
  // Try Clerk first
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    if (userId) return userId;
  } catch {
    // Clerk not configured
  }

  // Fall back to custom session cookie
  try {
    const { cookies } = await import("next/headers");
    const { verifySession, SESSION_COOKIE } = await import("./session");
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (raw) {
      const session = verifySession(raw);
      if (session?.workspaceId) {
        const wid = session.workspaceId;
        if (UUID_RE.test(wid)) return wid;

        // Legacy: workspaceId is an email string (old format before UUID migration).
        // Auto-create the user + workspace so queries don't crash.
        if (wid.includes("@")) {
          try {
            const { upsertUser } = await import("./upsert-user");
            const { workspaceId } = await upsertUser({
              email: wid,
              provider: "magic_link",
              role: "owner",
            });
            return workspaceId;
          } catch {
            // DB not ready — fall through to fallback
          }
        }
      }
    }
  } catch {
    // cookies not available in this context
  }

  return FALLBACK_WORKSPACE_ID;
});

/**
 * Get the active project ID from cookie, or return the first project's ID.
 * If no projects exist, creates a "Default Project" automatically.
 */
export const getActiveProjectId = cache(async (): Promise<string> => {
  const workspaceId = await getWorkspaceId();
  const cookieStore = await cookies();
  const stored = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value;

  if (stored) {
    const [exists] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, stored))
      .limit(1);
    if (exists) return stored;
  }

  const [firstProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .limit(1);

  if (firstProject) return firstProject.id;

  const inserted = await db.insert(projects).values({
    workspaceId,
    name: "Default Project",
  }).returning();

  return inserted[0].id;
});

async function fetchProjectDomains(projectIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (projectIds.length === 0) return map;

  const workspaceId = await getWorkspaceId();

  const ownBrands = await db
    .select({
      projectId: brands.projectId,
      domains: brands.domains,
    })
    .from(brands)
    .where(and(
      eq(brands.workspaceId, workspaceId),
      eq(brands.isOwn, true),
    ));

  for (const b of ownBrands) {
    if (b.domains && b.domains.length > 0 && !map.has(b.projectId)) {
      map.set(b.projectId, b.domains[0]);
    }
  }
  return map;
}

/**
 * Get all projects for the workspace, including each project's own-brand domain.
 */
export const getAllProjects = cache(async () => {
  const workspaceId = await getWorkspaceId();

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      domain: projects.domain,
      allocatedPrompts: projects.allocatedPrompts,
      allocatedCredits: projects.allocatedCredits,
      frequency: projects.frequency,
      status: projects.status,
      projectType: projects.projectType,
      color: projects.color,
      models: projects.models,
      brandName: projects.brandName,
      location: projects.location,
      language: projects.language,
      timezone: projects.timezone,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(projects.name);

  const domainByProject = await fetchProjectDomains(rows.map(r => r.id));

  return rows.map(p => ({
    ...p,
    domain: domainByProject.get(p.id) ?? p.domain ?? null,
  }));
});

/**
 * Get the active project details, including its own-brand domain.
 */
export const getActiveProject = cache(async () => {
  const projectId = await getActiveProjectId();
  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const domainByProject = await fetchProjectDomains([projectId]);

  return {
    ...project!,
    domain: domainByProject.get(projectId) ?? null,
  };
});

export const WORKSPACE = FALLBACK_WORKSPACE_ID;
