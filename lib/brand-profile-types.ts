// Strict shape for the JSON payload stored in brand_profiles.data.
// Server and client share this contract.

export interface BrandService {
  id: string;
  name: string;
  category: string;
  description: string;
  keywords: string[];
}

export interface AudienceSlice {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  weight: number; // 0-100
}

export interface BrandProfile {
  // Hero
  companyName: string;
  domain: string;
  logoEmoji: string;
  bannerColor: string; // hex or css gradient

  // Section 1
  description: string;

  // Section 2
  industry: string;

  // Section 3
  identityTraits: string[];

  // Section 4
  services: BrandService[];

  // Section 5 — Target audience (kept for setup wizard compat; not shown on profile page)
  audienceTypes: string[];
  businessSize: string;
  regions: string[];
  buyerPersonas: string[];

  // Section 6 — Target markets (ISO 3166-1 alpha-2 country codes, e.g. "US", "GB")
  targetMarkets: string[];

  // Section 7 — Legacy fields, kept for backward compatibility but not surfaced in UI
  competitors: string[];
  keyTopics: string[];
  excludedTopics: string[];
  preferredPositioning: string;
  toneOfVoice: string;
  goals: string[];

  // Audience distribution (matches Peec's 3 default personas; user can edit weights)
  audienceDistribution: AudienceSlice[];
}

export const DEFAULT_AUDIENCE_DISTRIBUTION: AudienceSlice[] = [
  { id: "simple", label: "Simple recommendation seeker", description: "Casual, non-technical. Seeks a unique name.", enabled: true, weight: 40 },
  { id: "informed", label: "Informed shopper", description: "Knows product, asks about features.", enabled: true, weight: 40 },
  { id: "evaluative", label: "Evaluative researcher", description: "Weighs tradeoffs, explores a decision space.", enabled: true, weight: 20 },
];

export const EMPTY_BRAND_PROFILE: BrandProfile = {
  companyName: "",
  domain: "",
  logoEmoji: "🏢",
  bannerColor: "#a16f3f",
  description: "",
  industry: "",
  identityTraits: [],
  services: [],
  audienceTypes: [],
  businessSize: "",
  regions: [],
  buyerPersonas: [],
  targetMarkets: [],
  competitors: [],
  keyTopics: [],
  excludedTopics: [],
  preferredPositioning: "",
  toneOfVoice: "",
  goals: [],
  audienceDistribution: DEFAULT_AUDIENCE_DISTRIBUTION,
};

export const INDUSTRY_OPTIONS = [
  "Marketing", "SaaS", "Ecommerce", "Healthcare", "Finance",
  "Education", "AI", "Cybersecurity", "Hospitality", "Real Estate",
  "Fitness", "Legal", "Media", "Manufacturing", "Logistics",
  "Travel", "Food & Beverage", "Energy", "Government", "Other",
];

export const TRAIT_SUGGESTIONS = [
  "Transparent", "Innovative", "Reliable", "Strategy-first", "Results-driven",
  "Technical", "Premium", "Friendly", "Authoritative", "Customer-focused",
  "Data-driven", "Agile", "Trusted", "Bold", "Pragmatic",
];

export const BUSINESS_SIZES = [
  "Solopreneur", "Small Business (1-50)", "Mid-market (51-500)", "Enterprise (500+)",
];

export const TONE_OPTIONS = [
  "Authoritative", "Friendly", "Technical", "Executive",
  "Educational", "Conversational", "Witty", "Formal",
];

export const GOAL_OPTIONS = [
  "Increase AI citations",
  "Improve GEO rankings",
  "Track competitor mentions",
  "Improve AI recommendations",
  "Discover content gaps",
  "Improve brand sentiment",
];

export const REGION_OPTIONS = [
  "United States", "Canada", "United Kingdom", "Germany", "France",
  "Spain", "Italy", "Netherlands", "Australia", "India",
  "Japan", "Singapore", "Brazil", "Mexico", "UAE",
];

export function mergeBrandProfile(stored: Partial<BrandProfile> | null | undefined): BrandProfile {
  if (!stored) return EMPTY_BRAND_PROFILE;
  return {
    ...EMPTY_BRAND_PROFILE,
    ...stored,
    identityTraits: stored.identityTraits ?? [],
    services: stored.services ?? [],
    audienceTypes: stored.audienceTypes ?? [],
    regions: stored.regions ?? [],
    buyerPersonas: stored.buyerPersonas ?? [],
    targetMarkets: stored.targetMarkets ?? [],
    competitors: stored.competitors ?? [],
    keyTopics: stored.keyTopics ?? [],
    excludedTopics: stored.excludedTopics ?? [],
    goals: stored.goals ?? [],
    audienceDistribution: stored.audienceDistribution?.length
      ? stored.audienceDistribution
      : DEFAULT_AUDIENCE_DISTRIBUTION,
  };
}

// ISO 3166-1 alpha-2 country codes mapped to display names.
// Subset of common markets — extend as needed.
export const COUNTRY_OPTIONS: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "MX", name: "Mexico" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "GR", name: "Greece" },
  { code: "CZ", name: "Czechia" },
  { code: "RO", name: "Romania" },
  { code: "TR", name: "Turkey" },
  { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "PH", name: "Philippines" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" },
  { code: "TW", name: "Taiwan" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "AE", name: "UAE" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "IL", name: "Israel" },
  { code: "EG", name: "Egypt" },
  { code: "ZA", name: "South Africa" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "MA", name: "Morocco" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "PE", name: "Peru" },
];
