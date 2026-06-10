/**
 * Retroactive Brand Extraction
 *
 * Scans all existing chat rawResponses for a project and creates
 * brandMentions entries for newly-tracked brands (text-match based).
 *
 * Called when:
 *   1. A brand suggestion is accepted → extract for that brand only
 *   2. User clicks "Re-process past chats" → extract for ALL tracked brands
 */

import { db } from "../db";
import { chats, prompts, brands, brandMentions } from "../db/schema";
import { and, eq, inArray } from "drizzle-orm";

export interface BrandToProcess {
  id:          string;
  workspaceId: string;
  name:        string;
  aliases:     string[];
}

/**
 * Scan all chats for a project and create brandMentions for a single brand.
 * Text-match based: no LLM call (fast, but no sentiment score).
 */
export async function retroactiveBrandExtraction({
  projectId,
  brand,
}: {
  projectId: string;
  brand: BrandToProcess;
}): Promise<{ scanned: number; created: number }> {

  // 1. Fetch all chats for this project that have a rawResponse
  const chatRows = await db
    .select({ id: chats.id, rawResponse: chats.rawResponse, workspaceId: chats.workspaceId })
    .from(chats)
    .innerJoin(prompts, eq(chats.promptId, prompts.id))
    .where(eq(prompts.projectId, projectId));

  if (chatRows.length === 0) return { scanned: 0, created: 0 };

  // 2. Chats already having this brand mentioned — avoid duplicates
  const existingRows = await db
    .select({ chatId: brandMentions.chatId })
    .from(brandMentions)
    .where(eq(brandMentions.brandId, brand.id));
  const existingChatIds = new Set(existingRows.map(r => r.chatId));

  // 3. Build search terms (name + aliases, lowercase, deduped)
  const searchTerms = [...new Set(
    [brand.name, ...brand.aliases]
      .map(t => t.trim().toLowerCase())
      .filter(Boolean),
  )];

  // 4. Scan each chat
  type MentionRow = {
    workspaceId: string;
    chatId:      string;
    brandId:     string;
    position:    number;
    confidence:  number;
    mentionText: string;
  };
  const toInsert: MentionRow[] = [];

  for (const chat of chatRows) {
    if (existingChatIds.has(chat.id)) continue;
    if (!chat.rawResponse) continue;

    const text = chat.rawResponse.toLowerCase();
    let bestIdx    = Infinity;
    let matchedTerm = "";

    for (const term of searchTerms) {
      const idx = text.indexOf(term);
      if (idx !== -1 && idx < bestIdx) {
        bestIdx     = idx;
        matchedTerm = term;
      }
    }

    if (!matchedTerm) continue;

    // Estimate position: how many 50-word "chunks" appear before first mention
    const wordsBeforeMatch = chat.rawResponse
      .substring(0, bestIdx)
      .split(/\s+/)
      .filter(Boolean).length;
    const position = Math.max(1, Math.ceil(wordsBeforeMatch / 50) + 1);

    toInsert.push({
      workspaceId: chat.workspaceId,
      chatId:      chat.id,
      brandId:     brand.id,
      position,
      confidence:  0.7,
      mentionText: matchedTerm,
    });
  }

  // 5. Insert in batches of 100
  for (let i = 0; i < toInsert.length; i += 100) {
    await db.insert(brandMentions).values(toInsert.slice(i, i + 100));
  }

  return { scanned: chatRows.length, created: toInsert.length };
}

/**
 * Re-process ALL tracked brands for a project.
 * Used by the "Re-process past chats" button.
 */
export async function retroactiveExtractionAllBrands(
  projectId: string,
): Promise<{ scanned: number; created: number; brandsProcessed: number }> {

  const trackedBrands = await db
    .select({ id: brands.id, workspaceId: brands.workspaceId, name: brands.name, aliases: brands.aliases })
    .from(brands)
    .where(eq(brands.projectId, projectId));

  if (trackedBrands.length === 0) return { scanned: 0, created: 0, brandsProcessed: 0 };

  let totalCreated = 0;
  let totalScanned = 0;

  for (const brand of trackedBrands) {
    const result = await retroactiveBrandExtraction({
      projectId,
      brand: {
        id:          brand.id,
        workspaceId: brand.workspaceId,
        name:        brand.name,
        aliases:     (brand.aliases as string[]) ?? [],
      },
    });
    totalCreated += result.created;
    totalScanned  = Math.max(totalScanned, result.scanned); // same chats for each brand
  }

  return { scanned: totalScanned, created: totalCreated, brandsProcessed: trackedBrands.length };
}
