import DashboardLayout from "../../components/DashboardLayout";
import OwnedClient from "../../components/OwnedClient";
import { db } from "../../db";
import { ownedActions, projects } from "../../db/schema";
import { eq } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import { MOCK_OWNED_ACTIONS } from "../../lib/mock-actions";
import "../earned/earned.css";

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

  const finalActions = actions.length === 0 ? MOCK_OWNED_ACTIONS : actions;

  return (
    <DashboardLayout currentPath="/owned">
      <OwnedClient
        initialActions={finalActions as any[]}
        projectName={project?.name || "this project"}
      />
    </DashboardLayout>
  );
}
