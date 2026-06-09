import DashboardLayout from "../../components/DashboardLayout";
import InsightsClient from "../../components/InsightsClient";
import PageFilterBar from "../../components/PageFilterBar";
import { db } from "../../db";
import { projects, brands, brandProfiles, chats, prompts, topics, tags, promptTags } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { getActiveProjectId } from "../../lib/project-context";
import { fetchChatFacts, fetchProjectBrands } from "../../lib/chat-facts-server";
import { getPageFilterData } from "../../lib/page-filter-data";
import { addBrand } from "../actions/brands";
import type { BrandProfile } from "../../lib/brand-profile-types";
import "../prompts/[id]/prompt-detail.css";
import "../prompts/prompts-comparison.css";
import "./insights.css";

export default async function InsightsPage() {
  const activeProjectId = await getActiveProjectId();

  // All independent queries run in parallel
  const [[projectRecord], [ownBrand], profileResult, chatFacts, projectBrands, filterData,
         chatTopicRows, chatTagRows] =
    await Promise.all([
      db.select({ name: projects.name }).from(projects)
        .where(eq(projects.id, activeProjectId)).limit(1),

      db.select({ name: brands.name, domains: brands.domains }).from(brands)
        .where(and(eq(brands.projectId, activeProjectId), eq(brands.isOwn, true))).limit(1),

      db.select({ data: brandProfiles.data }).from(brandProfiles)
        .where(eq(brandProfiles.projectId, activeProjectId)).limit(1)
        .catch(() => [] as { data: unknown }[]),

      fetchChatFacts({ projectId: activeProjectId }),
      fetchProjectBrands(activeProjectId),
      getPageFilterData(activeProjectId),

      // chatId → topicName
      db.select({ chatId: chats.id, topicName: topics.name })
        .from(chats)
        .innerJoin(prompts, eq(chats.promptId, prompts.id))
        .innerJoin(topics, eq(prompts.topicId, topics.id))
        .where(eq(prompts.projectId, activeProjectId)),

      // chatId → tagName (one row per tag per chat)
      db.select({ chatId: chats.id, tagName: tags.name })
        .from(chats)
        .innerJoin(prompts, eq(chats.promptId, prompts.id))
        .innerJoin(promptTags, eq(promptTags.promptId, prompts.id))
        .innerJoin(tags, eq(promptTags.tagId, tags.id))
        .where(eq(prompts.projectId, activeProjectId)),
    ]);

  // Build maps: chatId → topicName, chatId → tagNames[]
  const chatTopicMap: Record<string, string> = {};
  for (const r of chatTopicRows) chatTopicMap[r.chatId] = r.topicName;

  const chatTagsMap: Record<string, string[]> = {};
  for (const r of chatTagRows) {
    if (!chatTagsMap[r.chatId]) chatTagsMap[r.chatId] = [];
    chatTagsMap[r.chatId].push(r.tagName);
  }

  const projectName = projectRecord?.name || "General";
  let profileDomain: string | null = null;
  try {
    const data = (profileResult as any[])[0]?.data as Partial<BrandProfile> | undefined;
    if (data?.domain) profileDomain = String(data.domain).trim();
  } catch { /* brand profile optional */ }

  const ownDomain =
    profileDomain ||
    (ownBrand?.domains && ownBrand.domains.length > 0 ? ownBrand.domains[0] : null);

  return (
    <DashboardLayout currentPath="/insights">
      <PageFilterBar
        projectName={projectName}
        projectBrands={filterData.projectBrands}
        availableTags={filterData.availableTags}
        addBrandAction={addBrand}
      />
      <InsightsClient
        chatFacts={chatFacts}
        projectName={projectName}
        projectBrands={projectBrands}
        ownBrandName={ownBrand?.name ?? null}
        ownDomain={ownDomain}
        chatTopicMap={chatTopicMap}
        chatTagsMap={chatTagsMap}
      />
    </DashboardLayout>
  );
}
