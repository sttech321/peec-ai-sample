"use server";

import { db } from "../../db";
import { projects, topics } from "../../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";
const ACTIVE_PROJECT_COOKIE = "active_project_id";

/**
 * Create a new project and switch to it.
 */
export async function createProject(formData: FormData) {
  const name = formData.get("name") as string;
  if (!name || name.trim() === "") return;

  // Insert project
  const inserted = await db.insert(projects).values({
    workspaceId: WORKSPACE_ID,
    name: name.trim(),
  }).returning();

  const project = inserted[0];

  // Create a default "General" topic for the project
  await db.insert(topics).values({
    workspaceId: WORKSPACE_ID,
    projectId: project.id,
    name: "General Topic",
  });

  // Switch to the new project
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROJECT_COOKIE, project.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  revalidatePath("/", "layout");
}

/**
 * Switch to a different project.
 */
export async function switchProject(projectId: string) {
  // Verify project exists
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
