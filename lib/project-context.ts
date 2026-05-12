import { cookies } from "next/headers";
import { db } from "../db";
import { projects } from "../db/schema";
import { eq } from "drizzle-orm";

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
 * Get all projects for the workspace.
 */
export async function getAllProjects() {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.workspaceId, WORKSPACE_ID))
    .orderBy(projects.name);
}

/**
 * Get the active project details.
 */
export async function getActiveProject() {
  const projectId = await getActiveProjectId();
  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return project!;
}

export const WORKSPACE = WORKSPACE_ID;
