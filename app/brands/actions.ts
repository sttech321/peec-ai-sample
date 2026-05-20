"use server";

import { db } from "../../db";
import { brands, brandSuggestions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function deleteBrand(brandId: string) {
  await db.delete(brands).where(eq(brands.id, brandId));
  revalidatePath("/brands");
}

export async function acceptSuggestion(suggestionId: string) {
  // 1. Get suggestion data
  const [suggestion] = await db
    .select()
    .from(brandSuggestions)
    .where(eq(brandSuggestions.id, suggestionId))
    .limit(1);

  if (!suggestion) return;

  // 2. Add to brands table
  await db.insert(brands).values({
    workspaceId: suggestion.workspaceId,
    projectId: suggestion.projectId,
    name: suggestion.name,
    isOwn: false,
    aliases: [suggestion.name],
    domains: suggestion.domain ? [suggestion.domain] : [],
  });

  // 3. Remove from suggestions
  await db.delete(brandSuggestions).where(eq(brandSuggestions.id, suggestionId));

  revalidatePath("/brands");
}

export async function rejectSuggestion(suggestionId: string) {
  await db.delete(brandSuggestions).where(eq(brandSuggestions.id, suggestionId));
  revalidatePath("/brands");
}

export async function createBrand(data: {
  projectId: string;
  workspaceId: string;
  name: string;
  isOwn?: boolean;
  aliases: string[];
  domains: string[];
}) {
  await db.insert(brands).values({
    projectId: data.projectId,
    workspaceId: data.workspaceId,
    name: data.name,
    isOwn: data.isOwn ?? false,
    aliases: data.aliases,
    domains: data.domains,
  });
  revalidatePath("/brands");
}
