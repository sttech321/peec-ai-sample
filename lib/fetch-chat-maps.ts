import { db } from "../db";
import { chats, prompts, topics, tags, promptTags } from "../db/schema";
import { eq } from "drizzle-orm";

/** Fetches chatTopicMap (chatId → topicName) and chatTagsMap (chatId → tagNames[]) for a project. */
export async function fetchChatMaps(projectId: string): Promise<{
  chatTopicMap: Record<string, string>;
  chatTagsMap: Record<string, string[]>;
}> {
  const [chatTopicRows, chatTagRows] = await Promise.all([
    db
      .select({ chatId: chats.id, topicName: topics.name })
      .from(chats)
      .innerJoin(prompts, eq(chats.promptId, prompts.id))
      .innerJoin(topics, eq(prompts.topicId, topics.id))
      .where(eq(prompts.projectId, projectId)),

    db
      .select({ chatId: chats.id, tagName: tags.name })
      .from(chats)
      .innerJoin(prompts, eq(chats.promptId, prompts.id))
      .innerJoin(promptTags, eq(promptTags.promptId, prompts.id))
      .innerJoin(tags, eq(promptTags.tagId, tags.id))
      .where(eq(prompts.projectId, projectId)),
  ]);

  const chatTopicMap: Record<string, string> = {};
  for (const r of chatTopicRows) chatTopicMap[r.chatId] = r.topicName;

  const chatTagsMap: Record<string, string[]> = {};
  for (const r of chatTagRows) {
    if (!chatTagsMap[r.chatId]) chatTagsMap[r.chatId] = [];
    chatTagsMap[r.chatId].push(r.tagName);
  }

  return { chatTopicMap, chatTagsMap };
}
