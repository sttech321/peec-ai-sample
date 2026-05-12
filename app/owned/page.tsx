import DashboardLayout from "../../components/DashboardLayout";
import OwnedClient from "../../components/OwnedClient";
import { db } from "../../db";
import { ownedActions, projects } from "../../db/schema";
import { eq } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import "../earned/earned.css"; // Reuse same styles

export default async function OwnedPage() {
  const activeProjectId = await getActiveProjectId();

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, activeProjectId))
    .limit(1);

  const actions = await db
    .select()
    .from(ownedActions)
    .where(eq(ownedActions.projectId, activeProjectId));

  return (
    <DashboardLayout currentPath="/owned">
      <OwnedClient
        initialActions={actions}
        projectName={project?.name || "this project"}
      />
    </DashboardLayout>
  );
}
