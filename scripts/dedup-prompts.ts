// Run: npx tsx --env-file=.env scripts/dedup-prompts.ts
import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`
    DELETE FROM prompts
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
          ROW_NUMBER() OVER (PARTITION BY project_id, query ORDER BY created_at ASC) AS rn
        FROM prompts
      ) sub
      WHERE rn > 1
    )
    RETURNING id, query
  `);

  console.log(`Deleted ${result.length} duplicate prompts`);
  (result as any[]).forEach((r: any) =>
    console.log(" -", String(r.query ?? "").slice(0, 70))
  );
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
