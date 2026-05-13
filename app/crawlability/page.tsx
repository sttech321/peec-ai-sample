import DashboardLayout from "../../components/DashboardLayout";
import CrawlabilityClient from "../../components/CrawlabilityClient";
import { getActiveProject } from "../../lib/project-context";
import { fetchRobotsTxt } from "./actions";
import "./crawlability.css";

export default async function Page() {
  const project = await getActiveProject();
  const domain = project?.domain ?? null;

  let robotsTxtContent: string | null = null;
  let robotsTxtUrl = domain ? `https://${domain}/robots.txt` : "";
  let fetchError: string | null = null;
  const fetchedAt = new Date().toISOString();

  if (domain) {
    const result = await fetchRobotsTxt(domain);
    robotsTxtContent = result.content;
    robotsTxtUrl = result.url;
    fetchError = result.error;
  }

  return (
    <DashboardLayout currentPath="/crawlability">
      <CrawlabilityClient
        domain={domain}
        robotsTxtContent={robotsTxtContent}
        robotsTxtUrl={robotsTxtUrl}
        projectName={project?.name ?? "Your Project"}
        fetchError={fetchError}
        fetchedAt={fetchedAt}
      />
    </DashboardLayout>
  );
}
