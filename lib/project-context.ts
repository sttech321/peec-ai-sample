import { cookies } from "next/headers";
import { db } from "../db";
import { projects, brands } from "../db/schema";
import { and, eq } from "drizzle-orm";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";
const ACTIVE_PROJECT_COOKIE = "active_project_id";

/**
 * Get the active project ID from cookie, or return the first project's ID.
 * If no projects exist, creates a "Default Project" automatically.
 */
export async function getActiveProjectId(): Promise<string> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value;

  if (stored) {
    // Verify it still exists
    const [exists] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, stored))
      .limit(1);
    if (exists) return stored;
  }

  // Fallback: get first project or create default
  const [firstProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.workspaceId, WORKSPACE_ID))
    .limit(1);

  if (firstProject) return firstProject.id;

  // No projects exist — create default
  const inserted = await db.insert(projects).values({
    workspaceId: WORKSPACE_ID,
    name: "Default Project",
  }).returning();

  return inserted[0].id;
}

/**
 * Look up the "own" brand domain for each project ID.
 */
async function fetchProjectDomains(projectIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (projectIds.length === 0) return map;

  const ownBrands = await db
    .select({
      projectId: brands.projectId,
      domains: brands.domains,
    })
    .from(brands)
    .where(and(
      eq(brands.workspaceId, WORKSPACE_ID),
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
 * Get all projects for the workspace, including each project's own-brand domain
 * (used to render a favicon in the project switcher).
 */
export async function getAllProjects() {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.workspaceId, WORKSPACE_ID))
    .orderBy(projects.name);

  const domainByProject = await fetchProjectDomains(rows.map(r => r.id));

  return rows.map(p => ({
    ...p,
    domain: domainByProject.get(p.id) ?? null,
  }));
}

/**
 * Get the active project details, including its own-brand domain.
 */
export async function getActiveProject() {
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
}

export const WORKSPACE = WORKSPACE_ID;
