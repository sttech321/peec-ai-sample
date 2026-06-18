import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { keyState } from "./ai-clients";

export type KeyStatus = {
  engine: string;
  envVar: string;
  configured: boolean;
  ok: boolean;
  reason?: string;
  latencyMs?: number;
  hint?: string;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: true; ms: number; value: T } | { ok: false; ms: number; err: unknown }> {
  const t = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t, value };
  } catch (err) {
    return { ok: false, ms: Date.now() - t, err };
  }
}

function errMsg(err: unknown): string {
  const e = err as { status?: number; message?: string };
  if (e?.status) return `${e.status} ${e?.message ?? "API error"}`;
  return e?.message ?? String(err);
}

async function checkOpenAI(): Promise<KeyStatus> {
  const base: KeyStatus = {
    engine: "ChatGPT",
    envVar: "OPENAI_API_KEY",
    configured: false,
    ok: false,
    hint: "Get a key at https://platform.openai.com/api-keys",
  };
  const k = keyState(process.env.OPENAI_API_KEY, ["sk-"]);
  if (!k.ok) return { ...base, reason: k.reason };
  base.configured = true;
  const r = await timed(() => new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }).models.list());
  if (!r.ok) return { ...base, reason: errMsg(r.err), latencyMs: r.ms };
  return { ...base, ok: true, latencyMs: r.ms };
}

async function checkAnthropic(): Promise<KeyStatus> {
  const base: KeyStatus = {
    engine: "Claude",
    envVar: "ANTHROPIC_API_KEY",
    configured: false,
    ok: false,
    hint: "Get a key at https://console.anthropic.com/settings/keys",
  };
  const k = keyState(process.env.ANTHROPIC_API_KEY, ["sk-ant-"]);
  if (!k.ok) return { ...base, reason: k.reason };
  base.configured = true;
  const r = await timed(() =>
    new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }).messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    }),
  );
  if (!r.ok) return { ...base, reason: errMsg(r.err), latencyMs: r.ms };
  return { ...base, ok: true, latencyMs: r.ms };
}

async function checkGemini(): Promise<KeyStatus> {
  const base: KeyStatus = {
    engine: "Gemini",
    envVar: "GEMINI_API_KEY",
    configured: false,
    ok: false,
    hint: "Get a key at https://aistudio.google.com/apikey",
  };
  const k = keyState(process.env.GEMINI_API_KEY);
  if (!k.ok) return { ...base, reason: k.reason };
  base.configured = true;
  const r = await timed(async () => {
    const c = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const m = c.getGenerativeModel({ model: "gemini-2.5-flash" });
    return m.generateContent("ping");
  });
  if (!r.ok) return { ...base, reason: errMsg(r.err), latencyMs: r.ms };
  return { ...base, ok: true, latencyMs: r.ms };
}

async function checkPerplexity(): Promise<KeyStatus> {
  const base: KeyStatus = {
    engine: "Perplexity",
    envVar: "PERPLEXITY_API_KEY",
    configured: false,
    ok: false,
    hint: "Get a key at https://www.perplexity.ai/settings/api",
  };
  const k = keyState(process.env.PERPLEXITY_API_KEY, ["pplx-"]);
  if (!k.ok) return { ...base, reason: k.reason };
  base.configured = true;
  const r = await timed(async () => {
    const c = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY!,
      baseURL: "https://api.perplexity.ai",
    });
    return c.chat.completions.create({
      model: "sonar",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    });
  });
  if (!r.ok) return { ...base, reason: errMsg(r.err), latencyMs: r.ms };
  return { ...base, ok: true, latencyMs: r.ms };
}

async function checkSerpAPI(): Promise<KeyStatus> {
  const base: KeyStatus = {
    engine: "AI Overviews",
    envVar: "SERPAPI_KEY",
    configured: false,
    ok: false,
    hint: "Get a key at https://serpapi.com/manage-api-key",
  };
  const k = keyState(process.env.SERPAPI_KEY);
  if (!k.ok) return { ...base, reason: k.reason };
  base.configured = true;
  const r = await timed(() =>
    fetch(`https://serpapi.com/account?api_key=${encodeURIComponent(process.env.SERPAPI_KEY!)}`),
  );
  if (!r.ok) return { ...base, reason: errMsg(r.err), latencyMs: r.ms };
  const res = r.value;
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ...base, reason: `${res.status} ${txt.slice(0, 200)}`, latencyMs: r.ms };
  }
  return { ...base, ok: true, latencyMs: r.ms };
}

async function checkGroq(): Promise<KeyStatus> {
  const base: KeyStatus = {
    engine: "Groq",
    envVar: "GROQ_API_KEY",
    configured: false,
    ok: false,
    hint: "Get a key at https://console.groq.com/keys",
  };
  const k = keyState(process.env.GROQ_API_KEY, ["gsk_"]);
  if (!k.ok) return { ...base, reason: k.reason };
  base.configured = true;
  const r = await timed(() =>
    new OpenAI({
      apiKey: process.env.GROQ_API_KEY!,
      baseURL: "https://api.groq.com/openai/v1",
    }).models.list(),
  );
  if (!r.ok) return { ...base, reason: errMsg(r.err), latencyMs: r.ms };
  return { ...base, ok: true, latencyMs: r.ms };
}

export async function checkAllKeys(): Promise<KeyStatus[]> {
  return Promise.all([
    checkOpenAI(),
    checkAnthropic(),
    checkGemini(),
    checkPerplexity(),
    checkSerpAPI(),
    checkGroq(),
  ]);
}
