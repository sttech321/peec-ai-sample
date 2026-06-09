import DashboardLayout from "../../components/DashboardLayout";
import ChatsPageClient from "../../components/ChatsPageClient";
import { fetchProjectBrands } from "../../lib/chat-facts-server";
import { getActiveProjectId } from "../../lib/project-context";
import { getPageFilterData } from "../../lib/page-filter-data";
import "../prompts/[id]/prompt-detail.css";
import "./chats.css";

export default async function ChatsPage() {
  const projectId = await getActiveProjectId();

  const [projectBrands, filterData] = await Promise.all([
    fetchProjectBrands(projectId),
    getPageFilterData(projectId),
  ]);

  const ownBrand = projectBrands.find(b => b.isOwn) ?? null;

  return (
    <DashboardLayout currentPath="/chats">
      <ChatsPageClient
        ownBrandName={ownBrand?.name ?? null}
        availableTags={filterData.availableTags}
      />
    </DashboardLayout>
  );
}
