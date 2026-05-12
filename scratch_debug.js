const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");

const connectionString = "postgres://postgres:Sss1234%21@localhost:5432/ai_visibility_tracker";
const client = postgres(connectionString);
const db = drizzle(client);

async function check() {
  try {
    const chats = await client`SELECT count(*) FROM chats`;
    const mentions = await client`SELECT count(*) FROM brand_mentions`;
    const sources = await client`SELECT count(*) FROM sources`;
    const lastChat = await client`SELECT raw_response FROM chats ORDER BY created_at DESC LIMIT 1`;

    console.log("Database Stats:");
    console.log("- Total Chats:", chats[0].count);
    console.log("- Total Brand Mentions:", mentions[0].count);
    console.log("- Total Sources:", sources[0].count);

    if (lastChat.length > 0) {
      console.log("\nLast Chat Response Snippet:", lastChat[0].raw_response.substring(0, 300));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
    process.exit(0);
  }
}

check();
