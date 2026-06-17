import CrawlInsightsClient from "../../../components/CrawlInsightsClient";
import { getActiveProject } from "../../../lib/project-context";
import "../../crawl-insights/crawl-insights.css";

export default async function Page() {
  const project = await getActiveProject();

  return (
    <CrawlInsightsClient projectName={project?.name ?? "Your Project"} />
  );
}
