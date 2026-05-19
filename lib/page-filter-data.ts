import { db } from "../db";
import { brands, tags } from "../db/schema";
import { eq } from "drizzle-orm";
import { guessBrandDomain } from "./brand-domain";
export { guessBrandDomain };

const TAG_PALETTE = [
  "gray",
  "blue",
  "indigo",
  "violet",
  "purple",
  "pink",
  "emerald",
  "teal",
  "cyan",
  "amber",
  "orange",
];

export function deriveTagColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

/**
 * Returns the brands and tags needed by `PageFilterBar` for a given project.
 * Brands include a domain (real if present, otherwise guessed from the name)
 * so favicons can render in the filter dropdown.
 */
export async function getPageFilterData(projectId: string) {
  const projectBrandsRaw = await db
    .select({
      id: brands.id,
      name: brands.name,
      isOwn: brands.isOwn,
      domains: brands.domains,
    })
    .from(brands)
    .where(eq(brands.projectId, projectId))
    .orderBy(brands.name);

  const projectBrands = projectBrandsRaw.map((b) => ({
    id: b.id,
    name: b.name,
    isOwn: b.isOwn,
    domain: b.domains?.[0] ?? guessBrandDomain(b.name),
  }));

  const tagRows = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(tags)
    .where(eq(tags.projectId, projectId))
    .orderBy(tags.name);

  const availableTags = tagRows.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color || "gray",
  }));

  return { projectBrands, availableTags };
}
