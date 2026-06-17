import RankingClient from "../../../components/RankingClient";
import { fetchChatFacts, fetchProjectBrands } from "../../../lib/chat-facts-server";
import { getActiveProjectId } from "../../../lib/project-context";
import { getPageFilterData } from "../../../lib/page-filter-data";
import { fetchChatMaps } from "../../../lib/fetch-chat-maps";
import "../../ranking/ranking.css";

export default async function RankingPage() {
  const projectId = await getActiveProjectId();

  const [chatFacts, projectBrands, filterData, chatMaps] = await Promise.all([
    fetchChatFacts({ projectId }),
    fetchProjectBrands(projectId),
    getPageFilterData(projectId),
    fetchChatMaps(projectId),
  ]);

  return (
    <RankingClient
      chatFacts={chatFacts}
      projectBrands={projectBrands}
      availableTags={filterData.availableTags}
      availableTopics={filterData.availableTopics}
      chatTagsMap={chatMaps.chatTagsMap}
      chatTopicMap={chatMaps.chatTopicMap}
    />
  );
}
