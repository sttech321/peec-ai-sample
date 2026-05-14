import DashboardLayout from "../../../components/DashboardLayout";
import PromptDetailClient from "../../../components/PromptDetailClient";
import { db } from "../../../db";
import { prompts, topics, projects, tags, promptTags } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { fetchChatFacts, fetchProjectBrands } from "../../../lib/chat-facts-server";
import "./prompt-detail.css";
import "../prompts-comparison.css";

export default async function PromptDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: promptId } = await params;

  const promptRecord = await db
    .select({
      id: prompts.id,
      query: prompts.query,
      createdAt: prompts.createdAt,
      volumeTier: prompts.volumeTier,
      projectId: prompts.projectId,
      isActive: prompts.isActive,
      location: prompts.location,
      topicName: topics.name,
      projectName: projects.name,
    })
    .from(prompts)
    .leftJoin(topics, eq(prompts.topicId, topics.id))
    .leftJoin(projects, eq(prompts.projectId, projects.id))
    .where(eq(prompts.id, promptId));

  if (!promptRecord.length) {
    return (
      <DashboardLayout currentPath="/prompts">
        <div className="p-8 text-center text-slate-400">Prompt not found</div>
      </DashboardLayout>
    );
  }
  const prompt = promptRecord[0];

  const [chatFacts, projectBrands, availableTagsRaw, selectedTagsRaw] = await Promise.all([
    fetchChatFacts({ projectId: prompt.projectId, promptId }),
    fetchProjectBrands(prompt.projectId),
    db
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(tags)
      .where(eq(tags.projectId, prompt.projectId))
      .orderBy(tags.name),
    db
      .select({ tagId: promptTags.tagId })
      .from(promptTags)
      .where(eq(promptTags.promptId, promptId)),
  ]);

  const availableTags = availableTagsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color || "gray",
  }));
  const selectedTagIds = selectedTagsRaw.map((t) => t.tagId);

  const promptInfo = {
    id: prompt.id,
    query: prompt.query,
    createdAt: prompt.createdAt?.toISOString() || new Date().toISOString(),
    volumeTier: prompt.volumeTier || "Medium",
    topicName: prompt.topicName || "General",
    projectName: prompt.projectName || "General",
    isActive: prompt.isActive,
    location: prompt.location || "US",
  };

  return (
    <DashboardLayout currentPath="/prompts">
      <PromptDetailClient
        prompt={promptInfo}
        chatFacts={chatFacts}
        projectBrands={projectBrands}
        availableTags={availableTags}
        selectedTagIds={selectedTagIds}
      />
    </DashboardLayout>
  );
}
