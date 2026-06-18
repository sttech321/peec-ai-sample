import { BrandProfile, EMPTY_BRAND_PROFILE } from "./brand-profile-types";
import { countries as CL_COUNTRIES, languages as CL_LANGUAGES } from "countries-list";

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
  // Keep the default time zone consistent with the default location above
  // (United States → America/New_York) so it's correct on the very first load.
  timezone: "America/New_York",
  profile: EMPTY_BRAND_PROFILE,
  topics: [],
};

// Full country + language lists sourced from the `countries-list` package
// (alpha-2 code + English name), sorted alphabetically by name.
export const COUNTRIES: { code: string; name: string }[] = Object.entries(CL_COUNTRIES)
  .map(([code, c]) => ({ code, name: c.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const LANGUAGES: { code: string; name: string }[] = Object.entries(CL_LANGUAGES)
  .map(([code, l]) => ({ code, name: l.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

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

// Full IANA time-zone list from the runtime (Intl). `countries-list` carries no
// time-zone data, so we use the built-in Intl catalogue; falls back to the
// common list on older runtimes that lack supportedValuesOf.
export const ALL_TIMEZONES: string[] = (() => {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    if (typeof intl.supportedValuesOf === "function") {
      const zones = intl.supportedValuesOf("timeZone");
      if (Array.isArray(zones) && zones.length > 0) return zones;
    }
  } catch {
    /* ignore — fall through to COMMON_TIMEZONES */
  }
  return COMMON_TIMEZONES;
})();

// Primary IANA time zone per country (alpha-2), for countries where the
// capital-derived guess doesn't resolve to a canonical zone. The remaining
// countries are handled by the Continent/Capital guess below.
export const COUNTRY_TIMEZONES: Record<string, string> = {
  AC: "Atlantic/St_Helena", AD: "Europe/Andorra", AE: "Asia/Dubai", AG: "America/Antigua",
  AI: "America/Anguilla", AL: "Europe/Tirane", AU: "Australia/Sydney", AW: "America/Aruba",
  BB: "America/Barbados", BH: "Asia/Bahrain", BI: "Africa/Bujumbura", BJ: "Africa/Porto-Novo",
  BL: "America/St_Barthelemy", BM: "Atlantic/Bermuda", BN: "Asia/Brunei", BO: "America/La_Paz",
  BR: "America/Sao_Paulo", BZ: "America/Belize", CA: "America/Toronto", CC: "Indian/Cocos",
  CH: "Europe/Zurich", CI: "Africa/Abidjan", CK: "Pacific/Rarotonga", CM: "Africa/Douala",
  CN: "Asia/Shanghai", CO: "America/Bogota", CR: "America/Costa_Rica", CV: "Atlantic/Cape_Verde",
  CW: "America/Curacao", CX: "Indian/Christmas", CY: "Asia/Nicosia", DM: "America/Dominica",
  EC: "America/Guayaquil", EH: "Africa/El_Aaiun", ER: "Africa/Asmara", FJ: "Pacific/Fiji",
  FK: "Atlantic/Stanley", FM: "Pacific/Pohnpei", FO: "Atlantic/Faroe", GD: "America/Grenada",
  GG: "Europe/Guernsey", GL: "America/Nuuk", GP: "America/Guadeloupe", GS: "Atlantic/South_Georgia",
  GT: "America/Guatemala", GU: "Pacific/Guam", GY: "America/Guyana", HK: "Asia/Hong_Kong",
  HT: "America/Port-au-Prince", IM: "Europe/Isle_of_Man", IN: "Asia/Kolkata", IO: "Indian/Chagos",
  IS: "Atlantic/Reykjavik", JE: "Europe/Jersey", JM: "America/Jamaica", KI: "Pacific/Tarawa",
  KM: "Indian/Comoro", KN: "America/St_Kitts", KW: "Asia/Kuwait", KY: "America/Cayman",
  KZ: "Asia/Almaty", LC: "America/St_Lucia", MA: "Africa/Casablanca", MD: "Europe/Chisinau",
  MG: "Indian/Antananarivo", MM: "Asia/Yangon", MN: "Asia/Ulaanbaatar", MO: "Asia/Macau",
  MQ: "America/Martinique", MS: "America/Montserrat", MT: "Europe/Malta", MU: "Indian/Mauritius",
  MV: "Indian/Maldives", MW: "Africa/Blantyre", NC: "Pacific/Noumea", NF: "Pacific/Norfolk",
  NG: "Africa/Lagos", NP: "Asia/Kathmandu", NR: "Pacific/Nauru", NU: "Pacific/Niue",
  NZ: "Pacific/Auckland", PA: "America/Panama", PF: "Pacific/Tahiti", PK: "Asia/Karachi",
  PM: "America/Miquelon", PN: "Pacific/Pitcairn", PR: "America/Puerto_Rico", PS: "Asia/Gaza",
  PW: "Pacific/Palau", PY: "America/Asuncion", QA: "Asia/Qatar", RE: "Indian/Reunion",
  RU: "Europe/Moscow", SB: "Pacific/Guadalcanal", SC: "Indian/Mahe", SH: "Atlantic/St_Helena",
  SJ: "Arctic/Longyearbyen", SM: "Europe/San_Marino", ST: "Africa/Sao_Tome", SV: "America/El_Salvador",
  SX: "America/Lower_Princes", SZ: "Africa/Mbabane", TA: "Atlantic/St_Helena", TC: "America/Grand_Turk",
  TD: "Africa/Ndjamena", TF: "Indian/Kerguelen", TG: "Africa/Lome", TL: "Asia/Dili",
  TO: "Pacific/Tongatapu", TR: "Europe/Istanbul", TZ: "Africa/Dar_es_Salaam", UA: "Europe/Kyiv",
  US: "America/New_York", VA: "Europe/Vatican", VC: "America/St_Vincent", VG: "America/Tortola",
  VI: "America/St_Thomas", VN: "Asia/Ho_Chi_Minh", VU: "Pacific/Efate", WF: "Pacific/Wallis",
  XK: "Europe/Belgrade", YE: "Asia/Aden", YT: "Indian/Mayotte", ZA: "Africa/Johannesburg",
};

// Some runtimes' Intl catalogue lists the older alias instead of the modern
// canonical name — map modern → legacy so we always pick a *supported* zone.
const TZ_ALIASES: Record<string, string> = {
  "Asia/Kolkata": "Asia/Calcutta",
  "Europe/Kyiv": "Europe/Kiev",
  "Asia/Yangon": "Asia/Rangoon",
  "Asia/Kathmandu": "Asia/Katmandu",
  "Asia/Ho_Chi_Minh": "Asia/Saigon",
  "America/Nuuk": "America/Godthab",
  "Atlantic/Faroe": "Atlantic/Faeroe",
  "Pacific/Pohnpei": "Pacific/Ponape",
  "Africa/Asmara": "Africa/Asmera",
};

// Map a countries-list continent code to its IANA time-zone prefix.
const CONTINENT_TZ_PREFIX: Record<string, string> = {
  AF: "Africa", AS: "Asia", EU: "Europe", NA: "America", SA: "America", OC: "Pacific", AN: "Antarctica",
};
const SUPPORTED_TZ = new Set(ALL_TIMEZONES);

/** Return `zone` if this runtime supports it, else its legacy alias, else null. */
function resolveSupportedZone(zone: string | null): string | null {
  if (!zone) return null;
  if (SUPPORTED_TZ.has(zone)) return zone;
  const alias = TZ_ALIASES[zone];
  return alias && SUPPORTED_TZ.has(alias) ? alias : null;
}

/** Resolve the default time zone for a country *name* (as stored in `location`).
 *  Uses the explicit primary-zone map, then a "Continent/Capital" guess derived
 *  from countries-list — both validated against the runtime zone list. Returns
 *  null when nothing matches so callers can leave the time zone untouched. */
export function timezoneForCountryName(name: string): string | null {
  const country = COUNTRIES.find((c) => c.name === name);
  if (!country) return null;

  // 1. Explicit primary-zone override (canonical, alias-resolved).
  const override = resolveSupportedZone(COUNTRY_TIMEZONES[country.code] ?? null);
  if (override) return override;

  // 2. Best-guess "Continent/Capital" from countries-list, validated.
  const data = CL_COUNTRIES[country.code as keyof typeof CL_COUNTRIES];
  if (data?.capital) {
    const prefix = CONTINENT_TZ_PREFIX[data.continent];
    if (prefix) {
      const candidate = `${prefix}/${data.capital.trim().replace(/\s+/g, "_").replace(/[^A-Za-z_]/g, "")}`;
      if (SUPPORTED_TZ.has(candidate)) return candidate;
    }
  }
  return null;
}

/** Resolve the default language *name* for a country (as stored in `location`).
 *  Prefers the country's first non-English official language (so e.g. Pakistan →
 *  Urdu, India → Hindi), falling back to its first listed language. Returns null
 *  when the country has no usable language so callers can leave it untouched. */
export function languageForCountryName(name: string): string | null {
  const country = COUNTRIES.find((c) => c.name === name);
  if (!country) return null;
  const data = CL_COUNTRIES[country.code as keyof typeof CL_COUNTRIES];
  const codes: string[] = Array.isArray(data?.languages) ? data.languages : [];
  const langs = CL_LANGUAGES as Record<string, { name: string }>;
  const pick = codes.find((c) => c !== "en" && langs[c]) ?? codes.find((c) => langs[c]);
  return pick ? langs[pick].name : null;
}

export function tzOffset(tz: string): string {
  try {
    // "longOffset" → "GMT+05:30" (zero-padded, with colon). Matches Peec's "UTC+05:30".
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    });
    const parts = fmt.formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return offset.replace("GMT", "UTC") || "UTC";
  } catch {
    return "";
  }
}

/** Friendly time-zone label, e.g. "Asia/Calcutta" → "India Standard Time (Calcutta)". */
export function tzLabel(tz: string): string {
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  try {
    const long = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? "";
    return long ? `${long} (${city})` : city;
  } catch {
    return city;
  }
}

export const MAX_TOPICS = 10;
export const MIN_TOPICS = 1;
export const MAX_PROMPTS_PER_TOPIC = 8;
