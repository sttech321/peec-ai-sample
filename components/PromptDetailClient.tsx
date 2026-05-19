"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Settings, ChevronDown, MessageSquare, Play, Loader2,
} from "lucide-react";
import ChatModal from "./ChatModal";
import EngineIcon from "./EngineIcon";
import DomainFavicon from "./DomainFavicon";
import { DateRangeValue, makePresetRange } from "./DateRangeDropdown";
import PromptSettingsModal from "./PromptSettingsModal";
import PageFilterBar, {
  PageFilterBrand,
  PageFilterDateRange,
} from "./PageFilterBar";
import { addBrand } from "../app/actions/brands";
import { guessBrandDomain } from "../lib/brand-domain";
import {
  ChatFact, ChatRecordView, Resolution,
  aggregateBrands, aggregateDomains, totalCitations, toChatRecords,
  buildVisibilitySeries, filterByEngines, filterByDateRange, aggregateByCategory,
  previousPeriod,
} from "../lib/chat-aggregations";
import { classifyDomain, DOMAIN_TYPE_COLORS } from "../lib/url-aggregations";
import TypeDropdown from "./TypeDropdown";

interface ProjectBrand {
  name: string;
  isOwn: boolean;
  domains?: string[];
}

interface PromptInfo {
  id: string;
  query: string;
  createdAt: string;
  volumeTier: string;
  topicName: string;
  projectName: string;
  isActive: boolean;
  location: string;
}

interface ProjectTag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  prompt: PromptInfo;
  chatFacts: ChatFact[];
  projectBrands: ProjectBrand[];
  availableTags: ProjectTag[];
  selectedTagIds: string[];
}


function formatCitationCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

const VOLUME_TIER_LEVEL: Record<string, number> = {
  "Very High": 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function volumeLevel(tier: string): number {
  return VOLUME_TIER_LEVEL[tier] ?? 2;
}

function formatDelta(diff: number, suffix = "%"): { text: string; cls: "up" | "down" | "flat" } {
  if (!isFinite(diff) || Math.abs(diff) < 0.05) return { text: `0${suffix}`, cls: "flat" };
  const sign = diff > 0 ? "+" : "";
  return { text: `${sign}${diff.toFixed(1)}${suffix}`, cls: diff > 0 ? "up" : "down" };
}

function formatTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffHr = Math.floor(diffMs / 3600000);
  if (diffHr < 1) return "just now";
  if (diffHr < 24) return `${diffHr} hr ago`;
  return `${Math.floor(diffHr / 24)} day ago`;
}

export default function PromptDetailClient({ prompt, chatFacts, projectBrands, availableTags, selectedTagIds }: Props) {
  const router = useRouter();
  const [resolution, setResolution] = useState<Resolution>("W");
  const [selectedChat, setSelectedChat] = useState<ChatRecordView | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [typeOverrides, setTypeOverrides] = useState<Map<string, string>>(new Map());
  const [openTypeDropdown, setOpenTypeDropdown] = useState<string | null>(null);

  const allAvailableModels = useMemo(() => {
    const set = new Set<string>();
    for (const c of chatFacts) set.add(c.engine);
    const found = Array.from(set);
    const defaults = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Groq"];
    for (const d of defaults) if (!found.includes(d)) found.push(d);
    return found;
  }, [chatFacts]);

  // Adapt ProjectBrand (name + isOwn + optional domains[]) to the
  // PageFilterBrand shape PageFilterBar expects ({ id, name, isOwn, domain }).
  // We use name as id so the strings PageFilterBar returns in onBrandsChange
  // are the same name-keyed identifiers selectedBrands is keyed on.
  const pageFilterBrands: PageFilterBrand[] = useMemo(
    () =>
      projectBrands.map((b) => ({
        id: b.name,
        name: b.name,
        isOwn: b.isOwn,
        // Fall back to a guessed domain so the favicon lookup works for
        // auto-tracked brands that don't have a domain configured yet.
        // Same heuristic used by lib/page-filter-data.ts:getPageFilterData.
        domain: b.domains?.[0] ?? guessBrandDomain(b.name),
      })),
    [projectBrands],
  );

  // Resolve a domain for any extracted brand name — prefer a domain configured
  // on the project's brand row, fall back to the heuristic guess. Used by the
  // Top 7 Brands table to render real favicons via DomainFavicon.
  const brandDomainByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of projectBrands) {
      m.set(b.name, b.domains?.[0] ?? guessBrandDomain(b.name));
    }
    return m;
  }, [projectBrands]);

  const [selectedModels, setSelectedModels] = useState<string[]>(allAvailableModels);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => makePresetRange("30"));
  const [selectedBrands, setSelectedBrands] = useState<string[] | null>(null);
  const [mentionedOnly, setMentionedOnly] = useState(false);

  const runScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanStatus(`Querying ${selectedModels.length} engine${selectedModels.length === 1 ? "" : "s"}…`);
    try {
      const engines = selectedModels.join(",");
      const res = await fetch(
        `/api/run-daily-scan?promptId=${encodeURIComponent(prompt.id)}&engines=${encodeURIComponent(engines)}`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Scan failed (HTTP ${res.status})`);
      }
      setScanStatus(
        data.mode === "inngest"
          ? `Dispatched ${data.dispatched} jobs — results stream in shortly.`
          : `Completed ${data.dispatched} engine calls. Refreshing…`,
      );
      router.refresh();
      window.setTimeout(() => setScanStatus(null), 4000);
    } catch (err) {
      setScanStatus(err instanceof Error ? `Error: ${err.message}` : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const stableBrandColors = useMemo(() => {
    const all = aggregateBrands(chatFacts, 20);
    const map: Record<string, string> = {};
    for (const b of all) map[b.name] = b.color;
    return map;
  }, [chatFacts]);

  const filteredChats = useMemo(
    () => filterByDateRange(filterByEngines(chatFacts, selectedModels), dateRange),
    [chatFacts, selectedModels, dateRange],
  );

  // Full ranking of every brand seen for this prompt — drives both the top 7
  // table and any overflow rows for pinned competitors that don't make the cut.
  const fullRanking = useMemo(
    () => aggregateBrands(filteredChats, 500, undefined, stableBrandColors),
    [filteredChats, stableBrandColors],
  );

  // Real rank (1-indexed) by brand name, for the "#36" overflow label.
  const rankByName = useMemo(() => {
    const m = new Map<string, number>();
    fullRanking.forEach((b, i) => m.set(b.name, i + 1));
    return m;
  }, [fullRanking]);

  // Pinned brands are *always* shown: tracked-own brands by default, plus any
  // competitor(s) the user selected in the Brands dropdown. Per spec the
  // dropdown is "one at a time" but we tolerate any number — they all overflow.
  const pinnedNames = useMemo(() => {
    const names = new Set<string>();
    for (const b of projectBrands) if (b.isOwn) names.add(b.name);
    if (selectedBrands !== null) for (const n of selectedBrands) names.add(n);
    return names;
  }, [projectBrands, selectedBrands]);

  const top7 = useMemo(() => fullRanking.slice(0, 7), [fullRanking]);

  // Brands that we want on the chart/table but aren't in the top 7. Renders as
  // overflow rows at the bottom of the table with their real rank.
  const overflowBrands = useMemo(() => {
    const top7Names = new Set(top7.map((b) => b.name));
    return fullRanking.filter(
      (b) => pinnedNames.has(b.name) && !top7Names.has(b.name),
    );
  }, [top7, fullRanking, pinnedNames]);

  const brands = useMemo(
    () => [...top7, ...overflowBrands],
    [top7, overflowBrands],
  );

  const domains = useMemo(() => aggregateDomains(filteredChats, 10), [filteredChats]);
  const totalDomainCitations = useMemo(() => totalCitations(filteredChats), [filteredChats]);

  const chartData = useMemo(
    () => buildVisibilitySeries(filteredChats, brands.map((b) => b.name), resolution, dateRange),
    [filteredChats, brands, resolution, dateRange],
  );

  // ── Previous period (for delta indicators) ──────────────────────────────────
  const filteredPrevious = useMemo(() => {
    if (dateRange.preset === "all") return [];
    const prev = previousPeriod(dateRange);
    return filterByDateRange(filterByEngines(chatFacts, selectedModels), prev);
  }, [chatFacts, selectedModels, dateRange]);

  const prevFullRanking = useMemo(
    () => aggregateBrands(filteredPrevious, 500, undefined, stableBrandColors),
    [filteredPrevious, stableBrandColors],
  );
  const prevByName = useMemo(() => {
    const map = new Map<string, { count: number; sentiment: number; position: number }>();
    prevFullRanking.forEach((b) => map.set(b.name, { count: b.count, sentiment: b.sentiment, position: b.position }));
    return { map, total: filteredPrevious.length };
  }, [prevFullRanking, filteredPrevious]);

  // ── Own brand ────────────────────────────────────────────────────────────────
  const ownBrand = useMemo(
    () => projectBrands.find((b) => b.isOwn)?.name ?? null,
    [projectBrands],
  );

  // ── SOV maps (all brands, both periods) ─────────────────────────────────────
  const sowMap = useMemo(() => {
    let totalMentions = 0;
    const hits = new Map<string, number>();
    for (const c of filteredChats) {
      const seen = new Set<string>();
      for (const b of c.brands) {
        if (seen.has(b.name)) continue;
        seen.add(b.name);
        totalMentions++;
        hits.set(b.name, (hits.get(b.name) ?? 0) + 1);
      }
    }
    const m = new Map<string, number>();
    for (const [name, h] of hits) m.set(name, totalMentions > 0 ? (h / totalMentions) * 100 : 0);
    return m;
  }, [filteredChats]);

  const prevSowMap = useMemo(() => {
    let totalMentions = 0;
    const hits = new Map<string, number>();
    for (const c of filteredPrevious) {
      const seen = new Set<string>();
      for (const b of c.brands) {
        if (seen.has(b.name)) continue;
        seen.add(b.name);
        totalMentions++;
        hits.set(b.name, (hits.get(b.name) ?? 0) + 1);
      }
    }
    const m = new Map<string, number>();
    for (const [name, h] of hits) m.set(name, totalMentions > 0 ? (h / totalMentions) * 100 : 0);
    return m;
  }, [filteredPrevious]);

  // ── Common Terms from rawResponse (bigrams, for Fanout Queries section) ──────
  const commonTerms = useMemo(() => {
    const stop = new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been","have","has","had","do","does","did","will","would","could","should","may","might","it","this","that","these","those","we","you","he","she","they","your","their","its","our","as","if","not","can","how","what","which","when","where","who","more","also","up","out","about","into","them","than","other","such","some","most","all","any","both","each","many","well","just","very","one","two","three","help","use","using","used","new","best","top","good","great","first","need","make","get","work","include","provide","offer","create","often","look","based","way","through","ai","like","know","brands"]);
    const counts = new Map<string, number>();
    for (const c of filteredChats) {
      if (!c.rawResponse) continue;
      const words = c.rawResponse.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !stop.has(w));
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([text, count]) => ({ text, count }));
  }, [filteredChats]);

  // ── Enriched recent chats ────────────────────────────────────────────────────
  interface EnrichedChat extends ChatRecordView {
    isMentioned: boolean;
    ownPosition: number | null;
  }
  const chatFactById = useMemo(() => {
    const m = new Map<string, ChatFact>();
    for (const c of filteredChats) m.set(c.id, c);
    return m;
  }, [filteredChats]);

  const recentChatsData = useMemo((): EnrichedChat[] => {
    const records = toChatRecords(filteredChats);
    records.sort((a, b) => new Date(b.runDate).getTime() - new Date(a.runDate).getTime());
    return records.map((chat) => {
      const fact = chatFactById.get(chat.id);
      const ownLower = ownBrand?.toLowerCase();
      const ownFact = ownLower && fact ? fact.brands.find((b) => b.name.toLowerCase() === ownLower) : undefined;
      return {
        ...chat,
        isMentioned: ownLower ? chat.brandsFound.some((b) => b.toLowerCase() === ownLower) : false,
        ownPosition: ownFact?.position ?? null,
      };
    });
  }, [filteredChats, chatFactById, ownBrand]);

  const displayedChats = useMemo(
    () => (mentionedOnly ? recentChatsData.filter((c) => c.isMentioned) : recentChatsData),
    [recentChatsData, mentionedOnly],
  );

  // ── Brand vs Source visibility ───────────────────────────────────────────
  // Spec: a chat counts toward "brand visibility" if any own brand is named in
  // the response, and toward "source visibility" if any source domain matches
  // an own brand's tracked domain — even when the brand itself wasn't named.
  const ownBrandSet = useMemo(
    () => new Set(projectBrands.filter((b) => b.isOwn).map((b) => b.name)),
    [projectBrands],
  );
  const ownDomainSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of projectBrands) {
      if (!b.isOwn) continue;
      for (const d of b.domains ?? []) if (d) s.add(d.toLowerCase());
    }
    return s;
  }, [projectBrands]);

  const competitorDomainSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of projectBrands) {
      if (b.isOwn) continue;
      for (const d of b.domains ?? []) if (d) s.add(d.toLowerCase());
    }
    return s;
  }, [projectBrands]);

  function domainMatchesOwn(domain: string, ownDomains: Set<string>): boolean {
    if (ownDomains.size === 0 || !domain) return false;
    const d = domain.toLowerCase().replace(/^www\./, "");
    for (const o of ownDomains) {
      if (d === o || d.endsWith("." + o)) return true;
    }
    return false;
  }

  const brandVsSource = useMemo(() => {
    const totalChats = filteredChats.length;
    if (totalChats === 0 || ownBrandSet.size === 0) {
      return { totalChats, brandChats: 0, sourceChats: 0, hasOwnBrand: ownBrandSet.size > 0 };
    }
    let brandChats = 0;
    let sourceChats = 0;
    for (const c of filteredChats) {
      const brandMentioned = c.brands.some((b) => ownBrandSet.has(b.name));
      const sourceCited = c.sources.some((s) => domainMatchesOwn(s.domain, ownDomainSet));
      if (brandMentioned) brandChats++;
      if (sourceCited) sourceChats++;
    }
    return { totalChats, brandChats, sourceChats, hasOwnBrand: true };
  }, [filteredChats, ownBrandSet, ownDomainSet]);

  const brandVisibilityPct =
    brandVsSource.totalChats > 0
      ? Math.round((brandVsSource.brandChats / brandVsSource.totalChats) * 100)
      : 0;
  const sourceVisibilityPct =
    brandVsSource.totalChats > 0
      ? Math.round((brandVsSource.sourceChats / brandVsSource.totalChats) * 100)
      : 0;

  function visibilityInsight(brandPct: number, sourcePct: number): {
    label: string;
    tone: "good" | "warn" | "info";
  } {
    if (brandPct === 0 && sourcePct === 0) {
      return { label: "Neither your brand nor your domain shows up yet.", tone: "warn" };
    }
    const delta = brandPct - sourcePct;
    if (Math.abs(delta) <= 5) {
      return { label: "Brand and source visibility are aligned.", tone: "good" };
    }
    if (delta > 0) {
      return {
        label:
          "AI mentions your brand more than it cites your content. Tightening on-page authority may help your domain catch up.",
        tone: "info",
      };
    }
    return {
      label:
        "Your domain is cited more than your brand is named. AI may not associate the content with your brand — strengthen brand mentions on the cited pages.",
      tone: "info",
    };
  }
  const insight = visibilityInsight(brandVisibilityPct, sourceVisibilityPct);

  const totalMentions = brands.reduce((s, b) => s + b.count, 0);
  const maxDomainCount = domains.length > 0 ? domains[0].count : 1;

  const categoryStats = useMemo(
    () => aggregateByCategory(filteredChats, (cat, dom) => classifyDomain(cat, dom, ownDomainSet, competitorDomainSet)),
    [filteredChats, ownDomainSet, competitorDomainSet],
  );
  const totalTypeCounts = Object.values(categoryStats).reduce((s, v) => s + v.count, 0);

  const createdDate = new Date(prompt.createdAt);
  const diffDays = Math.floor((Date.now() - createdDate.getTime()) / 86400000);
  const timeAgo = diffDays > 0 ? `${diffDays} day${diffDays > 1 ? "s" : ""} ago` : "today";

  return (
    <div className="prompt-detail-page">
      {selectedChat && <ChatModal chat={selectedChat} ownBrand={ownBrand ?? undefined} onClose={() => setSelectedChat(null)} />}
      {isSettingsOpen && (
        <PromptSettingsModal
          promptId={prompt.id}
          initialActive={prompt.isActive}
          initialLocation={prompt.location}
          availableTags={availableTags}
          selectedTagIds={selectedTagIds}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
      {/* ── Top bar ───────────────────────────────────────── */}
      <div className="pd-topbar">
        <div className="pd-breadcrumb">
          <MessageSquare size={13} className="pd-breadcrumb-icon" />
          <a href="/prompts" className="pd-breadcrumb-link">Prompts</a>
          <span className="pd-breadcrumb-sep">›</span>
          <span className="pd-breadcrumb-current">
            {prompt.query.length > 52
              ? prompt.query.slice(0, 52) + "..."
              : prompt.query}
          </span>
        </div>

        <div className="pd-topbar-actions">
          {scanStatus && (
            <span
              className={`pd-scan-status ${scanStatus.startsWith("Error") ? "pd-scan-status-error" : ""}`}
            >
              {scanStatus}
            </span>
          )}
          <button
            className="pd-run-scan-btn"
            onClick={runScan}
            disabled={isScanning || selectedModels.length === 0}
            title="Query selected AI engines now and refresh data"
          >
            {isScanning ? (
              <>
                <Loader2 size={14} strokeWidth={2} className="pd-spin" />
                <span>Running…</span>
              </>
            ) : (
              <>
                <Play size={14} strokeWidth={2} />
                <span>Run scan</span>
              </>
            )}
          </button>
          <button
            className="pd-settings-btn"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings size={14} strokeWidth={2} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      <div className="pd-filters">
        <PageFilterBar
          projectName={prompt.projectName}
          projectBrands={pageFilterBrands}
          availableTags={availableTags}
          hideTags
          initialDateRange={dateRange as unknown as PageFilterDateRange}
          initialModels={selectedModels}
          addBrandAction={addBrand}
          onBrandsChange={(ids) => setSelectedBrands(ids)}
          onDateChange={(r) => setDateRange(r as unknown as DateRangeValue)}
          onModelsChange={(engines) => setSelectedModels(engines)}
        />
      </div>

      {/* ── Header Card ───────────────────────────────────── */}
      <div className="pd-prompt-header">
        <span className="pd-header-label">Prompt</span>

        <h1 className="pd-prompt-title">{prompt.query}</h1>

        <div className="pd-meta-grid">
          <div className="pd-meta-item">
            <span className="pd-meta-label">Date added</span>
            <span className="pd-meta-value">{timeAgo}</span>
          </div>

          <div className="pd-meta-item">
            <span className="pd-meta-label">Topic</span>
            <span className="pd-meta-value">
              {prompt.topicName || "—"}
            </span>
          </div>

          <div className="pd-meta-item">
            <span className="pd-meta-label">Volume</span>

            <span className="pd-meta-value">
              <span
                className="pd-volume-bars"
                aria-label={prompt.volumeTier || "Medium"}
              >
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`pd-volume-bar ${
                      i <= volumeLevel(prompt.volumeTier)
                        ? "pd-volume-bar-on"
                        : ""
                    }`}
                  />
                ))}
              </span>
            </span>
          </div>

          <div className="pd-meta-item">
            <span className="pd-meta-label">Location</span>

            <span className="pd-meta-value pd-location">
              <img
                src={`https://flagcdn.com/w40/${(
                  prompt.location || "us"
                ).toLowerCase()}.png`}
                alt=""
                width={16}
                height={12}
                className="pd-flag-img"
              />

              {(prompt.location || "US").toUpperCase()}
            </span>
          </div>

          <div className="pd-meta-item">
            <span className="pd-meta-label">Status</span>

            <span className="pd-status-badge">
              {prompt.isActive ? "Active" : "Paused"}
            </span>
          </div>
        </div>
      </div>

      <div className="pd-section">
        <h2 className="pd-section-title">Overview</h2>
        <p className="pd-section-subtitle">How often each brand appears in AI generated discussions</p>

        <div className="pd-overview-grid">
          <div className="pd-chart-card">
            <div className="pd-chart-header">
              <div className="pd-chart-label">
                Visibility <span className="pd-info-icon" title="Brand visibility over time">ⓘ</span>
              </div>
              <div className="pd-resolution-toggle">
                {(["D", "W", "M"] as const).map((r) => (
                  <button key={r} className={`pd-res-btn ${resolution === r ? "pd-res-active" : ""}`}
                    onClick={() => setResolution(r)}>{r}</button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9", fontSize: 11 }} />
                {brands.map((b) => (
                  <Line key={b.name} type="monotone" dataKey={b.name} stroke={b.color} strokeWidth={2} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="pd-chart-footer">Showing data for 30 days</div>
          </div>

          <div className="pd-brands-card">
            <div className="pd-brands-header">
              <span className="pd-brands-title">Top 7 Brands <span className="pd-info-icon">ⓘ</span></span>
            </div>
            <table className="pd-brands-table">
              <thead>
                <tr>
                  <th></th><th>Brand</th>
                  <th className="pd-th-num">Visibility <ChevronDown size={9} style={{ display: "inline" }} /></th>
                  <th className="pd-th-num">SOV</th>
                  <th className="pd-th-num">Sentiment</th>
                  <th className="pd-th-num">Position</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b, i) => {
                  const vis = filteredChats.length > 0 ? Math.round((b.count / filteredChats.length) * 100) : 0;
                  const sov = Math.round(sowMap.get(b.name) ?? 0);
                  const prevData = prevByName.map.get(b.name);
                  const prevVis = prevByName.total > 0 ? Math.round(((prevData?.count ?? 0) / prevByName.total) * 100) : 0;
                  const prevSov = Math.round(prevSowMap.get(b.name) ?? 0);
                  const visDelta = formatDelta(vis - prevVis);
                  const sovDelta = formatDelta(sov - prevSov);
                  const sentDelta = formatDelta(b.sentiment - (prevData?.sentiment ?? b.sentiment));
                  const posDelta = formatDelta((prevData?.position ?? b.position) - b.position, "");
                  const isOverflow = i >= top7.length;
                  const realRank = rankByName.get(b.name) ?? i + 1;
                  const isFirstOverflow = isOverflow && i === top7.length;
                  return (
                    <React.Fragment key={b.name}>
                      {isFirstOverflow && (
                        <tr className="pd-brands-overflow-sep">
                          <td colSpan={6}>Pinned (outside top 7)</td>
                        </tr>
                      )}
                      <tr className={isOverflow ? "pd-brands-overflow-row" : undefined}>
                        <td className="pd-rank">#{realRank}</td>
                        <td className="pd-brand-cell">
                          <DomainFavicon
                            domain={brandDomainByName.get(b.name) ?? guessBrandDomain(b.name)}
                            size={16}
                          />
                          {b.name}
                          {pinnedNames.has(b.name) && projectBrands.find((pb) => pb.name === b.name)?.isOwn && (
                            <span className="pd-brand-you-badge">You</span>
                          )}
                        </td>
                        <td className="pd-td-num">
                          <span className="pd-vis-value">{vis}%</span>
                          {dateRange.preset !== "all" && <span className={`pd-delta pd-delta-${visDelta.cls}`}>{visDelta.text}</span>}
                        </td>
                        <td className="pd-td-num">
                          <span className="pd-vis-value">{sov}%</span>
                          {dateRange.preset !== "all" && <span className={`pd-delta pd-delta-${sovDelta.cls}`}>{sovDelta.text}</span>}
                        </td>
                        <td className="pd-td-num">
                          <span className="pd-vis-value">{b.sentiment ? b.sentiment.toFixed(0) : "—"}</span>
                          {dateRange.preset !== "all" && b.sentiment > 0 && <span className={`pd-delta pd-delta-${sentDelta.cls}`}>{sentDelta.text}</span>}
                        </td>
                        <td className="pd-td-num">
                          <span className="pd-vis-value">#{b.position ? b.position.toFixed(1) : "—"}</span>
                          {dateRange.preset !== "all" && b.position > 0 && <span className={`pd-delta pd-delta-${posDelta.cls}`}>{posDelta.text}</span>}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                {brands.length === 0 && (
                  <tr>
                    <td colSpan={6} className="pd-empty">
                      {isScanning
                        ? 'Querying engines — brands will appear once responses are parsed…'
                        : 'No brands extracted yet. Click "Run scan" above to query the selected AI engines.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="pd-section">
        <div className="pd-domains-header-row">
          <div>
            <h2 className="pd-section-title">Top Domains</h2>
            <p className="pd-section-subtitle">Top domains retrieved by AI models in their answers.</p>
          </div>
          <div className="pd-domains-links">
            <span className="pd-link-tab pd-link-active">All URLs</span>
            <span className="pd-link-tab">All domains</span>
          </div>
        </div>

        <div className="pd-domains-grid">
          <div className="pd-domains-table-card">
            <table className="pd-domains-table">
              <thead><tr><th>Domain</th><th>Retrieved</th><th>Citation rate</th><th>Type</th></tr></thead>
              <tbody>
                {domains.slice(0, 8).map((d, i) => {
                  const pct = ((d.count / maxDomainCount) * 100).toFixed(1);
                  const rate = (d.count / Math.max(totalDomainCitations, 1)).toFixed(1);
                  const defaultType = classifyDomain(d.category, d.domain, ownDomainSet, competitorDomainSet);
                  const typeLabel = typeOverrides.get(d.domain) ?? defaultType;
                  return (
                    <tr key={i}>
                      <td className="pd-domain-cell">
                        <DomainFavicon domain={d.domain} size={16} />
                        {d.domain}
                      </td>
                      <td>{pct}%</td>
                      <td>{rate}</td>
                      <td>
                        <div style={{ position: "relative", display: "inline-block" }}>
                          <span
                            className={`pd-type-badge pd-type-${typeLabel.toLowerCase()}`}
                            style={{ cursor: "pointer" }}
                            onClick={() => setOpenTypeDropdown(openTypeDropdown === d.domain ? null : d.domain)}
                          >
                            {typeLabel}
                          </span>
                          {openTypeDropdown === d.domain && (
                            <TypeDropdown
                              domain={d.domain}
                              currentType={typeLabel}
                              defaultType={defaultType}
                              onSelect={(t) => setTypeOverrides((prev) => new Map(prev).set(d.domain, t))}
                              onReset={() => setTypeOverrides((prev) => { const m = new Map(prev); m.delete(d.domain); return m; })}
                              onClose={() => setOpenTypeDropdown(null)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {domains.length === 0 && <tr><td colSpan={4} className="pd-empty">No domains found.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="pd-domain-types-card">
            <div className="pd-domain-types-header">
              <span className="pd-domain-types-title">Domain types</span>
              <span className="pd-domain-types-total">Total retrievals: {totalDomainCitations}</span>
            </div>
            <div className="pd-domain-types-list">
              {["Corporate", "UGC", "Other", "Reference", "You", "Competitor", "Editorial", "Institutional", "Related"].map((type) => {
                const stats = categoryStats[type] || { count: 0, topSources: [] };
                const pct = totalTypeCounts > 0 ? Math.round((stats.count / totalTypeCounts) * 100) : 0;
                return (
                  <div key={type} className="pd-dtype-row">
                    <div className="pd-dtype-label">
                      <span className="pd-dtype-dot" style={{ background: (DOMAIN_TYPE_COLORS as Record<string, string>)[type] || "#64748b" }}></span>
                      {type}
                    </div>
                    <div className="pd-dtype-bar-wrapper">
                      <div className="pd-dtype-bar" style={{ width: `${Math.max(pct, 1)}%`, background: (DOMAIN_TYPE_COLORS as Record<string, string>)[type] || "#64748b" }}></div>
                    </div>
                    <span className="pd-dtype-pct">{pct}%</span>
                    {stats.count > 0 && (
                      <div className="pd-dtype-tooltip">
                        <div className="pd-dtype-tooltip-header">
                          <span className="pd-dtype-tooltip-type">{type}</span>
                          <span className="pd-dtype-tooltip-count">{formatCitationCount(stats.count)} citations</span>
                        </div>
                        {stats.topSources.length > 0 && (
                          <>
                            <div className="pd-dtype-tooltip-label">Top sources</div>
                            <div className="pd-dtype-tooltip-sources">
                              {stats.topSources.map((s) => (
                                <DomainFavicon key={s.domain} domain={s.domain} size={18} />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Fanout Queries / Common Terms ────────────────────────────────── */}
      <div className="pd-section">
        <h2 className="pd-section-title">Fanout Queries</h2>
        <p className="pd-section-subtitle">Common themes extracted from AI responses for this prompt</p>
        <div className="pd-fanout-grid">
          <div className="pd-fanout-card">
            <div className="pd-fanout-card-header">
              <span className="pd-fanout-card-title">Common Terms</span>
            </div>
            {commonTerms.length === 0 ? (
              <div className="pd-fanout-empty">No data yet — run a scan to extract terms.</div>
            ) : (
              <div className="pd-common-terms-list">
                {commonTerms.map(({ text, count }, i) => {
                  const maxCount = commonTerms[0]?.count ?? 1;
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={i} className="pd-common-term-row">
                      <span className="pd-common-term-label">{text}</span>
                      <div className="pd-common-term-bar-wrap">
                        <div className="pd-common-term-bar" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="pd-common-term-count">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pd-fanout-card">
            <div className="pd-fanout-card-header">
              <span className="pd-fanout-card-title">Latest Queries</span>
            </div>
            {recentChatsData.length === 0 ? (
              <div className="pd-fanout-empty">No queries yet.</div>
            ) : (
              <div>
                {recentChatsData.slice(0, 8).map((chat) => (
                  <div key={chat.id} className="pd-fanout-query-row" onClick={() => setSelectedChat(chat)}>
                    <EngineIcon engine={chat.engine} />
                    <span className="pd-fanout-query-text">
                      {chat.rawResponse
                        ? chat.rawResponse.replace(/#+\s/g, "").slice(0, 90) + "…"
                        : prompt.query}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Chats ──────────────────────────────────────────────────── */}
      <div className="pd-section">
        <div className="pd-domains-header-row">
          <div>
            <h2 className="pd-section-title">Recent Chats</h2>
            <p className="pd-section-subtitle">Individual AI responses for this prompt</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 font-medium">
              {ownBrand ?? prompt.projectName} mentioned
            </span>
            <button
              className={`pd-recent-toggle ${mentionedOnly ? "pd-recent-toggle-on" : ""}`}
              onClick={() => setMentionedOnly((v) => !v)}
              aria-pressed={mentionedOnly}
            >
              <span className="pd-recent-toggle-track">
                <span className="pd-recent-toggle-thumb" />
              </span>
            </button>
          </div>
        </div>

        {displayedChats.length === 0 ? (
          <div className="pd-empty-chats">
            {mentionedOnly
              ? `No chats where ${ownBrand ?? prompt.projectName} was mentioned.`
              : "🔍 No recent chats recorded yet."}
          </div>
        ) : (
          <div className="pd-chats-table-wrap">
            <table className="pd-chats-table">
              <thead>
                <tr>
                  <th>Chat</th>
                  <th>{ownBrand ?? prompt.projectName} mentioned</th>
                  <th>Position</th>
                  <th>Mentions</th>
                  <th>Sources</th>
                  <th>Location</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {displayedChats.map((chat) => {
                  const snippet = chat.rawResponse
                    ? chat.rawResponse.replace(/#+\s/g, "").slice(0, 100) + "…"
                    : prompt.query ?? "—";
                  return (
                    <tr key={chat.id} className="pd-chat-row" onClick={() => setSelectedChat(chat)}>
                      <td className="pd-chat-text-cell">
                        <EngineIcon engine={chat.engine} />
                        <span className="pd-chat-snippet-text">{snippet}</span>
                      </td>
                      <td>
                        <span className={`pd-chat-yesno ${chat.isMentioned ? "pd-chat-yesno-yes" : "pd-chat-yesno-no"}`}>
                          {chat.isMentioned ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="pd-chat-pos-cell">
                        {chat.ownPosition !== null ? (
                          <span className="pd-chat-position">#{chat.ownPosition}</span>
                        ) : (
                          <span className="pd-chat-position-none">—</span>
                        )}
                      </td>
                      <td>
                        <div className="pd-chat-mentions-row">
                          {chat.brandsFound.slice(0, 3).map((name, idx) => (
                            <DomainFavicon
                              key={idx}
                              domain={brandDomainByName.get(name) ?? guessBrandDomain(name)}
                              size={16}
                            />
                          ))}
                          {chat.brandsFound.length > 3 && (
                            <span className="pd-mention-more">+{chat.brandsFound.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="pd-chat-mentions-row">
                          {chat.sourcesFound.slice(0, 3).map((s, idx) => (
                            <DomainFavicon key={idx} domain={s.domain} size={16} />
                          ))}
                          {chat.sourcesFound.length > 3 && (
                            <span className="pd-mention-more">+{chat.sourcesFound.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="pd-chat-location">
                        <img
                          src={`https://flagcdn.com/w40/${(prompt.location || "us").toLowerCase()}.png`}
                          alt={prompt.location || "us"}
                          width={16}
                          height={12}
                        />
                      </td>
                      <td className="pd-chat-created">{formatTimeAgo(chat.runDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
