import DashboardLayout from "../components/DashboardLayout";
import { db } from "../db";
import { projects } from "../db/schema";
import { eq } from "drizzle-orm";
import { getActiveProjectId } from "../lib/project-context";
import { fetchChatFacts, fetchProjectBrands } from "../lib/chat-facts-server";
import OverviewWrapper from "../components/OverviewWrapper";
import { getPageFilterData } from "../lib/page-filter-data";
import { addBrand } from "./actions/brands";
import "./prompts/[id]/prompt-detail.css";
import "./prompts/prompts-comparison.css";

export default async function Home() {
  const activeProjectId = await getActiveProjectId();

  const projectRecord = await db
    .select()
    .from(projects)
    .where(eq(projects.id, activeProjectId));
  const projectName = projectRecord[0]?.name || "General";

  const [chatFacts, projectBrands, filterData] = await Promise.all([
    fetchChatFacts({ projectId: activeProjectId }),
    fetchProjectBrands(activeProjectId),
    getPageFilterData(activeProjectId),
  ]);

  return (
    <DashboardLayout currentPath="/">
      <OverviewWrapper
        projectName={projectName}
        chatFacts={chatFacts}
        projectBrands={projectBrands}
        filterBrands={filterData.projectBrands}
        availableTags={filterData.availableTags}
        addBrandAction={addBrand}
      />
    </DashboardLayout>
  );
}
