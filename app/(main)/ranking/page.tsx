import RankingClient from "../../../components/RankingClient";
import { fetchChatFacts, fetchProjectBrands } from "../../../lib/chat-facts-server";
import { getActiveProjectId } from "../../../lib/project-context";
import { getPageFilterData } from "../../../lib/page-filter-data";
import "../../ranking/ranking.css";

export default async function RankingPage() {
  const projectId = await getActiveProjectId();

  const [chatFacts, projectBrands, filterData] = await Promise.all([
    fetchChatFacts({ projectId }),
    fetchProjectBrands(projectId),
    getPageFilterData(projectId),
  ]);

  return (
    <RankingClient
      chatFacts={chatFacts}
      projectBrands={projectBrands}
      availableTags={filterData.availableTags}
    />
  );
}
