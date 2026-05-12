"use server";

import { db } from "../../db";
import { prompts, topics } from "../../db/schema";
import { revalidatePath } from "next/cache";
import { inngest } from "../../inngest/client";
import { getActiveProjectId, WORKSPACE } from "../../lib/project-context";

export async function addPrompt(formData: FormData) {
  const query = formData.get("query") as string;
  const workspaceId = WORKSPACE; 
  
  if (!query || query.trim() === "") return;

  // Get the currently active project
  const projectId = await getActiveProjectId();

  // Ensure a default topic exists for this project
  let topic = await db.query.topics.findFirst({
    where: (t, { eq }) => eq(t.projectId, projectId)
  });
  if (!topic) {
    const insertedTopic = await db.insert(topics).values({
      workspaceId,
      projectId,
      name: "General Topic"
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
  const engines = selectedEngines && selectedEngines.length > 0 ? selectedEngines : ["ChatGPT", "Claude", "Perplexity", "Gemini", "Groq"];
  const events = [];
  const runDate = new Date().toISOString(); // Full timestamp for manual runs to bypass daily idempotency

  for (const engine of engines) {
    events.push({
      name: "prompt.run",
      data: {
        workspaceId,
        promptId,
        engine,
        runDate,
        query
      }
    });
  }

  await inngest.send(events);
}
