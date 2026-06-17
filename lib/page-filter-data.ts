import { db } from "../db";
import { brands, tags, topics } from "../db/schema";
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
    id: String(b.id),
    name: String(b.name),
    isOwn: b.isOwn === true,
    // Safely extract first domain — Drizzle array columns can return
    // internal objects in some edge cases, so we validate the type explicitly.
    domain: (Array.isArray(b.domains) && typeof b.domains[0] === "string")
      ? b.domains[0]
      : guessBrandDomain(String(b.name)),
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

  const topicRows = await db
    .select({ id: topics.id, name: topics.name })
    .from(topics)
    .where(eq(topics.projectId, projectId))
    .orderBy(topics.name);

  const availableTopics = topicRows.map((t) => ({ id: t.id, name: t.name }));

  return { projectBrands, availableTags, availableTopics };
}
