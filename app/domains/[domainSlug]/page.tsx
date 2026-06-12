import DashboardLayout from "../../../components/DashboardLayout";
import DomainDetailClient from "../../../components/DomainDetailClient";
import { db } from "../../../db";
import { projects, brands, brandProfiles } from "../../../db/schema";
import { eq, and } from "drizzle-orm";
import { getActiveProjectId } from "../../../lib/project-context";
import { fetchChatFacts, fetchProjectBrands } from "../../../lib/chat-facts-server";
import { getDomainTypeOverrides, getDomainBookmarks, updateDomainTypeOverride, updateDomainBookmark } from "../../actions/brands";
import type { BrandProfile } from "../../../lib/brand-profile-types";
import "../../prompts/[id]/prompt-detail.css";
import "../../insights/insights.css";
import "../../urls/urls.css";
import "../domains.css";
import "./domain-detail.css";

export default async function DomainDetailPage({
  params,
}: {
  params: Promise<{ domainSlug: string }>;
}) {
  const { domainSlug } = await params;
  const domain = decodeURIComponent(domainSlug);
  const activeProjectId = await getActiveProjectId();

  const [projectRecord] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, activeProjectId))
    .limit(1);
  const projectName = projectRecord?.name || "General";

  const [ownBrandRow] = await db
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
  } catch {}

  const ownDomains: string[] = [];
  if (profileDomain) ownDomains.push(profileDomain);
  for (const d of ownBrandRow?.domains ?? []) ownDomains.push(d.toLowerCase());

  const [allChatFacts, projectBrands, domainTypeOverrides, domainBookmarks] = await Promise.all([
    fetchChatFacts({ projectId: activeProjectId }),
    fetchProjectBrands(activeProjectId),
    getDomainTypeOverrides(),
    getDomainBookmarks(),
  ]);

  // Pre-filter to chats that reference this domain
  const chatFacts = allChatFacts.filter((c) =>
    c.sources.some((s) => s.domain.toLowerCase() === domain.toLowerCase())
  );

  const ownBrandName = ownBrandRow?.name ?? projectBrands.find((b) => b.isOwn)?.name ?? null;

  return (
    <DashboardLayout currentPath="/domains">
      <DomainDetailClient
        domain={domain}
        projectName={projectName}
        chatFacts={chatFacts}
        allChatFacts={allChatFacts}
        projectBrands={projectBrands}
        ownBrand={ownBrandName}
        ownDomains={ownDomains}
        competitorDomains={competitorDomains}
        initialDomainTypeOverrides={domainTypeOverrides}
        updateDomainTypeOverrideAction={updateDomainTypeOverride}
        initialDomainBookmarks={domainBookmarks}
        updateDomainBookmarkAction={updateDomainBookmark}
      />
    </DashboardLayout>
  );
}
