import { BrandProfile, EMPTY_BRAND_PROFILE } from "./brand-profile-types";

export type SetupStep = 1 | 2 | "generating" | 3 | 4;

export interface SetupTopic {
  id: string;
  name: string;
  prompts: SetupPrompt[];
  custom?: boolean;
  selected: boolean;
}

export interface SetupPrompt {
  id: string;
  text: string;
  selected: boolean;
  custom?: boolean;
}

export interface SetupState {
  step: SetupStep;
  // Step 1
  url: string;
  brandName: string;
  location: string;
  language: string;
  timezone: string;
  // Step 2 — reuses BrandProfile
  profile: BrandProfile;
  // Step 3 & 4 — generated then user-edited
  topics: SetupTopic[];
}

export const INITIAL_SETUP_STATE: SetupState = {
  step: 1,
  url: "",
  brandName: "",
  location: "United States",
  language: "English",
  timezone: typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC",
  profile: EMPTY_BRAND_PROFILE,
  topics: [],
};

export const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "AE", name: "UAE", flag: "🇦🇪" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
];

export const LANGUAGES: { code: string; name: string; flag: string }[] = [
  { code: "en", name: "English", flag: "🌐" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "ar", name: "Arabic", flag: "🇦🇪" },
];

export const COMMON_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Calcutta",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function tzOffset(tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = fmt.formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return offset.replace("GMT", "UTC");
  } catch {
    return "";
  }
}

export const MAX_TOPICS = 10;
export const MIN_TOPICS = 1;
export const MAX_PROMPTS_PER_TOPIC = 8;
