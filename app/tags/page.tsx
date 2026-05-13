import DashboardLayout from "../../components/DashboardLayout";
import TagsClient, { TagRow } from "../../components/TagsClient";
import { db } from "../../db";
import { projects } from "../../db/schema";
import { eq } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import { getTags } from "./actions";
import "./tags.css";

export default async function TagsPage() {
  const activeProjectId = await getActiveProjectId();

  const [project] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, activeProjectId))
    .limit(1);

  const workspaceId = project?.workspaceId ?? "00000000-0000-0000-0000-000000000000";

  // Fetch tags with real usage counts from promptTags JOIN
  const projectTags = await getTags(activeProjectId);

  const rows: TagRow[] = projectTags.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug ?? null,
    color: t.color,
    usageCount: Number(t.usageCount),
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
  }));

  return (
    <DashboardLayout currentPath="/tags">
      <TagsClient
        initialTags={rows}
        projectId={activeProjectId}
        workspaceId={workspaceId}
      />
    </DashboardLayout>
  );
}
