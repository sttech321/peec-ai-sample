"use server";

import { db } from "../../db";
import { projects, topics } from "../../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getWorkspaceId } from "../../lib/project-context";

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
