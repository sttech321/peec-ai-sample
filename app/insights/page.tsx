import DashboardLayout from "../../components/DashboardLayout";
import InsightsClient from "../../components/InsightsClient";
import { db } from "../../db";
import { projects, brands, brandProfiles } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import { fetchChatFacts, fetchProjectBrands } from "../../lib/chat-facts-server";
import type { BrandProfile } from "../../lib/brand-profile-types";
import "../prompts/[id]/prompt-detail.css";
import "./insights.css";

export default async function InsightsPage() {
  const activeProjectId = await getActiveProjectId();

  const [projectRecord] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, activeProjectId))
    .limit(1);
  const projectName = projectRecord?.name || "General";

  // Find the explicit "own" brand, if one is flagged.
  const [ownBrand] = await db
    .select({ name: brands.name, domains: brands.domains })
    .from(brands)
    .where(and(eq(brands.projectId, activeProjectId), eq(brands.isOwn, true)))
    .limit(1);

  // Try to read the brand profile for the real domain. Resilient to missing table.
  let profileDomain: string | null = null;
  try {
    const [profileRow] = await db
      .select({ data: brandProfiles.data })
      .from(brandProfiles)
      .where(eq(brandProfiles.projectId, activeProjectId))
      .limit(1);
    const data = profileRow?.data as Partial<BrandProfile> | undefined;
    if (data?.domain) profileDomain = String(data.domain).trim();
  } catch (err) {
    console.warn("[InsightsPage] brand profile read failed:", err);
  }

  const ownDomain =
    profileDomain ||
    (ownBrand?.domains && ownBrand.domains.length > 0 ? ownBrand.domains[0] : null);

  const [chatFacts, projectBrands] = await Promise.all([
    fetchChatFacts({ projectId: activeProjectId }),
    fetchProjectBrands(activeProjectId),
  ]);

  return (
    <DashboardLayout currentPath="/insights">
      <InsightsClient
        chatFacts={chatFacts}
        projectName={projectName}
        projectBrands={projectBrands}
        ownBrandName={ownBrand?.name ?? null}
        ownDomain={ownDomain}
      />
    </DashboardLayout>
  );
}
