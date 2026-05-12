import DashboardLayout from "../../components/DashboardLayout";
import EarnedClient from "../../components/EarnedClient";
import { db } from "../../db";
import { projects, earnedActions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import "./earned.css";

export default async function EarnedPage() {
  const activeProjectId = await getActiveProjectId();

  const [projectRecord] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, activeProjectId))
    .limit(1);
  const projectName = projectRecord?.name || "General";

  const actions = await db
    .select()
    .from(earnedActions)
    .where(eq(earnedActions.projectId, activeProjectId));

  return (
    <DashboardLayout currentPath="/earned">
      <EarnedClient
        initialActions={actions}
        projectName={projectName}
      />
    </DashboardLayout>
  );
}
