import DashboardLayout from "../../components/DashboardLayout";
import { db } from "../../db";
import { projects, chats, prompts } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { getAllProjects, getWorkspaceId, getCurrentRole } from "../../lib/project-context";
import { updateProject, toggleProjectStatus, deleteProject } from "./actions";
import ProjectsClient, { ProjectRow, WorkspaceStats } from "../../components/ProjectsClient";
import { canManageWorkspace } from "../../lib/permissions";
import "./projects.css";

export const dynamic = "force-dynamic";

const MODEL_DAILY_COST = 30;

export default async function ProjectsPage() {
  const workspaceId = await getWorkspaceId();
  const role = await getCurrentRole();
  const isOwner = canManageWorkspace(role);

  const [allProjects, usedPromptsRows] = await Promise.all([
    getAllProjects(),
    db
      .select({
        projectId: prompts.projectId,
        usedPrompts: sql<number>`cast(count(distinct ${chats.id}) as int)`,
      })
      .from(prompts)
      .leftJoin(chats, eq(chats.promptId, prompts.id))
      .where(eq(prompts.workspaceId, workspaceId))
      .groupBy(prompts.projectId),
  ]);

  const usedByProject = new Map<string, number>(
    usedPromptsRows.map((r) => [r.projectId, r.usedPrompts ?? 0]),
  );

  const projectRows: ProjectRow[] = allProjects.map((p) => {
    const usedPrompts = usedByProject.get(p.id) ?? 0;
    const usedCredits = usedPrompts * MODEL_DAILY_COST;
    return {
      id: p.id,
      name: p.name,
      brandName: p.brandName ?? null,
      domain: p.domain ?? null,
      allocatedPrompts: p.allocatedPrompts,
      allocatedCredits: p.allocatedCredits,
      frequency: p.frequency,
      status: p.status,
      projectType: p.projectType,
      color: p.color ?? null,
      models: p.models ?? null,
      location: p.location ?? null,
      language: p.language ?? null,
      timezone: p.timezone ?? null,
      createdAt: p.createdAt,
      usedPrompts,
      usedCredits,
    };
  });

  const totalUsedCredits = projectRows.reduce((s, p) => s + p.usedCredits, 0);
  const totalAllocatedCredits = projectRows.reduce((s, p) => s + p.allocatedCredits, 0);
  const totalUsedPrompts = projectRows.reduce((s, p) => s + p.usedPrompts, 0);
  const totalAllocatedPrompts = projectRows.reduce((s, p) => s + p.allocatedPrompts, 0);

  // Workspace credit capacity ("Max"): the larger of total allocated / total used,
  // rounded up to the next 10k so the usage bar always shows a remainder tail.
  const CREDIT_STEP = 10000;
  const creditBase = Math.max(totalAllocatedCredits, totalUsedCredits);
  const maxCredits = Math.max(CREDIT_STEP, Math.ceil((creditBase + 1) / CREDIT_STEP) * CREDIT_STEP);

  const workspaceStats: WorkspaceStats = {
    totalUsedCredits,
    totalAllocatedCredits,
    totalUsedPrompts,
    totalAllocatedPrompts,
    maxCredits,
  };

  return (
    <DashboardLayout currentPath="/projects">
      <ProjectsClient
        initialProjects={projectRows}
        workspaceStats={workspaceStats}
        updateProjectAction={updateProject}
        toggleStatusAction={toggleProjectStatus}
        deleteProjectAction={deleteProject}
        canDelete={isOwner}
      />
    </DashboardLayout>
  );
}
