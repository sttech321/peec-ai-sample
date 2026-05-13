import { db } from "../db";
import { brands, tags } from "../db/schema";
import { eq } from "drizzle-orm";

// Fixed overrides for well-known brands where the obvious "name.com" guess
// would be wrong. Kept in sync with the version in app/prompts/page.tsx.
const BRAND_DOMAIN_OVERRIDES: Record<string, string> = {
  "google analytics": "analytics.google.com",
  "google ads": "ads.google.com",
  "google search console": "search.google.com",
  youtube: "youtube.com",
  "facebook ads": "facebook.com",
  "meta ads": "meta.com",
  "microsoft ads": "ads.microsoft.com",
  "bing ads": "ads.microsoft.com",
  chatgpt: "chatgpt.com",
  claude: "claude.ai",
  perplexity: "perplexity.ai",
  gemini: "gemini.google.com",
  "ai overview": "google.com",
  "ai overviews": "google.com",
  "ai mode": "google.com",
};

export function guessBrandDomain(name: string): string {
  const key = name.trim().toLowerCase();
  if (BRAND_DOMAIN_OVERRIDES[key]) return BRAND_DOMAIN_OVERRIDES[key];
  const cleaned = key
    .replace(/\b(inc|llc|ltd|corp|co|gmbh)\.?$/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
  if (!cleaned) return `${key.replace(/\s+/g, "")}.com`;
  return `${cleaned}.com`;
}

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

  // Note: don't select tags.color — column not in live DB. Derive client-side.
  const tagRows = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.projectId, projectId))
    .orderBy(tags.name);

  const availableTags = tagRows.map((t) => ({
    id: t.id,
    name: t.name,
    color: deriveTagColor(t.name),
  }));

  return { projectBrands, availableTags };
}
