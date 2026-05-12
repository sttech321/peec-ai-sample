import { db } from "./db";
import { brandMentions, chats, sources } from "./db/schema";
import { count } from "drizzle-orm";

async function check() {
  const mentionsCount = await db.select({ count: count() }).from(brandMentions);
  const sourcesCount = await db.select({ count: count() }).from(sources);
  const chatsCount = await db.select({ count: count() }).from(chats);
  
  console.log("Database Stats:");
  console.log("- Total Chats:", chatsCount[0].count);
  console.log("- Total Brand Mentions:", mentionsCount[0].count);
  console.log("- Total Sources:", sourcesCount[0].count);

  if (chatsCount[0].count > 0) {
    const lastChat = await db.select().from(chats).orderBy(chats.createdAt).limit(1);
    console.log("\nLast Chat Response Snippet:", lastChat[0].rawResponse?.substring(0, 200));
  }
  
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
