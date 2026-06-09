"use server";

import { db } from "../../db";
import { prompts, topics, tags, promptTags, promptSuggestions, brandProfiles } from "../../db/schema";
import { revalidatePath } from "next/cache";
import { getActiveProjectId, getWorkspaceId } from "../../lib/project-context";
import { runPipelineForAllEngines, type PipelineJob } from "../../lib/run-pipeline";
import { DEFAULT_ENGINES } from "../../lib/ai-clients";
import { and, eq, inArray, ne, sql } from "drizzle-orm";

export async function addPrompt(formData: FormData) {
  const query = formData.get("query") as string;
  const workspaceId = await getWorkspaceId();

  if (!query || query.trim() === "") return;

  const projectId = await getActiveProjectId();

  // Duplicate check — same query in same project not allowed
  const duplicate = await db
    .select({ id: prompts.id })
    .from(prompts)
    .where(and(eq(prompts.projectId, projectId), eq(prompts.query, query.trim())))
    .limit(1);
  if (duplicate.length > 0) return; // silently skip — already tracked

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
    query: query.trim(),
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
  const workspaceId = await getWorkspaceId();
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
    // Filter out any stems that already exist in this project
    const existingRows = await db
      .select({ query: prompts.query })
      .from(prompts)
      .where(eq(prompts.projectId, projectId));
    const existingSet = new Set(existingRows.map(r => r.query.toLowerCase().trim()));
    const uniqueStems = stems.filter(q => !existingSet.has(q.toLowerCase().trim()));

    if (uniqueStems.length > 0) {
      await db.insert(prompts).values(
        uniqueStems.map((q) => ({
          workspaceId,
          projectId,
          topicId: inserted.id,
          query: q,
          volumeTier: "Medium" as const,
        })),
      );
    }
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
  const workspaceId = await getWorkspaceId();
  const engines = selectedEngines && selectedEngines.length > 0
    ? selectedEngines
    : DEFAULT_ENGINES;

  const runDate = new Date().toISOString();

  const jobs: PipelineJob[] = engines.map((engine) => ({
    workspaceId,
    promptId,
    engine,
    runDate,
    query,
  }));

  // Always run inline so the action resolves only after every engine call has
  // been persisted — the per-row Crawl button uses this await to decide when to
  // stop its spinner. The daily 06:00 UTC cron in inngest/functions.ts still
  // uses Inngest for durable scheduled runs.
  await runPipelineForAllEngines(jobs);
  revalidatePath("/");
  revalidatePath("/prompts");
}

// ─── Prompt-tag actions ─────────────────────────────────────────────────────

/**
 * Assign a tag to a prompt. Looks up the tag by name and creates it (with the
 * supplied color, or "gray" by default) if it doesn't exist. Idempotent — if
 * the prompt is already tagged, returns ok without re-inserting.
 */
export async function assignTagToPromptByName(args: {
  promptId: string;
  name: string;
  color?: string;
}): Promise<{ ok: boolean; tagId?: string; error?: string }> {
  const name = args.name.trim();
  if (!name) return { ok: false, error: "Tag name is required" };
  if (name.length > 100) return { ok: false, error: "Tag name too long" };

  const projectId = await getActiveProjectId();
  const workspaceId = await getWorkspaceId();

  // 1. Find or create the tag.
  let [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.projectId, projectId), eq(tags.name, name)))
    .limit(1);

  let tagId: string;
  if (existing) {
    tagId = existing.id;
  } else {
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const [created] = await db
      .insert(tags)
      .values({
        workspaceId,
        projectId,
        name,
        slug,
        color: args.color ?? "gray",
      })
      .returning({ id: tags.id });
    tagId = created.id;
  }

  // 2. Link to prompt if not already linked.
  const [linked] = await db
    .select({ id: promptTags.id })
    .from(promptTags)
    .where(and(eq(promptTags.promptId, args.promptId), eq(promptTags.tagId, tagId)))
    .limit(1);

  if (!linked) {
    await db.insert(promptTags).values({
      workspaceId,
      promptId: args.promptId,
      tagId,
    });
  }

  revalidatePath("/prompts");
  revalidatePath("/tags");
  return { ok: true, tagId };
}

/** Remove a single tag from a prompt. */
export async function removeTagFromPrompt(args: {
  promptId: string;
  tagId: string;
}): Promise<{ ok: boolean; error?: string }> {
  await db
    .delete(promptTags)
    .where(
      and(
        eq(promptTags.promptId, args.promptId),
        eq(promptTags.tagId, args.tagId),
      ),
    );
  revalidatePath("/prompts");
  return { ok: true };
}

/**
 * Update prompt settings (Active toggle, Location, Tags) from the prompt detail
 * settings modal. The `isActive` flag is read by the daily 6:00 AM UTC cron in
 * `inngest/functions.ts` — when false, the cron skips this prompt.
 */
export async function updatePromptSettings(args: {
  promptId: string;
  isActive: boolean;
  location: string;
  tagIds: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const workspaceId = await getWorkspaceId();
  const location = (args.location || "US").toUpperCase().slice(0, 2);

  await db
    .update(prompts)
    .set({ isActive: args.isActive, location })
    .where(eq(prompts.id, args.promptId));

  const existingLinks = await db
    .select({ tagId: promptTags.tagId, id: promptTags.id })
    .from(promptTags)
    .where(eq(promptTags.promptId, args.promptId));

  const existingTagIds = new Set(existingLinks.map((l) => l.tagId));
  const wantedTagIds = new Set(args.tagIds);

  const toAdd = [...wantedTagIds].filter((id) => !existingTagIds.has(id));
  const toRemove = existingLinks.filter((l) => !wantedTagIds.has(l.tagId));

  if (toAdd.length > 0) {
    await db.insert(promptTags).values(
      toAdd.map((tagId) => ({
        workspaceId,
        promptId: args.promptId,
        tagId,
      })),
    );
  }

  for (const link of toRemove) {
    await db.delete(promptTags).where(eq(promptTags.id, link.id));
  }

  revalidatePath("/prompts");
  revalidatePath(`/prompts/${args.promptId}`);
  return { ok: true };
}

// ─── Bulk-add prompts (textarea, one per line) ──────────────────────────────

/**
 * Add many prompts at once from a pre-parsed list of prompt strings.
 * Used by the "Manual" tab of the Add Prompt modal — the user can paste a
 * newline-separated list. Per Peec docs, each prompt is limited to 200 chars.
 */
export async function addPromptsBulk(args: {
  texts: string[];
  topicId: string | null;
  location: string;
  tagIds: string[];
}): Promise<{ ok: boolean; inserted: number; skipped?: number; error?: string; newPrompts?: { id: string; query: string }[] }> {
  const workspaceId = await getWorkspaceId();
  const projectId = await getActiveProjectId();

  const cleaned = args.texts
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 200);
  if (cleaned.length === 0) return { ok: false, inserted: 0, error: "No valid prompts" };

  // Pre-load existing queries for this project (single DB call)
  const existingRows = await db
    .select({ query: prompts.query })
    .from(prompts)
    .where(eq(prompts.projectId, projectId));
  const existingSet = new Set(existingRows.map(r => r.query.toLowerCase().trim()));

  const skipped = cleaned.filter(q => existingSet.has(q.toLowerCase()));
  const unique  = cleaned.filter(q => !existingSet.has(q.toLowerCase()));

  if (unique.length === 0) {
    return { ok: false, inserted: 0, error: `All ${skipped.length} prompt(s) already exist in this project` };
  }

  let topicId = args.topicId;
  if (!topicId) {
    let general = await db.query.topics.findFirst({
      where: (t, { eq, and }) =>
        and(eq(t.projectId, projectId), eq(t.name, "General Topic")),
    });
    if (!general) {
      const [ins] = await db
        .insert(topics)
        .values({ workspaceId, projectId, name: "General Topic" })
        .returning();
      general = ins;
    }
    topicId = general.id;
  }

  const location = (args.location || "US").toUpperCase().slice(0, 2);
  const inserted = await db
    .insert(prompts)
    .values(
      unique.map((q) => ({
        workspaceId,
        projectId,
        topicId: topicId!,
        query: q,
        volumeTier: "Medium" as const,
        location,
      })),
    )
    .returning({ id: prompts.id });

  if (args.tagIds.length > 0 && inserted.length > 0) {
    const tagRows: { workspaceId: string; promptId: string; tagId: string }[] = [];
    for (const p of inserted) {
      for (const tagId of args.tagIds) {
        tagRows.push({ workspaceId, promptId: p.id, tagId });
      }
    }
    await db.insert(promptTags).values(tagRows);
  }

  revalidatePath("/prompts");
  revalidatePath("/");
  return {
    ok: true,
    inserted: inserted.length,
    skipped: skipped.length,
    newPrompts: inserted.map((p, i) => ({ id: p.id, query: unique[i] })),
  };
}

// ─── CSV bulk upload ────────────────────────────────────────────────────────

/**
 * Parse a CSV body (already read on the client) and insert each row as a
 * prompt. Per Peec docs:
 *   Row 1: header (ignored)
 *   Col 1: prompt text
 *   Col 2: ISO 3166-1 alpha-2 country code (e.g. US, DE)
 *   Col 3: topic name (auto-created if missing in this project)
 *   Col 4+: each remaining cell is a tag name
 * Supports comma or semicolon separators; quoted cells respected.
 */
export async function addPromptsFromCsv(args: {
  csvText: string;
}): Promise<{ ok: boolean; inserted: number; error?: string; newPrompts?: { id: string; query: string }[] }> {
  const workspaceId = await getWorkspaceId();
  const projectId = await getActiveProjectId();

  const rows = parseCsv(args.csvText);
  if (rows.length <= 1) return { ok: false, inserted: 0, error: "CSV has no data rows" };

  // ── Detect column mapping from header row ────────────────────────────────
  const headerRow = rows[0].map((h) => h.toLowerCase().trim());
  const col = (names: string[]) => {
    for (const n of names) {
      const i = headerRow.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const promptCol   = col(["prompts", "prompt", "query"]); // "Prompts" is Peec AI format
  const locationCol = col(["location"]);
  const topicCol    = col(["topic_name", "topic"]);
  const tagsCol     = col(["tags"]);
  // Peec AI format: Tag 1, Tag 2, Persona... are extra tag columns (col index 3+)
  // We collect them all when useHeaders is true
  // If header has a 'prompt' column, use named mapping; otherwise use positional
  const useHeaders  = promptCol >= 0;

  const dataRows = rows.slice(1).filter((r) => r.length > 0 && r[promptCol >= 0 ? promptCol : 0]?.trim());

  // Pre-load existing prompts for deduplication (single query)
  const existingPromptRows = await db
    .select({ query: prompts.query })
    .from(prompts)
    .where(eq(prompts.projectId, projectId));
  const existingPromptSet = new Set(existingPromptRows.map(r => r.query.toLowerCase().trim()));

  // Pre-build topic + tag caches so each row doesn't hit the DB on its own.
  const existingTopics = await db
    .select({ id: topics.id, name: topics.name })
    .from(topics)
    .where(eq(topics.projectId, projectId));
  const topicByName = new Map(existingTopics.map((t) => [t.name.toLowerCase(), t.id]));

  const existingTags = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.projectId, projectId));
  const tagByName = new Map(existingTags.map((t) => [t.name.toLowerCase(), t.id]));

  async function ensureTopic(name: string): Promise<string> {
    const key = name.toLowerCase();
    const existing = topicByName.get(key);
    if (existing) return existing;
    const [created] = await db
      .insert(topics)
      .values({ workspaceId, projectId, name })
      .returning({ id: topics.id });
    topicByName.set(key, created.id);
    return created.id;
  }
  async function ensureTag(name: string): Promise<string> {
    const key = name.toLowerCase();
    const existing = tagByName.get(key);
    if (existing) return existing;
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const [created] = await db
      .insert(tags)
      .values({ workspaceId, projectId, name, slug, color: "gray" })
      .returning({ id: tags.id });
    tagByName.set(key, created.id);
    return created.id;
  }

  function isValidTag(t: string): boolean {
    if (t.length === 0 || t.length > 50) return false;
    if (/^pr_[a-f0-9-]{8,}$/i.test(t)) return false;       // prompt IDs
    if (/[?!]/.test(t)) return false;                        // questions
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return false;         // dates/timestamps
    if (/^-?\d+(\.\d+)?$/.test(t)) return false;             // pure numbers
    if ((t.match(/\s+/g) ?? []).length > 4) return false;    // >4 words
    return true;
  }

  // Default topic for rows with no topic specified.
  let defaultTopicId: string | null = null;

  let inserted = 0;
  const newPromptsList: { id: string; query: string }[] = [];
  for (const row of dataRows) {
    let promptText: string;
    let location: string;
    let topicName: string;
    let tagNames: string[];

    if (useHeaders) {
      // ── Named column mapping — supports both Peec AI format and export format ─
      promptText = (row[promptCol] ?? "").trim();
      location = ((locationCol >= 0 ? row[locationCol] : "") || "US").trim().toUpperCase().slice(0, 2) || "US";
      topicName = (topicCol >= 0 ? row[topicCol] : "").trim();

      if (tagsCol >= 0) {
        // Export format: single "tags" column with comma-separated values
        const rawTags = row[tagsCol] ?? "";
        tagNames = rawTags.split(",").map((t) => t.trim()).filter(isValidTag);
      } else {
        // Peec AI template format: "Tag 1", "Tag 2", "Persona" etc as separate columns
        // Collect all columns after topic (everything that is not prompt/location/topic)
        const knownCols = new Set([promptCol, locationCol >= 0 ? locationCol : -1, topicCol >= 0 ? topicCol : -1]);
        tagNames = row
          .filter((_, idx) => !knownCols.has(idx))
          .map((t) => t.trim())
          .filter(isValidTag);
      }
    } else {
      // ── Positional mapping (simple format: prompt, location, topic, tag…) ─
      promptText = (row[0] ?? "").trim();
      location = ((row[1] ?? "US").trim() || "US").toUpperCase().slice(0, 2);
      topicName = (row[2] ?? "").trim();
      tagNames = row.slice(3).map((t) => t.trim()).filter(isValidTag);
    }

    if (!promptText || promptText.length > 200) continue;
    if (existingPromptSet.has(promptText.toLowerCase())) continue; // skip duplicate

    let topicId: string;
    if (topicName) topicId = await ensureTopic(topicName);
    else {
      if (!defaultTopicId) defaultTopicId = await ensureTopic("General Topic");
      topicId = defaultTopicId;
    }

    existingPromptSet.add(promptText.toLowerCase()); // prevent intra-batch duplicates

    const [createdPrompt] = await db
      .insert(prompts)
      .values({
        workspaceId,
        projectId,
        topicId,
        query: promptText,
        volumeTier: "Medium",
        location,
      })
      .returning({ id: prompts.id });

    if (tagNames.length > 0) {
      const tagIds = await Promise.all(tagNames.map(ensureTag));
      await db.insert(promptTags).values(
        tagIds.map((tagId) => ({
          workspaceId,
          promptId: createdPrompt.id,
          tagId,
        })),
      );
    }
    newPromptsList.push({ id: createdPrompt.id, query: promptText });
    inserted++;
  }

  revalidatePath("/prompts");
  revalidatePath("/");
  return { ok: true, inserted, newPrompts: newPromptsList };
}

// ─── Import from pre-parsed rows (JSON / XLSX / CSV all use this) ────────────
export async function addPromptsFromParsed(args: {
  items: { prompt: string; location: string; topic: string; tags: string[] }[];
}): Promise<{ ok: boolean; inserted: number; error?: string; newPrompts?: { id: string; query: string }[] }> {
  const workspaceId = await getWorkspaceId();
  const projectId = await getActiveProjectId();

  const validItems = args.items.filter(
    (i) => i.prompt.trim().length > 0 && i.prompt.trim().length <= 200,
  );
  if (validItems.length === 0) return { ok: false, inserted: 0, error: "No valid prompts found" };

  // Pre-load existing prompts for deduplication
  const existingPromptRows = await db
    .select({ query: prompts.query })
    .from(prompts)
    .where(eq(prompts.projectId, projectId));
  const existingPromptSet = new Set(existingPromptRows.map(r => r.query.toLowerCase().trim()));

  const existingTopics = await db
    .select({ id: topics.id, name: topics.name })
    .from(topics)
    .where(eq(topics.projectId, projectId));
  const topicByName = new Map(existingTopics.map((t) => [t.name.toLowerCase(), t.id]));

  const existingTags = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.projectId, projectId));
  const tagByName = new Map(existingTags.map((t) => [t.name.toLowerCase(), t.id]));

  async function ensureTopic(name: string): Promise<string> {
    const key = (name || "General Topic").toLowerCase();
    const ex = topicByName.get(key);
    if (ex) return ex;
    const [c] = await db.insert(topics).values({ workspaceId, projectId, name: name || "General Topic" }).returning({ id: topics.id });
    topicByName.set(key, c.id);
    return c.id;
  }

  async function ensureTag(name: string): Promise<string> {
    const key = name.toLowerCase();
    const ex = tagByName.get(key);
    if (ex) return ex;
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const [c] = await db.insert(tags).values({ workspaceId, projectId, name, slug, color: "gray" }).returning({ id: tags.id });
    tagByName.set(key, c.id);
    return c.id;
  }

  let inserted = 0;
  const newPromptsList: { id: string; query: string }[] = [];
  for (const item of validItems) {
    const queryText = item.prompt.trim();
    if (existingPromptSet.has(queryText.toLowerCase())) continue; // skip duplicate

    const topicId = await ensureTopic(item.topic);
    const location = (item.location || "US").toUpperCase().slice(0, 2);

    existingPromptSet.add(queryText.toLowerCase()); // prevent intra-batch duplicates

    const [created] = await db
      .insert(prompts)
      .values({ workspaceId, projectId, topicId, query: queryText, volumeTier: "Medium", location })
      .returning({ id: prompts.id });

    const validTags = item.tags.filter(
      (t) => t.trim().length > 0 && t.length <= 50 && !/[?!]/.test(t),
    );
    if (validTags.length > 0) {
      const tagIds = await Promise.all(validTags.map(ensureTag));
      await db.insert(promptTags).values(tagIds.map((tagId) => ({ workspaceId, promptId: created.id, tagId })));
    }
    newPromptsList.push({ id: created.id, query: queryText });
    inserted++;
  }

  revalidatePath("/prompts");
  revalidatePath("/");
  return { ok: true, inserted, newPrompts: newPromptsList };
}

// Minimal CSV parser: comma OR semicolon delimited, double-quoted cells
// supported (with "" as an escaped quote). No external dependency.
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  // Detect separator on the first non-quoted line — favour comma unless the
  // first line has more semicolons than commas.
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.length > 0 && row.some((c) => c.trim().length > 0)) out.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((c) => c.trim().length > 0)) out.push(row);
  }
  return out;
}

// ─── Batch row actions ─────────────────────────────────────────────────────

async function assertOwnedPromptIds(promptIds: string[]): Promise<string[]> {
  if (promptIds.length === 0) return [];
  const projectId = await getActiveProjectId();
  const owned = await db
    .select({ id: prompts.id })
    .from(prompts)
    .where(and(eq(prompts.projectId, projectId), inArray(prompts.id, promptIds)));
  return owned.map((r) => r.id);
}

export async function batchAssignTag(args: {
  promptIds: string[];
  tagName: string;
  color?: string;
}): Promise<{ ok: boolean; assigned: number; error?: string }> {
  const name = args.tagName.trim();
  if (!name) return { ok: false, assigned: 0, error: "Tag name required" };
  const ids = await assertOwnedPromptIds(args.promptIds);
  if (ids.length === 0) return { ok: false, assigned: 0, error: "No prompts" };

  const projectId = await getActiveProjectId();
  const workspaceId = await getWorkspaceId();

  // Find-or-create tag in this project.
  let [tag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.projectId, projectId), eq(tags.name, name)))
    .limit(1);
  if (!tag) {
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const [created] = await db
      .insert(tags)
      .values({ workspaceId, projectId, name, slug, color: args.color ?? "gray" })
      .returning({ id: tags.id });
    tag = created;
  }

  // Skip prompts already tagged.
  const existingLinks = await db
    .select({ promptId: promptTags.promptId })
    .from(promptTags)
    .where(and(eq(promptTags.tagId, tag.id), inArray(promptTags.promptId, ids)));
  const alreadyTagged = new Set(existingLinks.map((l) => l.promptId));
  const toInsert = ids.filter((id) => !alreadyTagged.has(id));

  if (toInsert.length > 0) {
    await db.insert(promptTags).values(
      toInsert.map((promptId) => ({ workspaceId, promptId, tagId: tag.id })),
    );
  }

  revalidatePath("/prompts");
  return { ok: true, assigned: toInsert.length };
}

export async function batchAssignTopic(args: {
  promptIds: string[];
  topicId: string;
}): Promise<{ ok: boolean; updated: number; error?: string }> {
  const ids = await assertOwnedPromptIds(args.promptIds);
  if (ids.length === 0) return { ok: false, updated: 0, error: "No prompts" };

  const projectId = await getActiveProjectId();
  const [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.projectId, projectId), eq(topics.id, args.topicId)))
    .limit(1);
  if (!topic) return { ok: false, updated: 0, error: "Topic not in project" };

  await db
    .update(prompts)
    .set({ topicId: topic.id })
    .where(inArray(prompts.id, ids));

  revalidatePath("/prompts");
  return { ok: true, updated: ids.length };
}

export async function batchSetActive(args: {
  promptIds: string[];
  isActive: boolean;
}): Promise<{ ok: boolean; updated: number }> {
  const ids = await assertOwnedPromptIds(args.promptIds);
  if (ids.length === 0) return { ok: false, updated: 0 };
  await db
    .update(prompts)
    .set({ isActive: args.isActive })
    .where(inArray(prompts.id, ids));
  revalidatePath("/prompts");
  return { ok: true, updated: ids.length };
}

export async function batchDeletePrompts(args: {
  promptIds: string[];
}): Promise<{ ok: boolean; deleted: number }> {
  const ids = await assertOwnedPromptIds(args.promptIds);
  if (ids.length === 0) return { ok: false, deleted: 0 };
  // FK cascades on prompts will drop dependent chats / brand_mentions / etc.
  await db.delete(prompts).where(inArray(prompts.id, ids));
  revalidatePath("/prompts");
  return { ok: true, deleted: ids.length };
}

// ─── Topic edit / delete ───────────────────────────────────────────────────

export async function renameTopic(args: {
  topicId: string;
  name: string;
}): Promise<{ ok: boolean; error?: string }> {
  const name = args.name.trim();
  if (!name) return { ok: false, error: "Topic name is required" };
  if (name.length > 255) return { ok: false, error: "Topic name too long" };

  const projectId = await getActiveProjectId();

  const dup = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.projectId, projectId), eq(topics.name, name), ne(topics.id, args.topicId)))
    .limit(1);
  if (dup.length) return { ok: false, error: "A topic with that name already exists" };

  await db
    .update(topics)
    .set({ name })
    .where(and(eq(topics.id, args.topicId), eq(topics.projectId, projectId)));

  revalidatePath("/prompts");
  return { ok: true };
}

/**
 * Delete a topic. All prompts belonging to it are first moved to a fallback
 * topic (existing "General Topic", any other topic, or a freshly created
 * "General Topic"). This avoids FK cascade silently dropping prompts.
 */
export async function deleteTopic(args: {
  topicId: string;
}): Promise<{ ok: boolean; moved: number; error?: string }> {
  const projectId = await getActiveProjectId();
  const workspaceId = await getWorkspaceId();

  // Find a fallback topic — prefer "General Topic" but not the one being deleted
  let [fallback] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(
      eq(topics.projectId, projectId),
      eq(topics.name, "General Topic"),
      ne(topics.id, args.topicId),
    ))
    .limit(1);

  if (!fallback) {
    // Use any other existing topic
    const [other] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.projectId, projectId), ne(topics.id, args.topicId)))
      .limit(1);
    if (other) {
      fallback = other;
    } else {
      // No other topic exists — create General Topic as fallback
      const [created] = await db
        .insert(topics)
        .values({ workspaceId, projectId, name: "General Topic" })
        .returning({ id: topics.id });
      fallback = created;
    }
  }

  // Move prompts before deleting topic (avoids cascade delete of prompts)
  const moved = await db
    .update(prompts)
    .set({ topicId: fallback.id })
    .where(and(eq(prompts.projectId, projectId), eq(prompts.topicId, args.topicId)))
    .returning({ id: prompts.id });

  await db
    .delete(topics)
    .where(and(eq(topics.id, args.topicId), eq(topics.projectId, projectId)));

  revalidatePath("/prompts");
  return { ok: true, moved: moved.length };
}
