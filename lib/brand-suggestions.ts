/**
 * Brand Suggestions Generator
 * ──────────────────────────
 * chatFacts se untracked brands dhundh kar brandSuggestions table mein save karta hai.
 * Already tracked brands ko skip karta hai.
 * Minimum 2+ mentions wale brands ko hi suggest karta hai.
 */

import { db } from "../db";
import { brands, brandSuggestions } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { ChatFact } from "./chat-aggregations";

interface SuggestionCandidate {
  name: string;
  mentions: number;
  domain: string | null;
}

/** Guess domain from brand name (simple heuristic) */
function guessDomainFromName(name: string): string | null {
  if (!name) return null;
  const clean = name
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "");
  if (clean.length < 2) return null;
  return `${clean}.com`;
}

/**
 * chatFacts se brand mention counts calculate karo.
 * Returns: Map<brandName (lowercase), mentionCount>
 */
function countBrandMentions(chatFacts: ChatFact[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const chat of chatFacts) {
    const seenInChat = new Set<string>();
    for (const b of chat.brands) {
      const key = b.name.trim().toLowerCase();
      if (!key || seenInChat.has(key)) continue;
      seenInChat.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Main function: suggestions generate karo aur DB mein upsert karo.
 * Already accepted/rejected suggestions ko dobara suggest nahi karta.
 */
export async function generateBrandSuggestions(
  projectId: string,
  workspaceId: string,
  chatFacts: ChatFact[],
  minMentions = 2,
): Promise<void> {
  if (chatFacts.length === 0) return;

  // 1. chatFacts se brand mention counts
  const mentionCounts = countBrandMentions(chatFacts);
  if (mentionCounts.size === 0) return;

  // 2. Already tracked brands (is project mein)
  const trackedRows = await db
    .select({ name: brands.name })
    .from(brands)
    .where(eq(brands.projectId, projectId));
  const trackedNames = new Set(trackedRows.map((r) => r.name.toLowerCase().trim()));

  // 3. Already suggested brands (pending, accepted, rejected)
  const existingRows = await db
    .select({ name: brandSuggestions.name, mentions: brandSuggestions.mentions })
    .from(brandSuggestions)
    .where(eq(brandSuggestions.projectId, projectId));
  const existingMap = new Map(
    existingRows.map((r) => [r.name.toLowerCase().trim(), r.mentions])
  );

  // 4. Candidates = untracked brands with >= minMentions
  const candidates: SuggestionCandidate[] = [];
  for (const [nameLower, count] of mentionCounts) {
    if (count < minMentions) continue;
    if (trackedNames.has(nameLower)) continue;

    // Find the original-case name from chatFacts
    const originalName = findOriginalName(chatFacts, nameLower);
    candidates.push({
      name: originalName,
      mentions: count,
      domain: guessDomainFromName(originalName),
    });
  }

  if (candidates.length === 0) return;

  // 5. Batch operations — group into inserts vs updates
  const toInsert = candidates.filter(c => !existingMap.has(c.name.toLowerCase().trim()));
  const toUpdate = candidates.filter(c => {
    const key = c.name.toLowerCase().trim();
    return existingMap.has(key) && existingMap.get(key) !== c.mentions;
  });

  // Batch insert new suggestions in one query
  if (toInsert.length > 0) {
    try {
      await db.insert(brandSuggestions).values(
        toInsert.map(c => ({
          workspaceId,
          projectId,
          name: c.name,
          domain: c.domain,
          mentions: c.mentions,
          status: "pending",
        }))
      ).onConflictDoNothing();
    } catch {
      // Ignore constraint errors
    }
  }

  // Update mention counts in parallel
  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map(c =>
        db.update(brandSuggestions)
          .set({ mentions: c.mentions, updatedAt: new Date() })
          .where(and(
            eq(brandSuggestions.projectId, projectId),
            eq(brandSuggestions.name, c.name),
          ))
      )
    );
  }
}

/** chatFacts se original-case brand name dhundho (lowercase key se) */
function findOriginalName(chatFacts: ChatFact[], nameLower: string): string {
  for (const chat of chatFacts) {
    for (const b of chat.brands) {
      if (b.name.trim().toLowerCase() === nameLower) {
        return b.name.trim();
      }
    }
  }
  return nameLower; // fallback
}
