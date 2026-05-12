import DashboardLayout from "../components/DashboardLayout";
import { db } from "../db";
import { projects } from "../db/schema";
import { eq } from "drizzle-orm";
import { getActiveProjectId } from "../lib/project-context";
import { fetchChatFacts, fetchProjectBrands } from "../lib/chat-facts-server";
import OverviewClient from "../components/OverviewClient";
import "./prompts/[id]/prompt-detail.css";

export default async function Home() {
  const activeProjectId = await getActiveProjectId();

  const projectRecord = await db
    .select()
    .from(projects)
    .where(eq(projects.id, activeProjectId));
  const projectName = projectRecord[0]?.name || "General";

  const [chatFacts, projectBrands] = await Promise.all([
    fetchChatFacts({ projectId: activeProjectId }),
    fetchProjectBrands(activeProjectId),
  ]);

  return (
    <DashboardLayout currentPath="/">
      <OverviewClient
        chatFacts={chatFacts}
        projectName={projectName}
        projectBrands={projectBrands}
      />
    </DashboardLayout>
  );
}
