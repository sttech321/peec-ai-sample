// Pure helpers for guessing a brand's primary domain from its display name.
// No DB or Node-only imports — safe to import from client components.

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
