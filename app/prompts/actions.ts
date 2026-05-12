"use server";

import { db } from "../../db";
import { prompts, topics } from "../../db/schema";
import { revalidatePath } from "next/cache";
import { inngest } from "../../inngest/client";
import { getActiveProjectId, WORKSPACE } from "../../lib/project-context";
import { runPipelineForAllEngines, type PipelineJob } from "../../lib/run-pipeline";

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
