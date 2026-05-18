/**
 * Generates earned and owned action recommendations from sources/prompt data.
 * Sources are stored without category in the pipeline; we classify by domain here.
 */

// ── Domain classification ─────────────────────────────────────────────────────

const UGC_DOMAINS = new Set([
  "reddit.com", "linkedin.com", "quora.com", "medium.com", "youtube.com",
  "twitter.com", "x.com", "facebook.com", "tiktok.com", "instagram.com",
  "stackoverflow.com", "news.ycombinator.com", "producthunt.com",
  "g2.com", "capterra.com", "glassdoor.com", "trustpilot.com", "yelp.com",
  "tripadvisor.com", "trustradius.com", "gartner.com", "getapp.com",
]);

const REFERENCE_DOMAINS = new Set([
  "wikipedia.org", "en.wikipedia.org", "britannica.com", "investopedia.com",
  "merriam-webster.com", "dictionary.com", "techopedia.com",
]);

export function classifyDomain(domain: string): "ugc" | "reference" | "editorial" {
  const d = domain.toLowerCase();
  if (UGC_DOMAINS.has(d)) return "ugc";
  if (REFERENCE_DOMAINS.has(d)) return "reference";
  return "editorial";
}

// ── Content type inference ────────────────────────────────────────────────────

export function inferContentType(text: string): string {
  const t = text ?? "";
  if (/listicle|top\s+\d+|best\s+\w+\s+(agencies|companies|tools|platforms|services|firms)/i.test(t)) return "Listicle";
  if (/homepage|home page|landing page/i.test(t)) return "Homepage";
  if (/product page|pricing|features/i.test(t)) return "Product Page";
  if (/how[\s-]to|guide|tutorial|step[\s-]by[\s-]step/i.test(t)) return "How-To Guide";
  if (/category page|categories/i.test(t)) return "Category Page";
  if (/comparison|vs\.|versus|compare|alternatives to/i.test(t)) return "Comparison";
  return "Article";
}

// ── Priority calculation ──────────────────────────────────────────────────────

export function calcPriority(retrievals: number, citationCount: number): "High" | "Medium" | "Low" {
  const citationRate = retrievals > 0 ? citationCount / retrievals : 0;
  if (retrievals >= 5 && citationRate >= 0.3) return "High";
  if (retrievals >= 3 || citationRate >= 0.2) return "Medium";
  return "Low";
}

// ── Earned action text ────────────────────────────────────────────────────────

export function earnedActionText(
  url: string,
  domain: string,
  title: string | null,
  category: "ugc" | "reference" | "editorial",
  topQuery: string,
): string {
  const label = title || url;

  if (category === "ugc") {
    if (domain === "reddit.com")
      return `Get your brand mentioned in [${label}]. Or look out for similar content and join those conversations early.`;
    if (domain === "linkedin.com")
      return `Take inspiration from this LinkedIn post [${label}] and create similar content mentioning your own brand.`;
    if (domain === "g2.com" || domain === "capterra.com" || domain === "trustpilot.com")
      return `Create reviews around the topic "${topQuery}" and mention your own brand favorably.`;
    if (domain === "quora.com")
      return `Get your brand mentioned in answers to [${label}]. Or look out for similar questions and answer them early.`;
    if (domain === "medium.com")
      return `Get your brand mentioned in [${label}] and ask them to mention your brand in their articles. Or contribute to their content with helpful comments that mention your brand favorably.`;
    if (domain === "youtube.com")
      return `Get your brand featured in [${label}] and ask them to mention you in their video description or content.`;
    if (domain === "stackoverflow.com")
      return `Get your brand mentioned in answers on [${label}]. Answer similar technical questions early to build your presence.`;
    return `Get your brand mentioned in [${label}]. Look out for similar content and engage early.`;
  }

  if (category === "reference") {
    if (domain.includes("wikipedia"))
      return `Get your own article on [Wikipedia].`;
    return `Get your brand mentioned on [${label}], a trusted reference source that AI models regularly cite.`;
  }

  // Editorial
  const contentType = inferContentType(label);
  if (contentType === "Listicle")
    return `Get featured in [${label}]. Their listicles are regularly cited by LLMs.`;
  if (contentType === "Comparison")
    return `Get featured in [${label}]. Their comparison articles are highly cited by AI models.`;
  if (contentType === "How-To Guide")
    return `Get your brand mentioned in [${label}]. How-to guides like this are trusted by AI as authoritative sources.`;
  return `Contact the author of [${label}] and ask them to mention your brand in their article. Or contribute to their content with helpful comments that mention your brand favorably.`;
}

// ── Owned action text — 3 alternating templates matching peec.ai ──────────────
//  A) "Take inspiration by [type]s around '{query}'… Mention your own brand favorably."
//  B) "Create content similar to [title] on domain.com and other top-performing [type]s."
//  C) "Incorporate '{phrase}'… into the copy of your [page type]."

export function ownedActionText(
  contentType: string,
  topDomain: string,
  query: string,
  templateStyle: "A" | "B" | "C" = "A",
  topSourceTitle?: string,
): string {
  const plural = (t: string) => {
    if (t === "How-To Guide") return "how-to guides";
    if (t === "Category Page") return "category pages";
    if (t === "Product Page") return "product pages";
    if (t === "Homepage") return "homepages";
    return `${t.toLowerCase()}s`;
  };

  if (templateStyle === "B" && topSourceTitle) {
    return `Create content similar to [${topSourceTitle}] on ${topDomain} and other top-performing ${plural(contentType)}.`;
  }

  if (templateStyle === "C") {
    if (contentType === "Homepage")
      return `Incorporate "${query}" and other common phrases into the copy of your homepage.`;
    if (contentType === "Product Page")
      return `Take inspiration by product pages around "${query}" and other common phrases. Mention your own brand favorably on these pages.`;
    return `Take inspiration by ${plural(contentType)} around "${query}" and other common phrases. Mention your own brand favorably in your ${plural(contentType)}.`;
  }

  // Template A (default)
  switch (contentType) {
    case "Listicle":
      return `Take inspiration by articles around "${query}" and other common phrases. Mention your own brand favorably.`;
    case "Homepage":
      return `Incorporate "${query}" and other common phrases into the copy of your homepage.`;
    case "Product Page":
      return `Take inspiration by product pages around "${query}" and other common phrases. Mention your own brand favorably on these pages.`;
    case "How-To Guide":
      return `Take inspiration by how-to guides around "${query}" and other common phrases. Mention your own brand favorably in your how-to guides.`;
    case "Category Page":
      return `Take inspiration by category or tag pages around "${query}" and other common phrases. Mention your own brand favorably on these pages.`;
    case "Comparison":
      return `Take inspiration by comparison pages around "${query}" and other common phrases. Mention your own brand favorably.`;
    default:
      return `Take inspiration by articles around "${query}" and other common phrases. Mention your own brand favorably.`;
  }
}
