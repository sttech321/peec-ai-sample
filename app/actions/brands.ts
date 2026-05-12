"use server";

import { db } from "../../db";
import { brands } from "../../db/schema";
import { and, eq } from "drizzle-orm";
import { getActiveProjectId, WORKSPACE } from "../../lib/project-context";
import { revalidatePath } from "next/cache";

export async function addBrand(name: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Brand name is required" };
  if (trimmed.length > 255) return { ok: false, error: "Brand name too long" };

  const projectId = await getActiveProjectId();

  const existing = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.projectId, projectId), eq(brands.name, trimmed)))
    .limit(1);
  if (existing.length) return { ok: false, error: "Brand already exists" };

  await db.insert(brands).values({
    workspaceId: WORKSPACE,
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
