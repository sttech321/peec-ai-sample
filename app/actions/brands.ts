"use server";

import { db } from "../../db";
import { brands, projects } from "../../db/schema";
import { and, eq } from "drizzle-orm";
import { getActiveProjectId, getWorkspaceId } from "../../lib/project-context";
import { revalidatePath } from "next/cache";

export async function addBrand(name: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Brand name is required" };
  if (trimmed.length > 255) return { ok: false, error: "Brand name too long" };

  const projectId = await getActiveProjectId();
  const workspaceId = await getWorkspaceId();

  const existing = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.projectId, projectId), eq(brands.name, trimmed)))
    .limit(1);
  if (existing.length) return { ok: false, error: "Brand already exists" };

  await db.insert(brands).values({
    workspaceId,
    projectId,
    name: trimmed,
    isOwn: false,
    aliases: [],
    domains: [],
  });

  revalidatePath("/");
  revalidatePath("/prompts");
  return { ok: true };
}

export async function markBrandAsOwn(brandId: string): Promise<{ ok: boolean; error?: string }> {
  const projectId = await getActiveProjectId();
  const workspaceId = await getWorkspaceId();

  const [existing] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.projectId, projectId)))
    .limit(1);

  if (!existing) return { ok: false, error: "Brand not found" };

  await db.update(brands)
    .set({ isOwn: true })
    .where(and(eq(brands.id, brandId), eq(brands.workspaceId, workspaceId)));

  revalidatePath("/");
  revalidatePath("/prompts");
  return { ok: true };
}

/**
 * Save brand filter state (hidden brand IDs) to the project in DB.
 * hiddenBrandIds = null  → all brands visible (reset / empty array)
 * hiddenBrandIds = [...] → these brand IDs are hidden
 */
export async function updateBrandFilter(
  hiddenBrandIds: string[] | null,
): Promise<{ ok: boolean; error?: string }> {
  const projectId = await getActiveProjectId();
  const workspaceId = await getWorkspaceId();

  await db
    .update(projects)
    .set({ hiddenBrandIds: hiddenBrandIds ?? [] })
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)));

  return { ok: true };
}
