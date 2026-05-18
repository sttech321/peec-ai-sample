import DashboardLayout from "../../components/DashboardLayout";
import ImpactClient, { ImpactRow } from "../../components/ImpactClient";
import { db } from "../../db";
import { earnedActions, ownedActions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import { updateImpactActionStatus } from "./actions";
import "../earned/earned.css";

export default async function ImpactPage() {
  const activeProjectId = await getActiveProjectId();

  const [earned, owned] = await Promise.all([
    db
      .select()
      .from(earnedActions)
      .where(eq(earnedActions.projectId, activeProjectId)),
    db
      .select()
      .from(ownedActions)
      .where(eq(ownedActions.projectId, activeProjectId)),
  ]);

  const rows: ImpactRow[] = [
    ...earned.map((a) => ({
      id: a.id,
      kind: "earned" as const,
      title: a.title,
      description: a.description,
      sourceUrl: a.sourceUrl ?? null,
      status: a.status,
      group: classifyEarnedGroup(a.type, a.sourceDomain),
      type: a.sourceDomain || a.type || "—",
      priority: a.priority,
      updatedAt: a.updatedAt.toISOString(),
    })),
    ...owned.map((a) => ({
      id: a.id,
      kind: "owned" as const,
      title: a.title,
      description: a.description,
      sourceUrl: a.pageUrl ?? null,
      status: a.status,
      group: "Owned" as const,
      type: "On-page",
      priority: a.priority,
      updatedAt: a.updatedAt.toISOString(),
    })),
  ];

  return (
    <DashboardLayout currentPath="/impact">
      <ImpactClient
        initialRows={rows}
        updateStatusAction={updateImpactActionStatus}
      />
    </DashboardLayout>
  );
}

function classifyEarnedGroup(
  type: string | null,
  domain: string | null,
): "UGC" | "Editorial" {
  const d = (domain || "").toLowerCase();
  if (
    /(reddit|linkedin|quora|youtube|medium|facebook|twitter|x|tiktok)\.(com|ai)/.test(
      d,
    )
  )
    return "UGC";
  const t = (type || "").toLowerCase();
  if (/(listicle|article|comparison|review|guide)/.test(t)) return "Editorial";
  if (/(reddit|forum|youtube|quora|medium|linkedin)/.test(t)) return "UGC";
  return "Editorial";
}
