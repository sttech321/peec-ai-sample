import DashboardLayout from "../../components/DashboardLayout";
import DomainsWrapper from "../../components/DomainsWrapper";
import { db } from "../../db";
import { projects, brands, brandProfiles } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import { fetchChatFacts, fetchProjectBrands } from "../../lib/chat-facts-server";
import { getPageFilterData } from "../../lib/page-filter-data";
import { addBrand, getDomainTypeOverrides, updateDomainTypeOverride } from "../actions/brands";
import type { BrandProfile } from "../../lib/brand-profile-types";
import "../prompts/[id]/prompt-detail.css";
import "../prompts/prompts-comparison.css";
import "../insights/insights.css";
import "../urls/urls.css";
import "./domains.css";

export default async function DomainsPage() {
  const activeProjectId = await getActiveProjectId();

  const [projectRecord] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, activeProjectId))
    .limit(1);
  const projectName = projectRecord?.name || "General";

  const [ownBrand] = await db
    .select({ name: brands.name, domains: brands.domains })
    .from(brands)
    .where(and(eq(brands.projectId, activeProjectId), eq(brands.isOwn, true)))
    .limit(1);

  const competitorRows = await db
    .select({ name: brands.name, domains: brands.domains, isOwn: brands.isOwn })
    .from(brands)
    .where(eq(brands.projectId, activeProjectId));
  const competitorDomains: string[] = [];
  for (const r of competitorRows) {
    if (r.isOwn) continue;
    for (const d of r.domains ?? []) competitorDomains.push(d.toLowerCase());
  }

  let profileDomain: string | null = null;
  try {
    const [profileRow] = await db
      .select({ data: brandProfiles.data })
      .from(brandProfiles)
      .where(eq(brandProfiles.projectId, activeProjectId))
      .limit(1);
    const data = profileRow?.data as Partial<BrandProfile> | undefined;
    if (data?.domain) profileDomain = String(data.domain).trim().toLowerCase();
  } catch (err) {
    console.warn("[DomainsPage] brand profile read failed:", err);
  }

  const ownDomains: string[] = [];
  if (profileDomain) ownDomains.push(profileDomain);
  for (const d of ownBrand?.domains ?? []) ownDomains.push(d.toLowerCase());

  const [chatFacts, projectBrands, filterData, domainTypeOverrides] = await Promise.all([
    fetchChatFacts({ projectId: activeProjectId }),
    fetchProjectBrands(activeProjectId),
    getPageFilterData(activeProjectId),
    getDomainTypeOverrides(),
  ]);

  // Derive available engines from actual data (dynamic, not hardcoded)
  const availableEngines = [...new Set(chatFacts.map((c) => c.engine))].sort();

  return (
    <DashboardLayout currentPath="/domains">
      <DomainsWrapper
        projectName={projectName}
        chatFacts={chatFacts}
        projectBrands={projectBrands}
        filterBrands={filterData.projectBrands}
        availableTags={filterData.availableTags}
        ownDomains={ownDomains}
        competitorDomains={competitorDomains}
        addBrandAction={addBrand}
        availableEngines={availableEngines}
        initialDomainTypeOverrides={domainTypeOverrides}
        updateDomainTypeOverrideAction={updateDomainTypeOverride}
      />
    </DashboardLayout>
  );
}
