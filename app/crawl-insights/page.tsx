import DashboardLayout from "../../components/DashboardLayout";
import CrawlInsightsClient from "../../components/CrawlInsightsClient";
import { getActiveProject } from "../../lib/project-context";
import "./crawl-insights.css";

export default async function Page() {
  const project = await getActiveProject();

  return (
    <DashboardLayout currentPath="/crawl-insights">
      <CrawlInsightsClient projectName={project?.name ?? "Your Project"} />
    </DashboardLayout>
  );
}
