"use server";

import { db } from "../../db";
import { prompts, topics } from "../../db/schema";
import { revalidatePath } from "next/cache";
import { inngest } from "../../inngest/client";
import { getActiveProjectId, WORKSPACE } from "../../lib/project-context";
import { runPipelineForAllEngines, type PipelineJob } from "../../lib/run-pipeline";
import { and, eq } from "drizzle-orm";

export async function addPrompt(formData: FormData) {
  const query = formData.get("query") as string;
  const workspaceId = WORKSPACE;

  if (!query || query.trim() === "") return;

  const projectId = await getActiveProjectId();

  let topic = await db.query.topics.findFirst({
    where: (t, { eq }) => eq(t.projectId, projectId),
  });
  if (!topic) {
    const insertedTopic = await db.insert(topics).values({
      workspaceId,
      projectId,
      name: "General Topic",
    }).returning();
    topic = insertedTopic[0];
  }

  await db.insert(prompts).values({
    workspaceId,
    projectId,
    topicId: topic.id,
    query,
    volumeTier: "Medium",
  });

  revalidatePath("/prompts");
  revalidatePath("/");
}

/**
 * Create a new topic in the active project and auto-generate N prompts for it.
 * `location` and `language` are accepted for prompt-generation context but
 * aren't persisted — the `topics` schema doesn't have those columns yet.
 */
export async function createTopic(args: {
  name: string;
  promptsPerTopic: number;
  location: string;
  language: string;
}): Promise<{ ok: boolean; topicId?: string; error?: string }> {
  const name = args.name.trim();
  if (!name) return { ok: false, error: "Topic name is required" };
  if (name.length > 255) return { ok: false, error: "Topic name too long" };

  const count = Math.max(1, Math.min(50, Math.floor(Number(args.promptsPerTopic) || 10)));
  const workspaceId = WORKSPACE;
  const projectId = await getActiveProjectId();

  const existing = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.projectId, projectId), eq(topics.name, name)))
    .limit(1);
  if (existing.length) return { ok: false, error: "A topic with that name already exists" };

  const [inserted] = await db
    .insert(topics)
    .values({ workspaceId, projectId, name })
    .returning({ id: topics.id });

  const stems = generatePromptStems(name, count, args.location, args.language);
  if (stems.length > 0) {
    await db.insert(prompts).values(
      stems.map((q) => ({
        workspaceId,
        projectId,
        topicId: inserted.id,
        query: q,
        volumeTier: "Medium" as const,
      })),
    );
  }

  revalidatePath("/prompts");
  revalidatePath("/");
  return { ok: true, topicId: inserted.id };
}

function generatePromptStems(
  topic: string,
  count: number,
  location: string,
  language: string,
): string[] {
  const t = topic.trim();
  const locTag = location && location !== "US" ? ` in ${location}` : "";
  const langTag = language && language !== "en" ? ` (${language})` : "";
  const stems = [
    `What are the best ${t}${locTag}?`,
    `Which ${t} are most reliable in 2026${locTag}?`,
    `Compare top ${t} for enterprise teams${locTag}.`,
    `Suggest affordable ${t} for startups.`,
    `Find ${t} with the best ROI.`,
    `Recommend ${t} for beginners.`,
    `Identify ${t} with strong customer support.`,
    `Show me trending ${t} this year.`,
    `Which ${t} offer the best free tier?`,
    `Best ${t} for global teams.`,
    `Top ${t} for compliance and security.`,
    `${t} with native integrations to popular tools.`,
    `Which ${t} have the easiest learning curve?`,
    `Suggest ${t} with advanced analytics.`,
    `Find ${t} with white-label options.`,
    `Top-rated ${t} for small businesses.`,
    `Compare pricing of leading ${t}.`,
    `${t} with the strongest API support.`,
    `Which ${t} are best for mobile-first teams${langTag}?`,
    `Most-cited ${t} according to industry reports.`,
  ];
  return stems.slice(0, Math.min(count, stems.length));
}

export async function runNow(promptId: string, query: string, selectedEngines?: string[]) {
  const workspaceId = WORKSPACE;
  const engines = selectedEngines && selectedEngines.length > 0
    ? selectedEngines
    : ["ChatGPT", "Claude", "Perplexity", "Gemini", "Groq"];

  const runDate = new Date().toISOString();

  const jobs: PipelineJob[] = engines.map((engine) => ({
    workspaceId,
    promptId,
    engine,
    runDate,
    query,
  }));

  // Try Inngest first; fall back to direct inline execution when dev server is not running.
  try {
    const events = jobs.map((j) => ({
      name: "prompt.run" as const,
      data: j,
    }));
    await inngest.send(events);
  } catch (err: unknown) {
    const isConnErr =
      err instanceof Error &&
      ((err as NodeJS.ErrnoException).code === "ECONNREFUSED" ||
        (err as NodeJS.ErrnoException).code === "ENOTFOUND" ||
        err.message?.includes("fetch failed") ||
        err.message?.includes("ECONNREFUSED"));

    if (!isConnErr) throw err; // re-throw unexpected errors

    console.warn(
      "[runNow] Inngest dev server unreachable — running pipeline directly.",
    );
    await runPipelineForAllEngines(jobs);
    revalidatePath("/");
    revalidatePath("/prompts");
  }
}
