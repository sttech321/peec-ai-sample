import { redirect } from "next/navigation";
import DashboardLayout from "../../components/DashboardLayout";
import SettingsClient from "../../components/SettingsClient";
import { getAllProjects, getCurrentRole } from "../../lib/project-context";
import { canManageWorkspace } from "../../lib/permissions";
import "./settings.css";

export default async function SettingsPage() {
  const role = await getCurrentRole();
  if (!canManageWorkspace(role)) redirect("/unauthorized");

  const allProjects = await getAllProjects();

  return (
    <DashboardLayout currentPath="/settings">
      <SettingsClient
        projects={allProjects.map(p => ({ id: p.id, name: p.name, domain: p.domain }))}
      />
    </DashboardLayout>
  );
}
