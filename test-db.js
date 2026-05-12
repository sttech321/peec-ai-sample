const postgres = require('postgres');

const sql = postgres("postgres://postgres:Sss1234!@localhost:5432/postgres");

async function test() {
  try {
    const result = await sql`SELECT 1 as result`;
    console.log("Connection successful:", result);
  } catch (err) {
    console.error("Connection failed:", err);
  } finally {
    process.exit(0);
  }
}

test();
