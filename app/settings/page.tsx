import DashboardLayout from "../../components/DashboardLayout";
import SettingsClient from "../../components/SettingsClient";
import { getAllProjects } from "../../lib/project-context";
import "./settings.css";

export default async function SettingsPage() {
  const allProjects = await getAllProjects();

  return (
    <DashboardLayout currentPath="/settings">
      <SettingsClient
        projects={allProjects.map(p => ({ id: p.id, name: p.name, domain: p.domain }))}
      />
    </DashboardLayout>
  );
}
