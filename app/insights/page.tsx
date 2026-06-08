import DashboardLayout from "../../components/DashboardLayout";
import InsightsClient from "../../components/InsightsClient";
import PageFilterBar from "../../components/PageFilterBar";
import { db } from "../../db";
import { projects, brands, brandProfiles } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import { fetchChatFacts, fetchProjectBrands } from "../../lib/chat-facts-server";
import { getPageFilterData } from "../../lib/page-filter-data";
import { addBrand } from "../actions/brands";
import type { BrandProfile } from "../../lib/brand-profile-types";
import "../prompts/[id]/prompt-detail.css";
import "../prompts/prompts-comparison.css";
import "./insights.css";

export default async function InsightsPage() {
  const activeProjectId = await getActiveProjectId();

  // All independent queries run in parallel
  const [[projectRecord], [ownBrand], profileResult, chatFacts, projectBrands, filterData] =
    await Promise.all([
      db.select({ name: projects.name }).from(projects)
        .where(eq(projects.id, activeProjectId)).limit(1),

      db.select({ name: brands.name, domains: brands.domains }).from(brands)
        .where(and(eq(brands.projectId, activeProjectId), eq(brands.isOwn, true))).limit(1),

      db.select({ data: brandProfiles.data }).from(brandProfiles)
        .where(eq(brandProfiles.projectId, activeProjectId)).limit(1)
        .catch(() => [] as { data: unknown }[]),

      fetchChatFacts({ projectId: activeProjectId }),
      fetchProjectBrands(activeProjectId),
      getPageFilterData(activeProjectId),
    ]);

  const projectName = projectRecord?.name || "General";
  let profileDomain: string | null = null;
  try {
    const data = (profileResult as any[])[0]?.data as Partial<BrandProfile> | undefined;
    if (data?.domain) profileDomain = String(data.domain).trim();
  } catch { /* brand profile optional */ }

  const ownDomain =
    profileDomain ||
    (ownBrand?.domains && ownBrand.domains.length > 0 ? ownBrand.domains[0] : null);

  return (
    <DashboardLayout currentPath="/insights">
      <PageFilterBar
        projectName={projectName}
        projectBrands={filterData.projectBrands}
        availableTags={filterData.availableTags}
        addBrandAction={addBrand}
      />
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
