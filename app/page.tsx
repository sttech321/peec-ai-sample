import DashboardLayout from "../components/DashboardLayout";
import { db } from "../db";
import { projects } from "../db/schema";
import { eq } from "drizzle-orm";
import { getActiveProjectId } from "../lib/project-context";
import { fetchChatFacts, fetchProjectBrands } from "../lib/chat-facts-server";
import OverviewWrapper from "../components/OverviewWrapper";
import { getPageFilterData } from "../lib/page-filter-data";
import { addBrand, updateBrandFilter, getDomainTypeOverrides, updateDomainTypeOverride } from "./actions/brands";
import "./prompts/[id]/prompt-detail.css";
import "./prompts/prompts-comparison.css";
import "./urls/urls.css";

export default async function Home() {
  const activeProjectId = await getActiveProjectId();

  const projectRecord = await db
    .select()
    .from(projects)
    .where(eq(projects.id, activeProjectId));
  const projectName = projectRecord[0]?.name || "General";

  // Load persisted hidden brand names from DB
  const rawHidden = projectRecord[0]?.hiddenBrandIds;
  const hiddenBrandIds: string[] =
    Array.isArray(rawHidden) && rawHidden.every((x) => typeof x === "string")
      ? (rawHidden as string[])
      : [];

  const [chatFacts, projectBrands, filterData, domainTypeOverrides] = await Promise.all([
    fetchChatFacts({ projectId: activeProjectId }),
    fetchProjectBrands(activeProjectId),
    getPageFilterData(activeProjectId),
    getDomainTypeOverrides(),
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
        initialHiddenBrandIds={hiddenBrandIds}
        updateBrandFilterAction={updateBrandFilter}
        initialDomainTypeOverrides={domainTypeOverrides}
        updateDomainTypeOverrideAction={updateDomainTypeOverride}
      />
    </DashboardLayout>
  );
}
