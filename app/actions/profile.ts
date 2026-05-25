"use server";

import { db } from "../../db";
import { brandProfiles, projects } from "../../db/schema";
import { eq } from "drizzle-orm";
import { getActiveProjectId, getWorkspaceId } from "../../lib/project-context";
import { revalidatePath } from "next/cache";
import {
  BrandProfile,
  EMPTY_BRAND_PROFILE,
  mergeBrandProfile,
} from "../../lib/brand-profile-types";

export async function loadBrandProfile(): Promise<{ profile: BrandProfile; projectName: string }> {
  const projectId = await getActiveProjectId();
  const [project] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  // Resilient load — if the brand_profiles table is missing (migration not yet
  // run, stale connection, etc.) fall back to an empty profile so the page
  // still renders and the user can recover by saving once the table exists.
  let row: { data: unknown } | undefined;
  try {
    [row] = await db
      .select({ data: brandProfiles.data })
      .from(brandProfiles)
      .where(eq(brandProfiles.projectId, projectId))
      .limit(1);
  } catch (err) {
    console.warn("[loadBrandProfile] table read failed, returning empty profile:", err);
  }

  const profile = row
    ? mergeBrandProfile(row.data as Partial<BrandProfile>)
    : { ...EMPTY_BRAND_PROFILE, companyName: project?.name ?? "" };

  return { profile, projectName: project?.name ?? "" };
}

export async function saveBrandProfile(
  profile: BrandProfile,
): Promise<{ ok: boolean; error?: string }> {
  if (!profile.companyName?.trim()) {
    return { ok: false, error: "Company name is required" };
  }
  if ((profile.description ?? "").length > 500) {
    return { ok: false, error: "Description must be 500 characters or fewer" };
  }
  const totalWeight = profile.audienceDistribution
    .filter((a) => a.enabled)
    .reduce((s, a) => s + a.weight, 0);
  if (profile.audienceDistribution.some((a) => a.enabled) && Math.abs(totalWeight - 100) > 0.5) {
    return { ok: false, error: "Audience weights must total 100%" };
  }

  const projectId = await getActiveProjectId();

  const [existing] = await db
    .select({ id: brandProfiles.id })
    .from(brandProfiles)
    .where(eq(brandProfiles.projectId, projectId))
    .limit(1);

  if (existing) {
    await db
      .update(brandProfiles)
      .set({ data: profile, updatedAt: new Date() })
      .where(eq(brandProfiles.id, existing.id));
  } else {
    const workspaceId = await getWorkspaceId();
    await db.insert(brandProfiles).values({
      workspaceId,
      projectId,
      data: profile,
    });
  }

  revalidatePath("/profile");
  return { ok: true };
}

// Stub: in production this would call an LLM with the brand context.
// Returns a deterministic placeholder so the UI flow can be tested.
export async function generateDescription(
  context: Pick<BrandProfile, "companyName" | "industry" | "identityTraits">,
): Promise<{ ok: boolean; description?: string; error?: string }> {
  const name = context.companyName?.trim() || "Your company";
  const industry = context.industry || "your industry";
  const traits = context.identityTraits.length
    ? context.identityTraits.slice(0, 3).join(", ").toLowerCase()
    : "results-driven";
  const draft = `${name} is a ${traits} ${industry.toLowerCase()} company helping customers achieve measurable outcomes through a focused, modern product offering.`;
  return { ok: true, description: draft };
}
