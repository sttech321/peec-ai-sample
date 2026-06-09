"use server";

import { db } from "../../db";
import { prompts, topics, promptSuggestions, brandProfiles } from "../../db/schema";
import { revalidatePath } from "next/cache";
import { getActiveProjectId, getWorkspaceId } from "../../lib/project-context";
import { and, eq } from "drizzle-orm";

export type SuggestionIntent = "transactional" | "informational" | "navigational" | "commercial";

export interface SuggestedPrompt {
  id: string;
  query: string;
  intentType: SuggestionIntent;
  volumeTier: string;
  location: string;
  topicName: string | null;
  createdAt: string;
}

export async function getPromptSuggestions(): Promise<SuggestedPrompt[]> {
  const projectId = await getActiveProjectId();
  const rows = await db
    .select()
    .from(promptSuggestions)
    .where(and(eq(promptSuggestions.projectId, projectId), eq(promptSuggestions.status, "pending")))
    .orderBy(promptSuggestions.createdAt);
  return rows.map((r) => ({
    id: r.id,
    query: r.query,
    intentType: (r.intentType ?? "informational") as SuggestionIntent,
    volumeTier: r.volumeTier ?? "Medium",
    location: r.location ?? "US",
    topicName: r.topicName ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

const SUGGESTION_SYSTEM = `You are a search intent expert. Given a brand profile, generate realistic AI search prompts that users might type into ChatGPT, Perplexity, or Google when looking for services like this brand.

Return ONLY a valid JSON array. Each item must have:
- "query": full prompt text (8-20 words, natural question or statement)
- "intent": one of transactional | informational | navigational | commercial
- "topic": short category (2-4 words)

Generate 15-20 diverse prompts. Return ONLY the JSON array, no other text.`;

export async function generatePromptSuggestions(): Promise<{ ok: boolean; count: number; error?: string }> {
  const projectId = await getActiveProjectId();
  const workspaceId = await getWorkspaceId();

  const [profileRow] = await db
    .select({ data: brandProfiles.data })
    .from(brandProfiles)
    .where(eq(brandProfiles.projectId, projectId))
    .limit(1);

  const profile = profileRow?.data as Record<string, unknown> | null;
  if (!profile) return { ok: false, count: 0, error: "No brand profile found. Complete setup first." };

  const userMsg = [
    `Brand: ${profile.companyName ?? ""}`,
    `Domain: ${profile.domain ?? ""}`,
    `Industry: ${profile.industry ?? ""}`,
    `Description: ${profile.description ?? ""}`,
    `Services: ${Array.isArray(profile.services) ? (profile.services as {name:string}[]).map((s) => s.name).join(", ") : ""}`,
    `Identity: ${Array.isArray(profile.identityTraits) ? (profile.identityTraits as string[]).join(", ") : ""}`,
  ].join("\n");

  const { keyState } = await import("../../lib/ai-clients");
  let rawJson = "";

  if (keyState(process.env.ANTHROPIC_API_KEY, ["sk-ant-"]).ok) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: [{ type: "text", text: SUGGESTION_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMsg }],
      });
      rawJson = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    } catch (e) { console.error("[suggestions] Anthropic failed:", (e as Error)?.message); }
  }

  if (!rawJson && keyState(process.env.OPENAI_API_KEY, ["sk-"]).ok) {
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      const r = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SUGGESTION_SYSTEM }, { role: "user", content: userMsg }],
      });
      rawJson = r.choices[0]?.message?.content ?? "";
    } catch (e) { console.error("[suggestions] OpenAI failed:", (e as Error)?.message); }
  }

  if (!rawJson) return { ok: false, count: 0, error: "AI generation failed. Check API keys." };

  let items: { query: string; intent: string; topic: string }[] = [];
  try {
    const match = rawJson.match(/\[[\s\S]*\]/);
    items = JSON.parse(match ? match[0] : "[]");
    if (!Array.isArray(items)) items = [];
  } catch { return { ok: false, count: 0, error: "Failed to parse AI response." }; }

  if (items.length === 0) return { ok: false, count: 0, error: "No suggestions generated." };

  await db.delete(promptSuggestions).where(
    and(eq(promptSuggestions.projectId, projectId), eq(promptSuggestions.status, "pending"))
  );

  const VALID_INTENTS = ["transactional", "informational", "navigational", "commercial"];
  const rows = items
    .filter((i) => i.query?.trim().length > 0 && i.query.length <= 500)
    .map((i) => ({
      workspaceId,
      projectId,
      query: i.query.trim(),
      intentType: VALID_INTENTS.includes(i.intent) ? i.intent : "informational",
      volumeTier: "Medium",
      location: "US",
      topicName: i.topic?.trim() ?? null,
      status: "pending",
    }));

  await db.insert(promptSuggestions).values(rows);
  revalidatePath("/prompts");
  return { ok: true, count: rows.length };
}

export async function acceptSuggestion(id: string): Promise<{ ok: boolean }> {
  const workspaceId = await getWorkspaceId();
  const projectId = await getActiveProjectId();

  const [s] = await db
    .select()
    .from(promptSuggestions)
    .where(and(eq(promptSuggestions.id, id), eq(promptSuggestions.projectId, projectId)))
    .limit(1);
  if (!s) return { ok: false };

  let [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.projectId, projectId), eq(topics.name, s.topicName ?? "General Topic")))
    .limit(1);

  if (!topic) {
    const [created] = await db
      .insert(topics)
      .values({ workspaceId, projectId, name: s.topicName ?? "General Topic" })
      .returning({ id: topics.id });
    topic = created;
  }

  await db.insert(prompts).values({
    workspaceId,
    projectId,
    topicId: topic.id,
    query: s.query,
    volumeTier: (s.volumeTier ?? "Medium") as "Low" | "Medium" | "High" | "Very High",
    location: s.location ?? "US",
  });

  await db.update(promptSuggestions).set({ status: "accepted" }).where(eq(promptSuggestions.id, id));
  revalidatePath("/prompts");
  return { ok: true };
}

export async function rejectSuggestion(id: string): Promise<{ ok: boolean }> {
  const projectId = await getActiveProjectId();
  await db.update(promptSuggestions)
    .set({ status: "rejected" })
    .where(and(eq(promptSuggestions.id, id), eq(promptSuggestions.projectId, projectId)));
  revalidatePath("/prompts");
  return { ok: true };
}

export async function acceptAllSuggestions(): Promise<{ ok: boolean; accepted: number }> {
  const projectId = await getActiveProjectId();
  const pending = await db
    .select()
    .from(promptSuggestions)
    .where(and(eq(promptSuggestions.projectId, projectId), eq(promptSuggestions.status, "pending")));
  let accepted = 0;
  for (const s of pending) {
    const r = await acceptSuggestion(s.id);
    if (r.ok) accepted++;
  }
  revalidatePath("/prompts");
  return { ok: true, accepted };
}

export async function rejectAllSuggestions(): Promise<{ ok: boolean; rejected: number }> {
  const projectId = await getActiveProjectId();
  const result = await db
    .update(promptSuggestions)
    .set({ status: "rejected" })
    .where(and(eq(promptSuggestions.projectId, projectId), eq(promptSuggestions.status, "pending")))
    .returning({ id: promptSuggestions.id });
  revalidatePath("/prompts");
  return { ok: true, rejected: result.length };
}
