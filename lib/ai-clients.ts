import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type EngineCitation = { url: string; domain: string; title: string };

export { DEFAULT_ENGINES, type Engine } from "./engines";

export type ErrorCode =
  | "MISSING_KEY"
  | "INVALID_KEY"
  | "RATE_LIMITED"
  | "API_ERROR"
  | "NETWORK_ERROR";

export type EngineResult =
  | { ok: true; text: string; citations: EngineCitation[]; modelSnapshot: string }
  | { ok: false; error: string; errorCode: ErrorCode; modelSnapshot: string };

const PLACEHOLDER_RX = /\.\.\.|^dummy$/i;

export function keyState(
  key: string | undefined,
  allowedPrefixes?: string[],
): { ok: boolean; reason?: string } {
  if (!key || key.trim().length === 0) return { ok: false, reason: "Key is missing in .env.local" };
  if (PLACEHOLDER_RX.test(key)) return { ok: false, reason: "Key looks like a placeholder (contains '...' or 'dummy')" };
  if (allowedPrefixes && !allowedPrefixes.some((p) => key.startsWith(p))) {
    return { ok: false, reason: `Unexpected key prefix — expected one of: ${allowedPrefixes.join(", ")}` };
  }
  return { ok: true };
}

function extractUrls(text: string): EngineCitation[] {
  const urlRegex = /(https?:\/\/[^\s\)]+)/g;
  const urls = text.match(urlRegex) || [];
  return urls
    .map((url) => {
      try {
        const u = new URL(url.replace(/[.,;:]+$/, ""));
        return { url: u.href, domain: u.hostname.replace(/^www\./, ""), title: u.hostname };
      } catch {
        return null;
      }
    })
    .filter((c): c is EngineCitation => c !== null);
}

function safeDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function classifyError(err: unknown): { code: ErrorCode; msg: string } {
  const e = err as { message?: string; status?: number; code?: string; response?: { status?: number } };
  const msg = e?.message ?? String(err);
  const status = e?.status ?? e?.response?.status;
  if (status === 401 || status === 403) return { code: "INVALID_KEY", msg };
  if (status === 429) return { code: "RATE_LIMITED", msg };
  if (typeof status === "number" && status >= 500) return { code: "API_ERROR", msg };
  if (e?.code === "ENOTFOUND" || e?.code === "ECONNREFUSED" || e?.code === "ETIMEDOUT") {
    return { code: "NETWORK_ERROR", msg };
  }
  return { code: "API_ERROR", msg };
}

const URL_NUDGE = "\n\nInclude website URLs to companies/tools you mention so I can cite them.";

// ─── OpenAI / ChatGPT ─────────────────────────────────────────────────
async function callOpenAI(query: string): Promise<EngineResult> {
  const model = "gpt-4o-mini";
  const snapshot = `openai:${model}`;
  const k = keyState(process.env.OPENAI_API_KEY, ["sk-"]);
  if (!k.ok) return { ok: false, error: k.reason!, errorCode: "MISSING_KEY", modelSnapshot: snapshot };
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: query + URL_NUDGE }],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    return { ok: true, text, citations: extractUrls(text), modelSnapshot: snapshot };
  } catch (err) {
    const c = classifyError(err);
    return { ok: false, error: c.msg, errorCode: c.code, modelSnapshot: snapshot };
  }
}

// ─── Anthropic / Claude ───────────────────────────────────────────────
async function callClaude(query: string): Promise<EngineResult> {
  const model = "claude-haiku-4-5-20251001";
  const snapshot = `anthropic:${model}`;
  const k = keyState(process.env.ANTHROPIC_API_KEY, ["sk-ant-"]);
  if (!k.ok) return { ok: false, error: k.reason!, errorCode: "MISSING_KEY", modelSnapshot: snapshot };
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const msg = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: query + URL_NUDGE }],
    });
    const text = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return { ok: true, text, citations: extractUrls(text), modelSnapshot: snapshot };
  } catch (err) {
    const c = classifyError(err);
    return { ok: false, error: c.msg, errorCode: c.code, modelSnapshot: snapshot };
  }
}

// ─── Google Gemini ────────────────────────────────────────────────────
async function callGemini(query: string): Promise<EngineResult> {
  const modelName = "gemini-2.5-flash";
  const snapshot = `google:${modelName}`;
  const k = keyState(process.env.GEMINI_API_KEY);
  if (!k.ok) return { ok: false, error: k.reason!, errorCode: "MISSING_KEY", modelSnapshot: snapshot };
  try {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = client.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(query + URL_NUDGE);
    const text = result.response.text();
    return { ok: true, text, citations: extractUrls(text), modelSnapshot: snapshot };
  } catch (err) {
    const c = classifyError(err);
    return { ok: false, error: c.msg, errorCode: c.code, modelSnapshot: snapshot };
  }
}

// ─── Perplexity ───────────────────────────────────────────────────────
async function callPerplexity(query: string): Promise<EngineResult> {
  const model = "sonar";
  const snapshot = `perplexity:${model}`;
  const k = keyState(process.env.PERPLEXITY_API_KEY, ["pplx-"]);
  if (!k.ok) return { ok: false, error: k.reason!, errorCode: "MISSING_KEY", modelSnapshot: snapshot };
  try {
    const client = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY!,
      baseURL: "https://api.perplexity.ai",
    });
    const completion = (await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: query }],
    })) as unknown as {
      choices: { message: { content: string } }[];
      citations?: string[];
    };
    const text = completion.choices[0]?.message?.content ?? "";
    const pplxCitations = completion.citations ?? [];
    const cites: EngineCitation[] =
      pplxCitations.length > 0
        ? pplxCitations
            .map((url) => {
              try {
                const u = new URL(url);
                return { url: u.href, domain: u.hostname.replace(/^www\./, ""), title: u.hostname };
              } catch {
                return null;
              }
            })
            .filter((c): c is EngineCitation => c !== null)
        : extractUrls(text);
    return { ok: true, text, citations: cites, modelSnapshot: snapshot };
  } catch (err) {
    const c = classifyError(err);
    return { ok: false, error: c.msg, errorCode: c.code, modelSnapshot: snapshot };
  }
}

// ─── Groq ─────────────────────────────────────────────────────────────
async function callGroq(query: string): Promise<EngineResult> {
  const model = "llama-3.3-70b-versatile";
  const snapshot = `groq:${model}`;
  const k = keyState(process.env.GROQ_API_KEY, ["gsk_"]);
  if (!k.ok) return { ok: false, error: k.reason!, errorCode: "MISSING_KEY", modelSnapshot: snapshot };
  try {
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY!,
      baseURL: "https://api.groq.com/openai/v1",
    });
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: query + URL_NUDGE }],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    return { ok: true, text, citations: extractUrls(text), modelSnapshot: snapshot };
  } catch (err) {
    const c = classifyError(err);
    return { ok: false, error: c.msg, errorCode: c.code, modelSnapshot: snapshot };
  }
}

// ─── SerpAPI Google AI Overviews ──────────────────────────────────────
async function callAIOverviews(query: string): Promise<EngineResult> {
  const snapshot = "serpapi:google_ai_overview";
  const k = keyState(process.env.SERPAPI_KEY);
  if (!k.ok) return { ok: false, error: k.reason!, errorCode: "MISSING_KEY", modelSnapshot: snapshot };
  try {
    const params = new URLSearchParams({
      engine: "google",
      q: query,
      api_key: process.env.SERPAPI_KEY!,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text();
      const code: ErrorCode =
        res.status === 401 || res.status === 403 ? "INVALID_KEY"
        : res.status === 429 ? "RATE_LIMITED"
        : "API_ERROR";
      return {
        ok: false,
        error: `SerpAPI ${res.status}: ${body.slice(0, 200)}`,
        errorCode: code,
        modelSnapshot: snapshot,
      };
    }
    const data = (await res.json()) as {
      ai_overview?: {
        text_blocks?: { snippet?: string; title?: string }[];
        references?: { link: string; title?: string; source?: string }[];
      };
      organic_results?: { title?: string; snippet?: string; link?: string }[];
    };
    let text = "";
    let cites: EngineCitation[] = [];
    if (data.ai_overview) {
      text = (data.ai_overview.text_blocks ?? [])
        .map((b) => b.snippet ?? b.title ?? "")
        .join("\n");
      cites = (data.ai_overview.references ?? [])
        .filter((r) => !!r.link)
        .map((r) => ({
          url: r.link,
          domain: safeDomain(r.link),
          title: r.title ?? r.source ?? "",
        }));
    } else {
      text = (data.organic_results ?? [])
        .slice(0, 5)
        .map((r) => `${r.title ?? ""}: ${r.snippet ?? ""}`)
        .join("\n");
      cites = (data.organic_results ?? [])
        .slice(0, 5)
        .filter((r) => !!r.link)
        .map((r) => ({
          url: r.link!,
          domain: safeDomain(r.link!),
          title: r.title ?? "",
        }));
    }
    return { ok: true, text, citations: cites, modelSnapshot: snapshot };
  } catch (err) {
    const c = classifyError(err);
    return { ok: false, error: c.msg, errorCode: c.code, modelSnapshot: snapshot };
  }
}

export async function callAIEngine(engine: string, query: string): Promise<EngineResult> {
  console.log(`\n🚀 [${engine}] ${query.substring(0, 100)}...`);
  let result: EngineResult;
  switch (engine) {
    case "ChatGPT": result = await callOpenAI(query); break;
    case "Claude": result = await callClaude(query); break;
    case "Gemini": result = await callGemini(query); break;
    case "Perplexity": result = await callPerplexity(query); break;
    case "AI Overviews": result = await callAIOverviews(query); break;
    case "Groq": result = await callGroq(query); break;
    default:
      result = { ok: false, error: `Unknown engine: ${engine}`, errorCode: "API_ERROR", modelSnapshot: `unknown:${engine}` };
  }
  if (result.ok) {
    console.log(`✅ [${engine}] ${result.text.substring(0, 150)}...`);
  } else {
    console.error(`❌ [${engine}] [${result.errorCode}] ${result.error}`);
  }
  return result;
}

const BRAND_EXTRACT_SYSTEM = `You are a data extraction expert. Extract any brand or company names mentioned in the following text.
Return ONLY a valid JSON array of objects with these keys:
- brandId: The name of the brand
- sentiment: 0-100 score (0=negative, 100=positive, 50=neutral)
- confidence: 0.0-1.0
- mentionText: exact quote of the mention
- position: order of appearance (1 for first, etc.)

If no brands are found, return []. Return ONLY the JSON, no other text.`;

export type BrandExtraction = {
  brandId?: string;
  name?: string;
  mentionText?: string;
  sentiment?: number;
  confidence?: number;
  position?: number;
};

function parseBrandJson(raw: string): BrandExtraction[] {
  const match = raw.match(/\[[\s\S]*\]/);
  try {
    const parsed = JSON.parse(match ? match[0] : "[]");
    return Array.isArray(parsed) ? (parsed as BrandExtraction[]) : [];
  } catch {
    return [];
  }
}

export async function extractBrandsWithLLM(text: string): Promise<BrandExtraction[]> {
  // Try Anthropic with prompt caching first (per docs/handoff/03-ai-engines-and-apis.md)
  if (keyState(process.env.ANTHROPIC_API_KEY, ["sk-ant-"]).ok) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: [
          { type: "text", text: BRAND_EXTRACT_SYSTEM, cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: text }],
      });
      const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      return parseBrandJson(raw);
    } catch (e) {
      console.error("[brand-extract] Anthropic failed:", (e as Error)?.message);
    }
  }

  // Fallback to OpenAI
  if (keyState(process.env.OPENAI_API_KEY, ["sk-"]).ok) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      const r = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: BRAND_EXTRACT_SYSTEM },
          { role: "user", content: text },
        ],
      });
      return parseBrandJson(r.choices[0]?.message?.content ?? "[]");
    } catch (e) {
      console.error("[brand-extract] OpenAI failed:", (e as Error)?.message);
    }
  }

  // Final fallback to Groq
  if (keyState(process.env.GROQ_API_KEY, ["gsk_"]).ok) {
    try {
      const client = new OpenAI({
        apiKey: process.env.GROQ_API_KEY!,
        baseURL: "https://api.groq.com/openai/v1",
      });
      const r = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: BRAND_EXTRACT_SYSTEM },
          { role: "user", content: text },
        ],
      });
      return parseBrandJson(r.choices[0]?.message?.content ?? "[]");
    } catch (e) {
      console.error("[brand-extract] Groq failed:", (e as Error)?.message);
    }
  }

  return [];
}
