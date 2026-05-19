// Mock data for Earned / Owned / Impact pages.
// Used as a fallback when the project has no DB rows yet.

// ── Earned ───────────────────────────────────────────────────────────────────

export interface MockEarnedAction {
  id: string;
  type: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  sourceUrl: string | null;
  sourceDomain: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const D = new Date();

export const MOCK_EARNED_ACTIONS: MockEarnedAction[] = [
  // ── reddit.com (UGC, 3) ───────────────────────────────────────────────────
  {
    id: "m-e-01", type: null, title: "Reddit mention",
    description: "Get your brand mentioned in [Can anyone recommend marketing agencies or SaaS with expertise in ai search optimization in 2026]. Or look out for similar content and join those conversations early.",
    priority: "Medium", status: "todo",
    sourceUrl: "https://reddit.com/r/DigitalMarketing/comments/1b7l0da/can_anyone_recommend_marketing_agencies_or_saas/",
    sourceDomain: "reddit.com", createdAt: D, updatedAt: D,
  },
  {
    id: "m-e-02", type: null, title: "Participate in SocialMediaMarketing",
    description: "Participate in [r/SocialMediaMarketing] and mention your own brand favorably.",
    priority: "Medium", status: "todo",
    sourceUrl: "https://reddit.com/r/SocialMediaMarketing",
    sourceDomain: "reddit.com", createdAt: D, updatedAt: D,
  },
  {
    id: "m-e-03", type: null, title: "Reddit posts about Best saas seo",
    description: "Create posts around the topic \"Best saas seo\" and mention your own brand favorably.",
    priority: "Medium", status: "todo",
    sourceUrl: "https://reddit.com/r/growthhacking/",
    sourceDomain: "reddit.com", createdAt: D, updatedAt: D,
  },
  // ── Listicle (Editorial, 2) ───────────────────────────────────────────────
  {
    id: "m-e-04", type: "Listicle", title: "Get featured on Forbes",
    description: "Get featured in [forbes.com]. Their listicles are regularly cited by LLMs.",
    priority: "Medium", status: "todo",
    sourceUrl: "https://forbes.com/advisor/business/best-marketing-agencies/",
    sourceDomain: null, createdAt: D, updatedAt: D,
  },
  {
    id: "m-e-05", type: "Listicle", title: "Contact GEO listicle author",
    description: "Contact the author of [Who are the Leading Generative Engine Optimization(GEO) Companies?] on justcreateapp.com to be included in their listicle.",
    priority: "Medium", status: "todo",
    sourceUrl: "https://justcreateapp.com/blog/leading-geo-companies/",
    sourceDomain: null, createdAt: D, updatedAt: D,
  },
  // ── wikipedia.org (Reference, 1) ─────────────────────────────────────────
  {
    id: "m-e-06", type: "Reference", title: "Create Wikipedia article",
    description: "Get your own article on [Wikipedia].",
    priority: "Low", status: "todo",
    sourceUrl: "https://en.wikipedia.org/wiki/Main_Page",
    sourceDomain: null, createdAt: D, updatedAt: D,
  },
  // ── medium.com (UGC, 2) ───────────────────────────────────────────────────
  {
    id: "m-e-07", type: null, title: "Medium SEO Firms mention",
    description: "Get your brand mentioned in [Best US-Based SEO Firms for Landscapers in 2024] - either directly in the article or via a comment.",
    priority: "Low", status: "todo",
    sourceUrl: "https://medium.com/@seoadvice/best-us-based-seo-firms-for-landscapers",
    sourceDomain: "medium.com", createdAt: D, updatedAt: D,
  },
  {
    id: "m-e-08", type: null, title: "Contact Medium author",
    description: "Contact @stoufferak on Medium and ask them to mention your brand in their articles. Or contribute to their content with helpful comments that mention your brand favorably.",
    priority: "Low", status: "todo",
    sourceUrl: "https://medium.com/@stoufferak",
    sourceDomain: "medium.com", createdAt: D, updatedAt: D,
  },
  // ── g2.com (UGC, 2) ──────────────────────────────────────────────────────
  {
    id: "m-e-09", type: null, title: "G2 PPC review inspiration",
    description: "Take inspiration from this review [7 Best PPC Agencies for 2026: My Top Picks] on g2.com and create a similar review or take part in it mentioning your own brand favorably.",
    priority: "Low", status: "todo",
    sourceUrl: "https://g2.com/articles/best-ppc-agencies",
    sourceDomain: "g2.com", createdAt: D, updatedAt: D,
  },
  {
    id: "m-e-10", type: null, title: "G2 reviews around best ppc agencies",
    description: "Create reviews around the topic \"Best ppc agencies 2026 top\" and mention your own brand favorably.",
    priority: "Low", status: "todo",
    sourceUrl: null,
    sourceDomain: "g2.com", createdAt: D, updatedAt: D,
  },
  // ── linkedin.com (UGC, 1) ─────────────────────────────────────────────────
  {
    id: "m-e-11", type: null, title: "LinkedIn AI Optimization article",
    description: "Take inspiration from [AI Optimization Agencies: Who Can Rank Your Brand on ChatGPT and Other LLMs]. Can you create similar content?",
    priority: "Low", status: "todo",
    sourceUrl: "https://linkedin.com/pulse/ai-optimization-agencies-rank-brand-chatgpt-llms/",
    sourceDomain: "linkedin.com", createdAt: D, updatedAt: D,
  },
  // ── quora.com (UGC, 1) ────────────────────────────────────────────────────
  {
    id: "m-e-12", type: null, title: "Quora AI SEO agencies",
    description: "Get your brand mentioned in answers to [What are some AI SEO agencies? - Quora]. Or look out for similar questions and answer them early.",
    priority: "Low", status: "todo",
    sourceUrl: "https://quora.com/What-are-some-AI-SEO-agencies",
    sourceDomain: "quora.com", createdAt: D, updatedAt: D,
  },
  // ── Article (Editorial, 2) ───────────────────────────────────────────────
  {
    id: "m-e-13", type: "Article", title: "Get featured in mycarrollcountynews",
    description: "Get featured in mycarrollcountynews.com. Their articles are regularly cited by LLMs.",
    priority: "Low", status: "todo",
    sourceUrl: "https://mycarrollcountynews.com/",
    sourceDomain: null, createdAt: D, updatedAt: D,
  },
  {
    id: "m-e-14", type: "Article", title: "Contact stgeorgeutah article author",
    description: "Contact the author of [Top 5 Utah SEO companies] on stgeorgeutah.com to be included in their article.",
    priority: "Low", status: "todo",
    sourceUrl: "https://stgeorgeutah.com/news/archive/2024/11/top-5-utah-seo-companies/",
    sourceDomain: null, createdAt: D, updatedAt: D,
  },
];

// Mock sources by group (used in the domain/type drill-down)
export const MOCK_SOURCES_MAP: Record<string, { title: string; url: string; domain: string; retrievals: number; citationRate: number }[]> = {
  "reddit.com": [
    { title: "Can anyone recommend marketing agencies or SaaS with expertise in ai search optim...", url: "reddit.com/r/DigitalMarketing/comments/1b7l0da/can_anyone_recommend_marketing_a...", domain: "reddit.com", retrievals: 7, citationRate: 0.5 },
    { title: "What are some trusted legit A+ social media marketing agencies?", url: "reddit.com/r/SocialMediaMarketing/comments/1ab23cd/what_are_some_trusted_legit...", domain: "reddit.com", retrievals: 6, citationRate: 0.4 },
    { title: "Are the top SEO agencies right now that actually deliver results?", url: "reddit.com/r/growthhacking/comments/18abc1/are_the_top_seo_agencies...", domain: "reddit.com", retrievals: 5, citationRate: 0.5 },
    { title: "Best SaaS SEO agencies in 2026? Looking for real experiences, not sponsored...", url: "reddit.com/r/SaaSMarketing/comments/1de2fg/best_saas_seo_agencies_in_2026...", domain: "reddit.com", retrievals: 4, citationRate: 1.0 },
    { title: "Social media marketing & creator agencies", url: "reddit.com/r/b2bmarketing/comments/2ab34c/social_media_marketing_creator_agencies", domain: "reddit.com", retrievals: 3, citationRate: 1.0 },
    { title: "Best marketing agencies that help you rank on Gemini", url: "reddit.com/r/AIrankingStrategy/comments/3fg12h/best_marketing_agencies...", domain: "reddit.com", retrievals: 3, citationRate: 1.0 },
    { title: "The 10 Best Visibility Companies and Agencies for SEO and GEO?", url: "reddit.com/r/b2bmarketing/comments/4hi56j/the_10_best_visibility_companies...", domain: "reddit.com", retrievals: 2, citationRate: 1.5 },
    { title: "Reputable and Trusted B2B Marketing Agencies (Content, SEO Geo...", url: "reddit.com/r/DigitalMarketing/comments/5kl78m/reputable_and_trusted_b2b...", domain: "reddit.com", retrievals: 2, citationRate: 1.5 },
    { title: "Best digital marketing agency?", url: "reddit.com/r/LawFirm/comments/6mn90p/best_digital_marketing_agency", domain: "reddit.com", retrievals: 1, citationRate: 1.0 },
    { title: "Recognized local seo agencies", url: "reddit.com/r/SaaSMarketing/comments/7op12q/recognized_local_seo_agencies", domain: "reddit.com", retrievals: 1, citationRate: 0.0 },
  ],
  "linkedin.com": [
    { title: "AI Optimization Agencies: Who Can Rank Your Brand on ChatGPT and Other LLMs", url: "linkedin.com/pulse/ai-optimization-agencies-rank-brand-chatgpt-llms/", domain: "linkedin.com", retrievals: 5, citationRate: 0.6 },
    { title: "Top B2B Marketing Agencies 2026 - LinkedIn Pulse", url: "linkedin.com/pulse/top-b2b-marketing-agencies-2026/", domain: "linkedin.com", retrievals: 3, citationRate: 0.3 },
  ],
  "g2.com": [
    { title: "7 Best PPC Agencies for 2026: My Top Picks", url: "g2.com/articles/best-ppc-agencies", domain: "g2.com", retrievals: 4, citationRate: 0.8 },
    { title: "Best Digital Marketing Agencies 2026 Reviews", url: "g2.com/categories/digital-marketing-agencies", domain: "g2.com", retrievals: 3, citationRate: 0.7 },
    { title: "SEO Agency Reviews - G2", url: "g2.com/categories/seo-tools", domain: "g2.com", retrievals: 2, citationRate: 0.5 },
  ],
  "quora.com": [
    { title: "What are some AI SEO agencies? - Quora", url: "quora.com/What-are-some-AI-SEO-agencies", domain: "quora.com", retrievals: 4, citationRate: 0.4 },
    { title: "Which is the best SEO company for small businesses? - Quora", url: "quora.com/Which-is-the-best-SEO-company-for-small-businesses", domain: "quora.com", retrievals: 2, citationRate: 0.2 },
  ],
  "medium.com": [
    { title: "Best US-Based SEO Firms for Landscapers in 2024", url: "medium.com/@seoadvice/best-us-based-seo-firms-for-landscapers", domain: "medium.com", retrievals: 3, citationRate: 0.5 },
    { title: "Top 10 GEO Agencies Helping Brands Rank in AI", url: "medium.com/@aimarketer/top-10-geo-agencies", domain: "medium.com", retrievals: 2, citationRate: 0.4 },
  ],
  "Editorial": [
    { title: "Top U.S. Digital Marketing Agencies In 2026", url: "disruptiveadvertising.com/marketing/top-us-digital-marketing-age...", domain: "disruptiveadvertising.com", retrievals: 27, citationRate: 0.6 },
    { title: "The 18 Best SEO Companies + Services of 2025", url: "searchbloom.com/blog/best-seo-companies-services", domain: "searchbloom.com", retrievals: 17, citationRate: 0.5 },
    { title: "10 Leading AI SEO Agencies Helping Brands Rank in AI Search", url: "searchbloom.com/strategy/best-ai-seo-agency-companies-usa", domain: "searchbloom.com", retrievals: 15, citationRate: 1.1 },
    { title: "Best Enterprise SEO Agencies 2026", url: "searchbloom.com/blog/best-enterprise-seo-agencies", domain: "searchbloom.com", retrievals: 12, citationRate: 1.6 },
    { title: "The 19 Best Local SEO Companies of 2026", url: "highervisibility.com/seo/team/best-local-seo-companies", domain: "highervisibility.com", retrievals: 9, citationRate: 0.3 },
  ],
  "Reference": [
    { title: "Wikipedia - Digital Marketing Agency", url: "en.wikipedia.org/wiki/Digital_marketing_agency", domain: "wikipedia.org", retrievals: 6, citationRate: 0.9 },
    { title: "Wikipedia - Search Engine Optimization", url: "en.wikipedia.org/wiki/Search_engine_optimization", domain: "wikipedia.org", retrievals: 4, citationRate: 0.7 },
  ],
};

// Mock subreddits / channels for drill-down
export const MOCK_CHANNELS_MAP: Record<string, { name: string; count: number }[]> = {
  "reddit.com": [
    { name: "r/SocialMediaMarketing", count: 8 },
    { name: "r/DigitalMarketing", count: 7 },
    { name: "r/growthhacking", count: 6 },
    { name: "r/b2bmarketing", count: 5 },
    { name: "r/SaaSMarketing", count: 4 },
    { name: "r/AIrankingStrategy", count: 3 },
    { name: "r/LawFirm", count: 2 },
  ],
  "linkedin.com": [
    { name: "Marketing & Advertising", count: 5 },
    { name: "Digital Marketing", count: 4 },
    { name: "B2B Marketing", count: 3 },
  ],
  "quora.com": [
    { name: "SEO", count: 6 },
    { name: "Digital Marketing", count: 4 },
    { name: "AI Tools", count: 3 },
  ],
};

// ── Owned ─────────────────────────────────────────────────────────────────────

export interface MockOwnedAction {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  pageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const MOCK_OWNED_ACTIONS: MockOwnedAction[] = [
  // Listicle (High, 2)
  {
    id: "m-o-01", title: "Listicle – digital marketing agencies",
    description: "Take inspiration by articles around \"Digital marketing agencies\" and other common phrases. Mention your own brand favorably.",
    priority: "High", status: "todo", pageUrl: null, createdAt: D, updatedAt: D,
  },
  {
    id: "m-o-02", title: "Create listicle similar to Top U.S. Digital Marketing Agencies",
    description: "Create content similar to [Top U.S. Digital Marketing Agencies In 2026] on disruptiveadvertising.com and other top-performing listicles.",
    priority: "High", status: "todo",
    pageUrl: "https://disruptiveadvertising.com/marketing/top-us-digital-marketing-agencies/",
    createdAt: D, updatedAt: D,
  },
  // Homepage (Medium, 1)
  {
    id: "m-o-03", title: "Homepage – incorporate key phrases",
    description: "Incorporate \"Digital marketing agency\" and other common phrases into the copy of your homepage. Mention your own brand favorably on these pages.",
    priority: "Medium", status: "todo", pageUrl: null, createdAt: D, updatedAt: D,
  },
  // Product Page (Medium, 2)
  {
    id: "m-o-04", title: "Product Page – seo coalition technologies",
    description: "Take inspiration by product pages around \"Seo coalition technologies\" and other common phrases. Mention your own brand favorably on these pages.",
    priority: "Medium", status: "todo", pageUrl: null, createdAt: D, updatedAt: D,
  },
  {
    id: "m-o-05", title: "Create product page similar to KlientBoost",
    description: "Create content similar to [The Only PPC Agency with 200+ Case Studies From Happy Clients] on klientboost.com and other top-performing product pages.",
    priority: "Medium", status: "todo",
    pageUrl: "https://klientboost.com/services/bbb-agency",
    createdAt: D, updatedAt: D,
  },
  // How-To Guide (Low, 2)
  {
    id: "m-o-06", title: "How-To Guide – Amazon marketing plugin",
    description: "Take inspiration by how-to guides around \"Choose amazon consultant\" and other common phrases. Mention your own brand favorably in your how-to guides.",
    priority: "Low", status: "todo", pageUrl: null, createdAt: D, updatedAt: D,
  },
  {
    id: "m-o-07", title: "Create how-to guide similar to Google SERP 101",
    description: "Create content similar to [Google SERP 101: How to Get Your Website on the First Page] on disruptiveadvertising.com and other top-performing how-to guides.",
    priority: "Low", status: "todo",
    pageUrl: "https://disruptiveadvertising.com/seo/google-serp/",
    createdAt: D, updatedAt: D,
  },
  // Category Page (Low, 2)
  {
    id: "m-o-08", title: "Category Page – digital marketing agency",
    description: "Take inspiration by category or tag pages around \"Digital marketing agency technologies\" and other common phrases. Mention your own brand favorably on these pages.",
    priority: "Low", status: "todo", pageUrl: null, createdAt: D, updatedAt: D,
  },
  {
    id: "m-o-09", title: "Create category page similar to Intero Digital",
    description: "Create content similar to [Full-Service Digital Marketing Services - Intero Digital Solutions] on interdigital.com and other top-performing category pages.",
    priority: "Low", status: "todo",
    pageUrl: "https://interdigital.com/digital-marketing-services/",
    createdAt: D, updatedAt: D,
  },
  // Article (Low, 2)
  {
    id: "m-o-10", title: "Article – Amazon marketing agency",
    description: "Take inspiration by articles around \"Amazon marketing pricing\" and other common phrases. Mention your own brand favorably.",
    priority: "Low", status: "todo", pageUrl: null, createdAt: D, updatedAt: D,
  },
  {
    id: "m-o-11", title: "Create article similar to What is Industrial SEO",
    description: "Create content similar to [What is Industrial SEO? (And How to Do SEO for Industrial Companies)] on seo.com and other top-performing articles.",
    priority: "Low", status: "todo",
    pageUrl: "https://seo.com/blog/industrial-seo/",
    createdAt: D, updatedAt: D,
  },
  // Comparison (Low, 2)
  {
    id: "m-o-12", title: "Comparison – bring together higher rankings",
    description: "Take inspiration by comparisons around \"Bring together higher rankings\" and other common phrases. Mention your own brand favorably in your comparisons.",
    priority: "Low", status: "todo", pageUrl: null, createdAt: D, updatedAt: D,
  },
  {
    id: "m-o-13", title: "Create comparison similar to 12 Best GEO-Focused SEO Companies",
    description: "Create content similar to [12 Best GEO-Focused SEO Companies for 2026: My Top Picks] on singlegrain.com and other top-performing comparison pages.",
    priority: "Low", status: "todo",
    pageUrl: "https://singlegrain.com/blog/best-geo-focused-seo-companies/",
    createdAt: D, updatedAt: D,
  },
];

// ── Impact rows ───────────────────────────────────────────────────────────────

export interface MockImpactRow {
  id: string;
  kind: "earned" | "owned";
  title: string;
  description: string;
  sourceUrl: string | null;
  status: string;
  group: "UGC" | "Editorial" | "Owned";
  type: string;
  priority: string;
  updatedAt: string;
}

export const MOCK_IMPACT_ROWS: MockImpactRow[] = [
  {
    id: "m-i-01", kind: "earned", title: "Reddit A+ social media agencies",
    description: "Get your brand mentioned in [What are some trusted legit A+ social media marketing agencies?]. Or look out for similar content and join those conversations early.",
    sourceUrl: "https://reddit.com/r/SocialMediaMarketing/comments/1ab23cd/",
    status: "todo", group: "UGC", type: "reddit.com", priority: "Medium",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "m-i-02", kind: "earned", title: "Reddit Best Visibility Companies",
    description: "Get your brand mentioned in [The 10 Best Visibility Companies and Agencies for SEO and GEO?]. Or look out for similar content and join those conversations early.",
    sourceUrl: "https://reddit.com/r/b2bmarketing/comments/4hi56j/",
    status: "todo", group: "UGC", type: "reddit.com", priority: "Low",
    updatedAt: new Date().toISOString(),
  },
];
