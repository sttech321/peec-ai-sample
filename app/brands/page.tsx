import DashboardLayout from "../../components/DashboardLayout";
import BrandsClient from "../../components/BrandsClient";
import { db } from "../../db";
import { brands, brandSuggestions, projects } from "../../db/schema";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import "./brands.css";

export default async function BrandsPage() {
  const activeProjectId = await getActiveProjectId();

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, activeProjectId))
    .limit(1);

  const projectBrands = await db
    .select()
    .from(brands)
    .where(eq(brands.projectId, activeProjectId));

  const suggestions = await db
    .select()
    .from(brandSuggestions)
    .where(eq(brandSuggestions.projectId, activeProjectId))
    .orderBy(drizzleSql`${brandSuggestions.mentions} DESC`);

  return (
    <DashboardLayout currentPath="/brands">
      <BrandsClient
        initialBrands={projectBrands}
        initialSuggestions={suggestions}
        projectId={activeProjectId}
        workspaceId={project?.workspaceId || "00000000-0000-0000-0000-000000000000"}
      />
    </DashboardLayout>
  );
}
