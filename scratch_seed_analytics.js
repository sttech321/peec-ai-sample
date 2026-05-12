const postgres = require('postgres');
const sql = postgres("postgres://postgres:Sss1234!@localhost:5432/ai_visibility_tracker");

async function seed() {
  try {
    const projects = await sql`SELECT id, workspace_id FROM projects LIMIT 1`;
    if (projects.length === 0) {
      console.log("No projects found to seed analytics.");
      return;
    }
    const { id: projectId, workspace_id: workspaceId } = projects[0];

    // Truncate existing snapshots
    await sql`DELETE FROM analytics_snapshots WHERE project_id = ${projectId}`;

    const snapshots = [];
    const now = new Date();
    
    for (let i = 14; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      snapshots.push({
        workspace_id: workspaceId,
        project_id: projectId,
        snapshot_date: date,
        visibility_score: 40 + Math.random() * 20 + (14 - i) * 2,
        mention_count: Math.floor(10 + Math.random() * 5 + (14 - i)),
        citation_count: Math.floor(5 + Math.random() * 3 + (14 - i) / 2),
        share_of_voice: JSON.stringify({
          'Own Brand': 45 + Math.random() * 10,
          'Competitor A': 20 + Math.random() * 5,
          'Competitor B': 15 + Math.random() * 5,
          'Others': 10 + Math.random() * 5
        })
      });
    }

    for (const s of snapshots) {
      await sql`
        INSERT INTO analytics_snapshots (
          workspace_id, project_id, snapshot_date, visibility_score, mention_count, citation_count, share_of_voice
        ) VALUES (
          ${s.workspace_id}, ${s.project_id}, ${s.snapshot_date}, ${s.visibility_score}, ${s.mention_count}, ${s.citation_count}, ${s.share_of_voice}
        )
      `;
    }

    console.log("Seeded analytics snapshots successfully.");
  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    process.exit(0);
  }
}

seed();
