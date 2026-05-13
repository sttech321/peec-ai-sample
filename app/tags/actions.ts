"use server";

import { db } from "../../db";
import { tags, promptTags } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/** Fetch tags for a project with real usage counts from promptTags. */
export async function getTags(projectId: string) {
  return db
    .select({
      id: tags.id,
      workspaceId: tags.workspaceId,
      projectId: tags.projectId,
      name: tags.name,
      slug: tags.slug,
      color: tags.color,
      usageCount: sql<number>`cast(count(${promptTags.id}) as int)`,
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
    })
    .from(tags)
    .leftJoin(promptTags, eq(promptTags.tagId, tags.id))
    .where(eq(tags.projectId, projectId))
    .groupBy(
      tags.id,
      tags.workspaceId,
      tags.projectId,
      tags.name,
      tags.slug,
      tags.color,
      tags.createdAt,
      tags.updatedAt,
    )
    .orderBy(sql`count(${promptTags.id}) desc`);
}

export async function createTag(data: {
  projectId: string;
  workspaceId: string;
  name: string;
  color?: string;
}) {
  const slug = data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  await db.insert(tags).values({
    projectId: data.projectId,
    workspaceId: data.workspaceId,
    name: data.name,
    slug,
    color: data.color ?? "gray",
  });
  revalidatePath("/tags");
  revalidatePath("/prompts");
}

export async function updateTag(id: string, data: {
  name?: string;
  color?: string;
}) {
  await db.update(tags).set(data).where(eq(tags.id, id));
  revalidatePath("/tags");
  revalidatePath("/prompts");
}

export async function deleteTag(id: string) {
  await db.delete(tags).where(eq(tags.id, id));
  revalidatePath("/tags");
  revalidatePath("/prompts");
}
