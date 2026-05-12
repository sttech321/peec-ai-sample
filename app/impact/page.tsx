import DashboardLayout from "../../components/DashboardLayout";
import ImpactClient from "../../components/ImpactClient";
import { db } from "../../db";
import { analyticsSnapshots } from "../../db/schema";
import { eq, asc } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";

export default async function ImpactPage() {
  const activeProjectId = await getActiveProjectId();

  const snapshots = await db
    .select()
    .from(analyticsSnapshots)
    .where(eq(analyticsSnapshots.projectId, activeProjectId))
    .orderBy(asc(analyticsSnapshots.snapshotDate));

  return (
    <DashboardLayout currentPath="/impact">
      <ImpactClient initialSnapshots={snapshots} />
    </DashboardLayout>
  );
}
