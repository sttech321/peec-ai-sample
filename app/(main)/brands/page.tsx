import BrandsClient from "../../../components/BrandsClient";
import AddBrandTrigger from "../../../components/AddBrandTrigger";
import { BrandsModalProvider } from "../../../lib/brands-modal-context";
import { db } from "../../../db";
import { brands, brandSuggestions, brandMentions, projects } from "../../../db/schema";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { getActiveProjectId } from "../../../lib/project-context";
import { updateBrandColor } from "../../actions/brands";
import { renameBrand, updateBrandAliases, updateBrandDomains, reprocessAllBrands } from "../../brands/actions";
import "../../brands/brands.css";

export default async function BrandsPage() {
  const activeProjectId = await getActiveProjectId();

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, activeProjectId))
    .limit(1);

  const projectBrands = await db
    .select({
      id: brands.id,
      workspaceId: brands.workspaceId,
      projectId: brands.projectId,
      name: brands.name,
      isOwn: brands.isOwn,
      color: brands.color,
      aliases: brands.aliases,
      domains: brands.domains,
      mentions: drizzleSql<number>`cast(count(${brandMentions.id}) as int)`,
    })
    .from(brands)
    .leftJoin(brandMentions, eq(brandMentions.brandId, brands.id))
    .where(eq(brands.projectId, activeProjectId))
    .groupBy(
      brands.id,
      brands.workspaceId,
      brands.projectId,
      brands.name,
      brands.isOwn,
      brands.color,
      brands.aliases,
      brands.domains,
    )
    .orderBy(drizzleSql`count(${brandMentions.id}) desc`);

  const rawSuggestions = await db
    .select()
    .from(brandSuggestions)
    .where(eq(brandSuggestions.projectId, activeProjectId))
    .orderBy(drizzleSql`${brandSuggestions.mentions} DESC`);

  // Build sets of tracked names and normalized domains from existing brands
  const trackedNameSet = new Set(projectBrands.map((b) => b.name.toLowerCase().trim()));
  const trackedDomainSet = new Set<string>();
  for (const b of projectBrands) {
    for (const d of b.domains) {
      const norm = d.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
      if (norm) trackedDomainSet.add(norm);
    }
  }

  // Remove suggestions whose name or domain already matches a tracked brand
  const suggestions = rawSuggestions.filter((s) => {
    if (trackedNameSet.has(s.name.toLowerCase().trim())) return false;
    if (s.domain) {
      const norm = s.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
      if (norm && trackedDomainSet.has(norm)) return false;
    }
    return true;
  });

  return (
    <BrandsModalProvider>
      <BrandsClient
        initialBrands={projectBrands}
        initialSuggestions={suggestions}
        projectId={activeProjectId}
        workspaceId={project?.workspaceId || "00000000-0000-0000-0000-000000000000"}
        updateBrandColorAction={updateBrandColor}
        renameBrandAction={renameBrand}
        updateBrandAliasesAction={updateBrandAliases}
        updateBrandDomainsAction={updateBrandDomains}
        reprocessAllBrandsAction={reprocessAllBrands}
      />
    </BrandsModalProvider>
  );
}
