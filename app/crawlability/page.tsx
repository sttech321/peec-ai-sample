import DashboardLayout from "../../components/DashboardLayout";
import CrawlabilityClient from "../../components/CrawlabilityClient";
import { getActiveProject, getActiveProjectId } from "../../lib/project-context";
import { fetchRobotsTxt } from "./actions";
import { db } from "../../db";
import { brands } from "../../db/schema";
import { eq } from "drizzle-orm";
import "./crawlability.css";

export default async function Page() {
  const project = await getActiveProject();
  const projectId = await getActiveProjectId();
  const domain = project?.domain ?? null;

  // Fetch all tracked brands for brand-switcher
  const projectBrandsRaw = await db
    .select({ id: brands.id, name: brands.name, color: brands.color, domains: brands.domains, isOwn: brands.isOwn })
    .from(brands)
    .where(eq(brands.projectId, projectId))
    .orderBy(brands.isOwn, brands.name);

  const projectBrands = projectBrandsRaw.map((b) => ({
    id: b.id,
    name: b.name,
    color: b.color ?? null,
    domains: b.domains ?? [],
    isOwn: b.isOwn,
  }));

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
        brands={projectBrands}
      />
    </DashboardLayout>
  );
}
