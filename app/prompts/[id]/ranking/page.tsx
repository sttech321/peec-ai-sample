import DashboardLayout from "../../../../components/DashboardLayout";
import RankingClient from "../../../../components/RankingClient";
import { db } from "../../../../db";
import { prompts } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import { fetchChatFacts, fetchProjectBrands } from "../../../../lib/chat-facts-server";
import { getPageFilterData } from "../../../../lib/page-filter-data";
import "../../../ranking/ranking.css";

// Ranking page reached from a prompt at /prompts/[id]/ranking. Shows the full
// project-wide brand ranking (all brands, not just those in this prompt), same
// data as the global /ranking page. currentPath stays "/prompts" so the sidebar
// keeps "Prompts" highlighted and the Overview Ranking/Chats sub-menu is hidden.
export default async function PromptRankingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: promptId } = await params;

  const promptRecord = await db
    .select({ projectId: prompts.projectId, query: prompts.query })
    .from(prompts)
    .where(eq(prompts.id, promptId))
    .limit(1);

  if (!promptRecord.length) {
    return (
      <DashboardLayout currentPath="/prompts">
        <div className="p-8 text-center text-slate-400">Prompt not found</div>
      </DashboardLayout>
    );
  }

  const { projectId, query } = promptRecord[0];

  const [chatFacts, projectBrands, filterData] = await Promise.all([
    fetchChatFacts({ projectId }),
    fetchProjectBrands(projectId),
    getPageFilterData(projectId),
  ]);

  return (
    <DashboardLayout currentPath="/prompts">
      <RankingClient
        chatFacts={chatFacts}
        projectBrands={projectBrands}
        availableTags={filterData.availableTags}
        promptCrumb={{ id: promptId, query }}
      />
    </DashboardLayout>
  );
}
