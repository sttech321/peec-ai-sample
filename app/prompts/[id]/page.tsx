import DashboardLayout from "../../../components/DashboardLayout";
import PromptDetailClient from "../../../components/PromptDetailClient";
import { db } from "../../../db";
import { prompts, topics, projects } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { fetchChatFacts, fetchProjectBrands } from "../../../lib/chat-facts-server";
import "./prompt-detail.css";

export default async function PromptDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: promptId } = await params;

  const promptRecord = await db
    .select({
      id: prompts.id,
      query: prompts.query,
      createdAt: prompts.createdAt,
      volumeTier: prompts.volumeTier,
      projectId: prompts.projectId,
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

  const [chatFacts, projectBrands] = await Promise.all([
    fetchChatFacts({ projectId: prompt.projectId, promptId }),
    fetchProjectBrands(prompt.projectId),
  ]);

  const promptInfo = {
    query: prompt.query,
    createdAt: prompt.createdAt?.toISOString() || new Date().toISOString(),
    volumeTier: prompt.volumeTier || "Medium",
    topicName: prompt.topicName || "General",
    projectName: prompt.projectName || "General",
  };

  return (
    <DashboardLayout currentPath="/prompts">
      <PromptDetailClient
        prompt={promptInfo}
        chatFacts={chatFacts}
        projectBrands={projectBrands}
      />
    </DashboardLayout>
  );
}
