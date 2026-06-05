import DashboardLayout from "../../components/DashboardLayout";
import BrandsClient from "../../components/BrandsClient";
import AddBrandTrigger from "../../components/AddBrandTrigger";
import { BrandsModalProvider } from "../../lib/brands-modal-context";
import { db } from "../../db";
import { brands, brandSuggestions, brandMentions, projects } from "../../db/schema";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import { updateBrandColor } from "../actions/brands";
import "./brands.css";

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

  const suggestions = await db
    .select()
    .from(brandSuggestions)
    .where(eq(brandSuggestions.projectId, activeProjectId))
    .orderBy(drizzleSql`${brandSuggestions.mentions} DESC`);

  return (
    <BrandsModalProvider>
      <DashboardLayout
        currentPath="/brands"
        headerAction={<AddBrandTrigger />}
      >
        <BrandsClient
          initialBrands={projectBrands}
          initialSuggestions={suggestions}
          projectId={activeProjectId}
          workspaceId={project?.workspaceId || "00000000-0000-0000-0000-000000000000"}
          updateBrandColorAction={updateBrandColor}
        />
      </DashboardLayout>
    </BrandsModalProvider>
  );
}
