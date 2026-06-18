"use server";

import { db } from "../../db";
import { brands, brandSuggestions } from "../../db/schema";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getActiveProjectId, getWorkspaceId } from "../../lib/project-context";
import {
  retroactiveBrandExtraction,
  retroactiveExtractionAllBrands,
} from "../../lib/retroactive-brand-extraction";

/** Delete pending suggestions whose normalized domain matches any of the given brand domains */
async function dismissSuggestionsByDomains(projectId: string, domains: string[]): Promise<void> {
  if (!domains.length) return;
  const normSet = new Set(
    domains
      .map((d) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim())
      .filter(Boolean)
  );
  if (!normSet.size) return;

  const existing = await db
    .select({ id: brandSuggestions.id, domain: brandSuggestions.domain })
    .from(brandSuggestions)
    .where(eq(brandSuggestions.projectId, projectId));

  const toDelete = existing
    .filter((s) => {
      if (!s.domain) return false;
      const norm = s.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
      return normSet.has(norm);
    })
    .map((s) => s.id);

  if (toDelete.length) {
    await Promise.all(
      toDelete.map((id) => db.delete(brandSuggestions).where(eq(brandSuggestions.id, id)))
    );
  }
}

export async function renameBrand(args: {
  brandId: string;
  displayName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const name = args.displayName.trim();
  if (!name) return { ok: false, error: "Display name is required" };
  if (name.length > 255) return { ok: false, error: "Name too long (max 255 characters)" };

  const projectId = await getActiveProjectId();

  const dup = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.projectId, projectId), eq(brands.name, name), ne(brands.id, args.brandId)))
    .limit(1);
  if (dup.length) return { ok: false, error: `"${name}" already exists in your brand list` };

  await db
    .update(brands)
    .set({ name })
    .where(and(eq(brands.id, args.brandId), eq(brands.projectId, projectId)));

  revalidatePath("/brands");
  revalidatePath("/prompts");
  revalidatePath("/insights");
  return { ok: true };
}

export async function updateBrandDomains(args: {
  brandId: string;
  domains: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const projectId = await getActiveProjectId();
  // Normalize each domain: strip protocol + www, lowercase
  const cleaned = [...new Set(
    args.domains
      .map(d => d.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase())
      .filter(Boolean)
  )];

  await db
    .update(brands)
    .set({ domains: cleaned })
    .where(and(eq(brands.id, args.brandId), eq(brands.projectId, projectId)));

  // Clean up pending suggestions whose domain now matches this brand
  if (cleaned.length) {
    await dismissSuggestionsByDomains(projectId, cleaned);
  }

  revalidatePath("/brands");
  revalidatePath("/prompts");
  revalidatePath("/insights");
  return { ok: true };
}

export async function updateBrandAliases(args: {
  brandId: string;
  aliases: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const projectId = await getActiveProjectId();
  const cleaned = [...new Set(args.aliases.map(a => a.trim()).filter(Boolean))];

  await db
    .update(brands)
    .set({ aliases: cleaned })
    .where(and(eq(brands.id, args.brandId), eq(brands.projectId, projectId)));

  revalidatePath("/brands");
  revalidatePath("/prompts");
  revalidatePath("/insights");
  return { ok: true };
}

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

  // 2. Add to brands table and get the new brand ID
  const [inserted] = await db.insert(brands).values({
    workspaceId: suggestion.workspaceId,
    projectId:   suggestion.projectId,
    name:        suggestion.name,
    isOwn:       false,
    aliases:     [suggestion.name],
    domains:     suggestion.domain ? [suggestion.domain] : [],
  }).returning({ id: brands.id, workspaceId: brands.workspaceId });

  // 3. Retroactively create brandMentions for all past chats that mention this brand
  //    (runs in the background — doesn't block the accept action UI)
  if (inserted) {
    try {
      await retroactiveBrandExtraction({
        projectId: suggestion.projectId,
        brand: {
          id:          inserted.id,
          workspaceId: inserted.workspaceId,
          name:        suggestion.name,
          aliases:     [suggestion.name],
        },
      });
    } catch (err) {
      // Non-fatal: retroactive extraction can fail silently
      console.warn("[retroactive] brand extraction failed:", err);
    }
  }

  // 4. Remove accepted suggestion + clean up any other pending suggestions with the same domain
  await db.delete(brandSuggestions).where(eq(brandSuggestions.id, suggestionId));
  if (suggestion.domain) {
    await dismissSuggestionsByDomains(suggestion.projectId, [suggestion.domain]);
  }

  revalidatePath("/brands");
  revalidatePath("/");
  revalidatePath("/insights");
}

/**
 * Re-process ALL past chats for the active project.
 * Creates brandMentions for all tracked brands that were missed
 * because they weren't tracked when the crawl originally ran.
 */
export async function reprocessAllBrands(): Promise<{
  ok: boolean;
  scanned: number;
  created: number;
  brandsProcessed: number;
  error?: string;
}> {
  try {
    const projectId = await getActiveProjectId();
    const result    = await retroactiveExtractionAllBrands(projectId);
    revalidatePath("/");
    revalidatePath("/insights");
    revalidatePath("/brands");
    return { ok: true, ...result };
  } catch (err) {
    console.error("[reprocessAllBrands]", err);
    return { ok: false, scanned: 0, created: 0, brandsProcessed: 0, error: String(err) };
  }
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

  // Clean up pending suggestions whose domain matches the newly added brand
  if (data.domains.length) {
    await dismissSuggestionsByDomains(data.projectId, data.domains);
  }

  revalidatePath("/brands");
}
