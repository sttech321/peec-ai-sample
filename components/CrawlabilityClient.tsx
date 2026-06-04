"use client";

import { useMemo, useState } from "react";
import { RefreshCw, FileText, X, ChevronRight, ChevronDown, Check, Search } from "lucide-react";
import { fetchRobotsTxt } from "../app/crawlability/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BotStatus {
  status: "Allowed" | "Blocked" | "Partial" | "Unknown";
  allows: string[];
  disallows: string[];
  crawlDelay?: number;
  source: "specific" | "global" | "none";
}

interface Bot {
  name: string;
  displayName: string;
  type: string;
  typeDisplay: string;
  platform: string;
  company: string;
  domain: string;
}

// ── AI Bots dataset ───────────────────────────────────────────────────────────

const AI_BOTS: Bot[] = [
  // OpenAI
  { name: "GPTBot",                       displayName: "GPTBot",                       type: "training",   typeDisplay: "Training",   platform: "ChatGPT",          company: "OpenAI",           domain: "openai.com" },
  { name: "ChatGPT-User",                 displayName: "ChatGPT-User",                 type: "assistant",  typeDisplay: "User Query",  platform: "ChatGPT",          company: "OpenAI",           domain: "openai.com" },
  { name: "OAI-SearchBot",                displayName: "OAI-SearchBot",                type: "search",     typeDisplay: "Search",     platform: "ChatGPT",          company: "OpenAI",           domain: "openai.com" },
  // Anthropic
  { name: "anthropic-ai",                 displayName: "anthropic-ai",                 type: "training",   typeDisplay: "Training",   platform: "Claude",           company: "Anthropic",        domain: "anthropic.com" },
  { name: "ClaudeBot",                    displayName: "ClaudeBot",                    type: "assistant",  typeDisplay: "User Query",  platform: "Claude",           company: "Anthropic",        domain: "anthropic.com" },
  { name: "Claude-Web",                   displayName: "Claude-Web",                   type: "assistant",  typeDisplay: "User Query",  platform: "Claude",           company: "Anthropic",        domain: "anthropic.com" },
  // Google
  { name: "Google-Extended",              displayName: "Google-Extended",              type: "training",   typeDisplay: "Training",   platform: "Gemini",           company: "Google",           domain: "google.com" },
  { name: "Googlebot",                    displayName: "Googlebot",                    type: "search",     typeDisplay: "Search",     platform: "Google Search",    company: "Google",           domain: "google.com" },
  { name: "GoogleOther",                  displayName: "GoogleOther",                  type: "training",   typeDisplay: "Training",   platform: "Gemini",           company: "Google",           domain: "google.com" },
  // Meta
  { name: "Meta-ExternalAgent",           displayName: "Meta-ExternalAgent",           type: "training",   typeDisplay: "Training",   platform: "Meta",             company: "Meta",             domain: "meta.com" },
  { name: "Meta-ExternalFetcher",         displayName: "Meta-ExternalFetcher",         type: "training",   typeDisplay: "Training",   platform: "Meta",             company: "Meta",             domain: "meta.com" },
  { name: "FacebookBot",                  displayName: "FacbookBot",                   type: "social",     typeDisplay: "Other",     platform: "Meta",             company: "Meta",             domain: "facebook.com" },
  // Apple
  { name: "Applebot",                     displayName: "Applebot",                     type: "search",     typeDisplay: "Search",     platform: "Apple",            company: "Apple",            domain: "apple.com" },
  { name: "Applebot-Extended",            displayName: "Applebot-Extended",            type: "training",   typeDisplay: "Training",   platform: "Apple",            company: "Apple",            domain: "apple.com" },
  // Amazon
  { name: "Amazonbot",                    displayName: "Amazonbot",                    type: "training",   typeDisplay: "Training",   platform: "Amazon",           company: "Amazon",           domain: "amazon.com" },
  // ByteDance
  { name: "Bytespider",                   displayName: "Bytespider",                   type: "training",   typeDisplay: "Training",   platform: "ByteDance",        company: "ByteDance",        domain: "bytedance.com" },
  // Common Crawl
  { name: "CCBot",                        displayName: "CCBot",                        type: "training",   typeDisplay: "Training",   platform: "Common Crawl",     company: "Common Crawl",     domain: "commoncrawl.org" },
  // Allen Institute
  { name: "Ai2Bot",                       displayName: "Ai2Bot",                       type: "training",   typeDisplay: "Training",   platform: "Allen Institute",  company: "Allen Institute",  domain: "allenai.org" },
  { name: "Ai2Bot-Dolma",                 displayName: "Ai2Bot-Dolma",                 type: "training",   typeDisplay: "Training",   platform: "Allen Institute",  company: "Allen Institute",  domain: "allenai.org" },
  // Cohere
  { name: "cohere-ai",                    displayName: "cohere-ai",                    type: "training",   typeDisplay: "Training",   platform: "Cohere",           company: "Cohere",           domain: "cohere.com" },
  { name: "cohere-training-data-crawler", displayName: "cohere-training-data-crawler", type: "training",   typeDisplay: "Training",   platform: "Cohere",           company: "Cohere",           domain: "cohere.com" },
  // Perplexity
  { name: "PerplexityBot",                displayName: "PerplexityBot",                type: "assistant",  typeDisplay: "User Query",  platform: "Perplexity",       company: "Perplexity",       domain: "perplexity.ai" },
  // DeepSeek
  { name: "DeepSeekBot",                  displayName: "DeepSeekBot",                  type: "training",   typeDisplay: "Training",   platform: "DeepSeek",         company: "DeepSeek",         domain: "deepseek.com" },
  // Huawei / PanGu
  { name: "PanguBot",                     displayName: "PanguBot",                     type: "training",   typeDisplay: "Training",   platform: "PanGu",            company: "Huawei",           domain: "huawei.com" },
  // Webz.io
  { name: "Webzio-Extended",              displayName: "Webzio-Extended",              type: "training",   typeDisplay: "Training",   platform: "Webz.io",          company: "Webz.io",          domain: "webz.io" },
  { name: "omgili",                       displayName: "omgili",                       type: "training",   typeDisplay: "Training",   platform: "Webz.io",          company: "Webz.io",          domain: "webz.io" },
  // Diffbot
  { name: "Diffbot",                      displayName: "Diffbot",                      type: "training",   typeDisplay: "Training",   platform: "Diffbot",          company: "Diffbot",          domain: "diffbot.com" },
  // You.com
  { name: "YouBot",                       displayName: "YouBot",                       type: "assistant",  typeDisplay: "User Query",  platform: "You.com",          company: "You.com",          domain: "you.com" },
  // xAI (Grok)
  { name: "Grok",                         displayName: "Grok",                         type: "assistant",  typeDisplay: "User Query",  platform: "Grok",             company: "xAI",              domain: "x.ai" },
  // Mistral
  { name: "MistralBot",                   displayName: "MistralBot",                   type: "training",   typeDisplay: "Training",   platform: "Mistral",          company: "Mistral",          domain: "mistral.ai" },
  // QuillBot
  { name: "QuillBot",                     displayName: "QuillBot",                     type: "assistant",  typeDisplay: "User Query",  platform: "QuillBot",         company: "QuillBot",         domain: "quillbot.com" },
  // Timpi
  { name: "Timpi",                        displayName: "Timpi",                        type: "search",     typeDisplay: "Search",     platform: "Timpi",            company: "Timpi",            domain: "timpi.io" },
  // Microsoft
  { name: "Bingbot",                      displayName: "Bingbot",                      type: "search",     typeDisplay: "Search",     platform: "Bing",             company: "Microsoft",        domain: "bing.com" },
  { name: "BingPreview",                  displayName: "BingPreview",                  type: "search",     typeDisplay: "Search",     platform: "Bing",             company: "Microsoft",        domain: "bing.com" },
  // DuckDuckGo
  { name: "DuckDuckBot",                  displayName: "DuckDuckBot",                  type: "search",     typeDisplay: "Search",     platform: "DuckDuckGo",       company: "DuckDuckGo",       domain: "duckduckgo.com" },
  // X / Twitter
  { name: "Twitterbot",                   displayName: "Twitterbot",                   type: "social",     typeDisplay: "Other",     platform: "X / Twitter",      company: "xAI",              domain: "twitter.com" },
  // LinkedIn
  { name: "LinkedInBot",                  displayName: "LinkedInBot",                  type: "social",     typeDisplay: "Other",     platform: "LinkedIn",         company: "LinkedIn",         domain: "linkedin.com" },
  // Research
  { name: "SemrushBot",                   displayName: "SemrushBot",                   type: "research",   typeDisplay: "Other",   platform: "Semrush",          company: "Semrush",          domain: "semrush.com" },
  { name: "AhrefsBot",                    displayName: "AhrefsBot",                    type: "research",   typeDisplay: "Other",   platform: "Ahrefs",           company: "Ahrefs",           domain: "ahrefs.com" },
  { name: "DotBot",                       displayName: "DotBot",                       type: "research",   typeDisplay: "Other",   platform: "Moz",              company: "Moz",              domain: "moz.com" },
  { name: "ia_archiver",                  displayName: "ia_archiver",                  type: "research",   typeDisplay: "Other",   platform: "Internet Archive", company: "Internet Archive", domain: "archive.org" },
];

const PLATFORMS = [...new Set(AI_BOTS.map(b => b.company))].sort();
const TYPE_CATEGORIES = ["Training", "Search", "User Query", "Other"] as const;

// ── robots.txt parser ─────────────────────────────────────────────────────────

interface RobotGroup {
  agents: string[];
  disallows: string[];
  allows: string[];
  crawlDelay?: number;
}

function parseRobotsTxt(content: string): RobotGroup[] {
  const groups: RobotGroup[] = [];
  let current: RobotGroup | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) {
      if (current) { groups.push(current); current = null; }
      continue;
    }
    const [key, ...rest] = line.split(":");
    const val = rest.join(":").trim();
    const k = key.trim().toLowerCase();

    if (k === "user-agent") {
      if (!current) current = { agents: [], disallows: [], allows: [] };
      current.agents.push(val);
    } else if (k === "disallow" && current) {
      current.disallows.push(val);
    } else if (k === "allow" && current) {
      current.allows.push(val);
    } else if (k === "crawl-delay" && current) {
      current.crawlDelay = parseFloat(val);
    }
  }
  if (current) groups.push(current);
  return groups;
}

function getBotStatus(botName: string, groups: RobotGroup[]): BotStatus {
  const specific = groups.find(g =>
    g.agents.some(a => a.toLowerCase() === botName.toLowerCase())
  );
  if (specific) {
    const fullyBlocked = specific.disallows.some(d => d === "/");
    const hasDisallows = specific.disallows.filter(d => d !== "").length > 0;
    const hasAllows = specific.allows.length > 0;
    let status: BotStatus["status"] = "Allowed";
    if (fullyBlocked && !hasAllows) status = "Blocked";
    else if (hasDisallows || hasAllows) status = "Partial";
    return { status, allows: specific.allows, disallows: specific.disallows, crawlDelay: specific.crawlDelay, source: "specific" };
  }

  const global = groups.find(g => g.agents.includes("*"));
  if (global) {
    const fullyBlocked = global.disallows.some(d => d === "/");
    const hasDisallows = global.disallows.filter(d => d !== "").length > 0;
    const hasAllows = global.allows.length > 0;
    let status: BotStatus["status"] = "Allowed";
    if (fullyBlocked && !hasAllows) status = "Blocked";
    else if (hasDisallows || hasAllows) status = "Partial";
    return { status, allows: global.allows, disallows: global.disallows, crawlDelay: global.crawlDelay, source: "global" };
  }

  return { status: "Unknown", allows: [], disallows: [], source: "none" };
}

// ── Syntax-highlighted robots.txt lines ───────────────────────────────────────

function RobotLine({ line, num, highlighted }: { line: string; num: number; highlighted?: boolean }) {
  const raw = line.split("#")[0].trim();
  const comment = line.includes("#") ? "#" + line.split("#").slice(1).join("#") : "";
  let content: React.ReactNode;

  if (!raw && !comment) {
    content = <span>&nbsp;</span>;
  } else if (line.trimStart().startsWith("#")) {
    content = <span className="cw-robots-comment">{line}</span>;
  } else if (/^user-agent:/i.test(raw)) {
    const val = raw.split(":").slice(1).join(":").trim();
    content = <><span className="cw-robots-agent">User-agent: </span><span className="cw-robots-agent-val">{val}</span>{comment && <span className="cw-robots-comment"> {comment}</span>}</>;
  } else if (/^disallow:/i.test(raw)) {
    const val = raw.split(":").slice(1).join(":").trim();
    content = <><span className="cw-robots-content">Disallow: </span><span className="cw-robots-disallow">{val || "(none)"}</span>{comment && <span className="cw-robots-comment"> {comment}</span>}</>;
  } else if (/^allow:/i.test(raw)) {
    const val = raw.split(":").slice(1).join(":").trim();
    content = <><span className="cw-robots-content">Allow: </span><span className="cw-robots-allow">{val}</span>{comment && <span className="cw-robots-comment"> {comment}</span>}</>;
  } else if (/^sitemap:/i.test(raw)) {
    const val = raw.split(":").slice(1).join(":").trim();
    content = <><span className="cw-robots-directive">Sitemap: </span><span className="cw-robots-url">{val}</span></>;
  } else if (/^crawl-delay:/i.test(raw)) {
    content = <span className="cw-robots-directive">{raw}</span>;
  } else {
    content = <span className="cw-robots-content">{line}</span>;
  }

  return (
    <div className={`cw-robots-line${highlighted ? " cw-robots-line-highlighted" : ""}`}>
      <span className="cw-robots-num">{num}</span>
      <span>{content}</span>
    </div>
  );
}

// Compute highlighted line numbers for a specific bot (its block, or the global * block)
function getBotHighlightLines(botName: string | null, content: string): { lines: Set<number>; firstLine: number } {
  const rawLines = content.split(/\r?\n/);

  // Build group line ranges
  type GroupRange = { agents: string[]; start: number; end: number };
  const groups: GroupRange[] = [];
  let cur: { agents: string[]; start: number } | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i].split("#")[0].trim();
    if (/^user-agent:/i.test(raw)) {
      if (!cur) cur = { agents: [], start: i + 1 };
      cur.agents.push(raw.split(":").slice(1).join(":").trim());
    } else if (!raw && cur) {
      groups.push({ ...cur, end: i }); // blank line ends group
      cur = null;
    }
  }
  if (cur) groups.push({ ...cur, end: rawLines.length });

  // Find the relevant group
  const specific = botName
    ? groups.find(g => g.agents.some(a => a.toLowerCase() === botName.toLowerCase()))
    : null;
  const global = groups.find(g => g.agents.includes("*"));
  const target = specific ?? global;

  const highlighted = new Set<number>();
  let firstLine = 1;
  if (target) {
    firstLine = target.start;
    for (let n = target.start; n <= target.end; n++) highlighted.add(n);
  }
  return { lines: highlighted, firstLine };
}

// ── URL Tester ─────────────────────────────────────────────────────────────────

function UrlTester({ domain, robotsContent }: { domain: string; robotsContent: string | null }) {
  const [inputUrl, setInputUrl] = useState(`https://${domain}/`);
  const [results, setResults] = useState<Array<{ bot: Bot; status: BotStatus["status"]; rule: string }> | null>(null);
  const [loading, setLoading] = useState(false);

  const groups = useMemo(() => (robotsContent ? parseRobotsTxt(robotsContent) : []), [robotsContent]);

  function checkUrl() {
    if (!robotsContent) return;
    setLoading(true);
    setTimeout(() => {
      let path = inputUrl;
      try { path = new URL(inputUrl).pathname; } catch {}

      const res = AI_BOTS.map((bot) => {
        const bs = getBotStatus(bot.name, groups);
        const blocked = bs.disallows.some(d => d && (path.startsWith(d) || d === "/"));
        const allowed = bs.allows.some(a => a && path.startsWith(a));
        let status: BotStatus["status"] = bs.status;
        let rule = bs.source === "global" ? "Following global rules" : "Not in robots.txt";
        if (blocked && !allowed) {
          status = "Blocked";
          rule = `Disallow: ${bs.disallows.find(d => d && (path.startsWith(d) || d === "/")) ?? "/"}`;
        } else if (allowed) {
          status = "Allowed";
          rule = `Allow: ${bs.allows.find(a => a && path.startsWith(a)) ?? ""}`;
        }
        return { bot, status, rule };
      });

      setResults(res);
      setLoading(false);
    }, 300);
  }

  return (
    <div className="cw-tester">
      <div>
        <p className="cw-tester-title">URL Access Tester</p>
        <p className="cw-tester-desc">Enter any URL on your site to check which AI bots can access it based on your robots.txt rules.</p>
      </div>
      <div className="cw-tester-form">
        <input
          className="cw-tester-input"
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          placeholder={`https://${domain}/example-page`}
          onKeyDown={e => e.key === "Enter" && checkUrl()}
        />
        <button className="cw-tester-btn" onClick={checkUrl} disabled={loading || !robotsContent}>
          {loading ? "Checking…" : "Check URL"}
        </button>
      </div>
      {!robotsContent && (
        <div className="cw-tester-error">No robots.txt loaded. Reload it from the Crawlability tab first.</div>
      )}
      {results && (
        <div className="cw-tester-results">
          <div className="cw-tester-result-url">Testing: {inputUrl}</div>
          <div className="cw-tester-table">
            <div className="cw-tester-row cw-tester-head">
              <span>Bot</span>
              <span>Access</span>
              <span>Matching rule</span>
            </div>
            {results.map(r => (
              <div key={r.bot.name} className="cw-tester-row">
                <div className="cw-bot-cell">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://www.google.com/s2/favicons?sz=64&domain=${r.bot.domain}`} alt="" className="cw-bot-icon"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  <span className="cw-bot-name">{r.bot.name}</span>
                </div>
                <span className={`cw-status-badge ${r.status === "Allowed" ? "cw-status-allowed" : r.status === "Blocked" ? "cw-status-blocked" : r.status === "Partial" ? "cw-status-partial" : "cw-status-unknown"}`}>
                  {r.status === "Allowed" && <Check size={11} />}
                  {r.status === "Blocked" && <X size={11} />}
                  {r.status}
                </span>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#52525b" }}>{r.rule}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface CrawlabilityProps {
  domain: string | null;
  robotsTxtContent: string | null;
  robotsTxtUrl: string;
  projectName: string;
  fetchError: string | null;
  fetchedAt?: string;
}

function formatFetchedAt(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CrawlabilityClient({
  domain,
  robotsTxtContent,
  robotsTxtUrl,
  projectName,
  fetchError,
  fetchedAt,
}: CrawlabilityProps) {
  const [tab, setTab] = useState<"crawlability" | "tester">("crawlability");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // Multi-select filters: empty Set = all selected
  const [platformFilters, setPlatformFilters] = useState<Set<string>>(new Set());
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());
  const [botFilters, setBotFilters] = useState<Set<string>>(new Set());
  const [selectedBot, setSelectedBot] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalBotName, setModalBotName] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [localContent, setLocalContent] = useState(robotsTxtContent);
  const [localError, setLocalError] = useState(fetchError);
  const [lastFetchedAt, setLastFetchedAt] = useState(fetchedAt ?? new Date().toISOString());

  const [platformOpen, setPlatformOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [botsOpen, setBotsOpen] = useState(false);

  const groups = useMemo(() => (localContent ? parseRobotsTxt(localContent) : []), [localContent]);

  const botsWithStatus = useMemo(
    () => AI_BOTS.map(bot => ({ bot, botStatus: getBotStatus(bot.name, groups) })),
    [groups]
  );

  const counts = useMemo(() => {
    const c = { Allowed: 0, Blocked: 0, Partial: 0, Unknown: 0 };
    for (const { botStatus } of botsWithStatus) c[botStatus.status]++;
    return c;
  }, [botsWithStatus]);

  const restricted = counts.Blocked + counts.Partial;
  const fullyOpen = counts.Allowed;

  const filtered = useMemo(() => {
    let list = botsWithStatus;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(({ bot }) => bot.name.toLowerCase().includes(q) || bot.company.toLowerCase().includes(q));
    }
    if (statusFilter !== "all")
      list = list.filter(({ botStatus }) => botStatus.status.toLowerCase() === statusFilter);
    if (platformFilters.size > 0)
      list = list.filter(({ bot }) => platformFilters.has(bot.company));
    if (typeFilters.size > 0)
      list = list.filter(({ bot }) => typeFilters.has(bot.typeDisplay));
    if (botFilters.size > 0)
      list = list.filter(({ bot }) => botFilters.has(bot.name));
    return list;
  }, [botsWithStatus, search, statusFilter, platformFilters, typeFilters, botFilters]);

  const hasGlobalGroup = groups.some(g => g.agents.includes("*"));
  const globalBots = filtered.filter(({ botStatus }) => botStatus.source === "global" || botStatus.source === "none");
  const specificBots = filtered.filter(({ botStatus }) => botStatus.source === "specific");

  const hasFilters = platformFilters.size > 0 || typeFilters.size > 0 || botFilters.size > 0 || statusFilter !== "all";

  async function handleReload() {
    if (!domain) return;
    setReloading(true);
    try {
      const result = await fetchRobotsTxt(domain);
      setLocalContent(result.content);
      setLocalError(result.error);
      setLastFetchedAt(new Date().toISOString());
    } catch {
      setLocalError("Failed to reload");
    }
    setReloading(false);
  }

  function BotRow({ bot, botStatus, idx }: { bot: Bot; botStatus: BotStatus; idx: number }) {
    const isSelected = selectedBot === bot.name;
    return (
      <div key={bot.name}>
        <div
          className={`cw-table-row ${isSelected ? "cw-table-row-selected" : ""}`}
          onClick={() => setSelectedBot(isSelected ? null : bot.name)}
        >
          <span className="cw-row-num">{idx + 1}</span>
          <div className="cw-bot-cell">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?sz=64&domain=${bot.domain}`}
              alt="" className="cw-bot-icon"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <span className="cw-bot-name">{bot.displayName}</span>
          </div>
          <div>
            <span className="cw-type-badge">{bot.typeDisplay.toLowerCase()}</span>
          </div>
          <div className="cw-platform-cell">
            {bot.platform !== bot.company ? `${bot.platform} · ${bot.company}` : bot.company}
          </div>
          <div className="cw-status-cell">
            {/* Clicking the badge opens the robots.txt modal highlighted for THIS bot */}
            <span
              className={`cw-status-badge cw-status-badge-clickable ${
                botStatus.status === "Allowed" ? "cw-status-allowed"
                : botStatus.status === "Blocked" ? "cw-status-blocked"
                : botStatus.status === "Partial" ? "cw-status-partial"
                : "cw-status-unknown"
              }`}
              onClick={e => openModalForBot(bot.name, e)}
              title={`View robots.txt rules for ${bot.name}`}
            >
              {botStatus.status === "Allowed" && <Check size={11} />}
              {botStatus.status === "Blocked" && <X size={11} />}
              {botStatus.status}
              <ChevronRight size={11} />
            </span>
          </div>
        </div>

        {isSelected && (
          <div className="cw-detail-panel">
            <div className="cw-detail-head">
              <div className="cw-detail-bot">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://www.google.com/s2/favicons?sz=64&domain=${bot.domain}`} alt="" className="cw-bot-icon"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                {bot.displayName}
                <span className="cw-type-badge" style={{ fontSize: 11, marginLeft: 4 }}>{bot.typeDisplay}</span>
              </div>
              <button className="cw-close-btn" onClick={e => { e.stopPropagation(); setSelectedBot(null); }}>
                <X size={14} />
              </button>
            </div>
            <div className="cw-detail-rules">
              {botStatus.disallows.length === 0 && botStatus.allows.length === 0 ? (
                <div className="cw-detail-empty">
                  No explicit rules.{" "}
                  {botStatus.source === "global"
                    ? "This bot follows the global wildcard (* ) rules."
                    : "No rules found in robots.txt — all paths allowed by default."}
                </div>
              ) : (
                <>
                  {botStatus.disallows.map((d, i) => (
                    <div key={`d${i}`} className="cw-detail-rule-row">
                      <span className="cw-detail-rule-key">Disallow</span>
                      <span className={`cw-detail-rule-val ${d ? "cw-detail-rule-val-disallow" : ""}`}>
                        {d || "(empty — clears previous restrictions)"}
                      </span>
                    </div>
                  ))}
                  {botStatus.allows.map((a, i) => (
                    <div key={`a${i}`} className="cw-detail-rule-row">
                      <span className="cw-detail-rule-key">Allow</span>
                      <span className="cw-detail-rule-val cw-detail-rule-val-allow">{a}</span>
                    </div>
                  ))}
                  {botStatus.crawlDelay !== undefined && (
                    <div className="cw-detail-rule-row">
                      <span className="cw-detail-rule-key">Crawl-delay</span>
                      <span className="cw-detail-rule-val">{botStatus.crawlDelay}s</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="cw-detail-source">
              Source:{" "}
              <a href={robotsTxtUrl} target="_blank" rel="noopener noreferrer">{robotsTxtUrl}</a>
            </div>
          </div>
        )}
      </div>
    );
  }

  const robotsLines = localContent ? localContent.split(/\r?\n/) : [];

  // Compute highlight lines + first line for auto-scroll based on which bot opened the modal
  const { lines: highlightedLines, firstLine: highlightFirstLine } = useMemo(
    () => localContent
      ? getBotHighlightLines(modalBotName, localContent)
      : { lines: new Set<number>(), firstLine: 1 },
    [localContent, modalBotName]
  );

  function openModalForBot(botName: string | null, e?: React.MouseEvent) {
    e?.stopPropagation();
    setModalBotName(botName);
    setShowModal(true);
  }

  return (
    <div className="cw-page">

      {/* Top bar */}
      <div className="cw-topbar">
        {/* Left: filter chips */}
        <div className="cw-filters">
          {/* Project name chip */}
          <div style={{ position: "relative" }}>
            <button className="cw-chip cw-chip-project">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {domain && <img src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`} alt="" style={{ width: 12, height: 12, borderRadius: 2 }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
              {projectName}
              <ChevronDown size={11} />
            </button>
          </div>

          {/* All Platforms — multi-select */}
          <div style={{ position: "relative" }}>
            <button
              className={`cw-chip ${platformFilters.size > 0 ? "cw-chip-active" : ""}`}
              onClick={() => { setPlatformOpen(v => !v); setTypeOpen(false); setBotsOpen(false); }}
            >
              {platformFilters.size === 0
                ? "All Platforms"
                : platformFilters.size === 1
                  ? [...platformFilters][0]
                  : `${platformFilters.size} Platforms`}
              <ChevronDown size={11} />
            </button>
            {platformOpen && (
              <div className="cw-dropdown cw-dropdown-multiselect" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30, minWidth: 220, maxHeight: 320, overflowY: "auto" }}>
                {/* All Platforms row */}
                <div
                  className="cw-dropdown-check-item"
                  onClick={() => setPlatformFilters(new Set())}
                >
                  <span className={`cw-checkbox ${platformFilters.size === 0 ? "cw-checkbox-checked" : ""}`}>
                    {platformFilters.size === 0 && <Check size={10} />}
                  </span>
                  <span style={{ flex: 1 }}>All Platforms</span>
                </div>
                <div className="cw-dropdown-sep" />
                {PLATFORMS.map(p => {
                  const checked = platformFilters.has(p);
                  return (
                    <div
                      key={p}
                      className="cw-dropdown-check-item cw-dropdown-check-item-hoverable"
                      onClick={() => {
                        setPlatformFilters(prev => {
                          const next = new Set(prev);
                          if (next.has(p)) next.delete(p); else next.add(p);
                          return next;
                        });
                      }}
                    >
                      <span className={`cw-checkbox ${checked ? "cw-checkbox-checked" : ""}`}>
                        {checked && <Check size={10} />}
                      </span>
                      <span style={{ flex: 1 }}>{p}</span>
                      <button
                        className="cw-only-btn"
                        onClick={e => {
                          e.stopPropagation();
                          setPlatformFilters(new Set([p]));
                          setPlatformOpen(false);
                        }}
                      >
                        Only
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* All bot types — multi-select */}
          <div style={{ position: "relative" }}>
            <button
              className={`cw-chip ${typeFilters.size > 0 ? "cw-chip-active" : ""}`}
              onClick={() => { setTypeOpen(v => !v); setPlatformOpen(false); setBotsOpen(false); }}
            >
              {typeFilters.size === 0
                ? "All bot types"
                : typeFilters.size === 1
                  ? [...typeFilters][0]
                  : `${typeFilters.size} types`}
              <ChevronDown size={11} />
            </button>
            {typeOpen && (
              <div className="cw-dropdown cw-dropdown-multiselect" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30, minWidth: 180 }}>
                <div className="cw-dropdown-check-item" onClick={() => setTypeFilters(new Set())}>
                  <span className={`cw-checkbox ${typeFilters.size === 0 ? "cw-checkbox-checked" : ""}`}>
                    {typeFilters.size === 0 && <Check size={10} />}
                  </span>
                  <span style={{ flex: 1 }}>All bot types</span>
                </div>
                <div className="cw-dropdown-sep" />
                {TYPE_CATEGORIES.map(cat => {
                  const checked = typeFilters.has(cat);
                  return (
                    <div
                      key={cat}
                      className="cw-dropdown-check-item cw-dropdown-check-item-hoverable"
                      onClick={() => {
                        setTypeFilters(prev => {
                          const next = new Set(prev);
                          if (next.has(cat)) next.delete(cat); else next.add(cat);
                          return next;
                        });
                      }}
                    >
                      <span className={`cw-checkbox ${checked ? "cw-checkbox-checked" : ""}`}>
                        {checked && <Check size={10} />}
                      </span>
                      <span style={{ flex: 1 }}>{cat}</span>
                      <button
                        className="cw-only-btn"
                        onClick={e => {
                          e.stopPropagation();
                          setTypeFilters(new Set([cat]));
                          setTypeOpen(false);
                        }}
                      >
                        Only
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* All Bots — multi-select by bot name, grouped by type */}
          <div style={{ position: "relative" }}>
            <button
              className={`cw-chip ${botFilters.size > 0 ? "cw-chip-active" : ""}`}
              onClick={() => { setBotsOpen(v => !v); setPlatformOpen(false); setTypeOpen(false); }}
            >
              {botFilters.size === 0
                ? "All Bots"
                : botFilters.size === 1
                  ? [...botFilters][0]
                  : `${botFilters.size} Bots`}
              <ChevronDown size={11} />
            </button>
            {botsOpen && (
              <div className="cw-dropdown cw-dropdown-multiselect" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30, minWidth: 240, maxHeight: 400, overflowY: "auto" }}>
                <div className="cw-dropdown-check-item" onClick={() => setBotFilters(new Set())}>
                  <span className={`cw-checkbox ${botFilters.size === 0 ? "cw-checkbox-checked" : ""}`}>
                    {botFilters.size === 0 && <Check size={10} />}
                  </span>
                  <span style={{ flex: 1 }}>All Bots</span>
                </div>
                <div className="cw-dropdown-sep" />
                {TYPE_CATEGORIES.map(cat => {
                  const botsInCat = AI_BOTS.filter(b => b.typeDisplay === cat);
                  if (botsInCat.length === 0) return null;
                  return (
                    <div key={cat}>
                      <div className="cw-dropdown-group-label">{cat}</div>
                      {botsInCat.map(bot => {
                        const checked = botFilters.has(bot.name);
                        return (
                          <div
                            key={bot.name}
                            className="cw-dropdown-check-item cw-dropdown-check-item-hoverable"
                            onClick={() => {
                              setBotFilters(prev => {
                                const next = new Set(prev);
                                if (next.has(bot.name)) next.delete(bot.name); else next.add(bot.name);
                                return next;
                              });
                            }}
                          >
                            <span className={`cw-checkbox ${checked ? "cw-checkbox-checked" : ""}`}>
                              {checked && <Check size={10} />}
                            </span>
                            <span style={{ flex: 1 }}>{bot.displayName}</span>
                            <button
                              className="cw-only-btn"
                              onClick={e => {
                                e.stopPropagation();
                                setBotFilters(new Set([bot.name]));
                                setBotsOpen(false);
                              }}
                            >
                              Only
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {hasFilters && (
            <button className="cw-clear-btn" onClick={() => {
              setPlatformFilters(new Set());
              setTypeFilters(new Set());
              setBotFilters(new Set());
              setStatusFilter("all");
            }}>
              Clear Filters
            </button>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="cw-actions">
          <button className="cw-action-btn" onClick={handleReload} disabled={reloading || !domain}>
            <RefreshCw size={13} className={reloading ? "cw-spin" : ""} />
            Reload robots.txt
          </button>
          <button className="cw-action-btn" onClick={() => { setModalBotName(null); setShowModal(true); }}>
            <FileText size={13} />
            View robots.txt
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="cw-tabs">
        <button className={`cw-tab ${tab === "crawlability" ? "cw-tab-active" : ""}`} onClick={() => setTab("crawlability")}>
          Crawlability
        </button>
        <button className={`cw-tab ${tab === "tester" ? "cw-tab-active" : ""}`} onClick={() => setTab("tester")}>
          URL Tester
        </button>
      </div>

      {tab === "tester" ? (
        <UrlTester domain={domain ?? "example.com"} robotsContent={localContent} />
      ) : (
        <>
          {/* Summary card */}
          <div className="cw-summary-card">
            <p className="cw-heading">
              {projectName} — {restricted} bots with restrictions, {fullyOpen} fully open
            </p>
            <p className="cw-subheading">
              Review which AI crawlers can access your site and how your robots.txt policies compare to competitors.
              {" "}
              <span style={{ color: "#a1a1aa" }}>
                Last fetched {formatFetchedAt(lastFetchedAt)}.
              </span>
            </p>
          </div>

          {localError && (
            <div className="cw-tester-error">
              Could not load robots.txt: {localError}. Showing default rules.
            </div>
          )}

          {/* Standalone search row */}
          <div className="cw-search-row">
            <div className="cw-search-row-inner">
              <Search size={14} className="cw-search-row-icon" />
              <input
                className="cw-search-row-input"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search"
              />
            </div>
            <select
              className="cw-status-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="allowed">Allowed</option>
              <option value="blocked">Blocked</option>
              <option value="partial">Partial</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div className="cw-table">
            {/* Column headers */}
            <div className="cw-table-head">
              <span>#</span>
              <span>Bot ↕</span>
              <span>Bot type ↕</span>
              <span>Platform ↕</span>
              <span>Status ↕</span>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: "24px 16px", color: "#a1a1aa", fontSize: 13, textAlign: "center" }}>
                No bots match your filters.
              </div>
            ) : (
              <>
                {/* Bots following global rules */}
                {globalBots.length > 0 && (
                  <>
                    <div className="cw-section-label">Following global rules</div>
                    {globalBots.map(({ bot, botStatus }, idx) => (
                      <BotRow key={bot.name} bot={bot} botStatus={botStatus} idx={idx} />
                    ))}
                  </>
                )}
                {/* Bots with specific rules */}
                {specificBots.length > 0 && (
                  <>
                    <div className="cw-section-label">Bot-specific rules</div>
                    {specificBots.map(({ bot, botStatus }, idx) => (
                      <BotRow key={bot.name} bot={bot} botStatus={botStatus} idx={globalBots.length + idx} />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* robots.txt modal */}
      {showModal && (
        <div className="cw-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="cw-modal" onClick={e => e.stopPropagation()}>
            <div className="cw-modal-head">
              <div className="cw-modal-title">
                <FileText size={16} className="cw-modal-title-icon" />
                <div>
                  <div className="cw-modal-title-text">{robotsTxtUrl || "robots.txt"}</div>
                  <div className="cw-modal-subtitle">
                    {!localContent
                      ? "Unable to load — click Retry inside to try again."
                      : modalBotName
                        ? <>Showing rules for <strong>{modalBotName}</strong>{highlightedLines.size > 0 ? ` — lines ${Math.min(...Array.from(highlightedLines))}–${Math.max(...Array.from(highlightedLines))} highlighted` : " — following global rules"}</>
                        : "Describes the instructions set on the site about which parts bots should and should not visit."
                    }
                  </div>
                </div>
              </div>
              <button className="cw-modal-close" onClick={() => setShowModal(false)} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div
              className="cw-modal-body"
              ref={el => {
                if (el && localContent && highlightFirstLine > 3) {
                  setTimeout(() => { el.scrollTop = Math.max(0, (highlightFirstLine - 3) * 22); }, 60);
                }
              }}
            >
              {localContent ? (
                robotsLines.map((line, i) => (
                  <RobotLine key={i} line={line} num={i + 1} highlighted={highlightedLines.has(i + 1)} />
                ))
              ) : (
                <div className="cw-modal-empty">
                  <div className="cw-modal-empty-icon">
                    <FileText size={28} />
                  </div>
                  <div className="cw-modal-empty-title">Could not load robots.txt</div>
                  <div className="cw-modal-empty-desc">
                    {localError ?? "No content available."}
                  </div>
                  <a
                    href={robotsTxtUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cw-modal-empty-link"
                  >
                    Open {robotsTxtUrl} directly ↗
                  </a>
                  <button
                    className="cw-tester-btn"
                    style={{ marginTop: 8, alignSelf: "center" }}
                    onClick={async () => {
                      if (!domain) return;
                      const result = await fetchRobotsTxt(domain);
                      setLocalContent(result.content);
                      setLocalError(result.error);
                      setLastFetchedAt(new Date().toISOString());
                    }}
                  >
                    Retry fetch
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
