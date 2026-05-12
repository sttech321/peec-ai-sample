const postgres = require('postgres');

async function setup() {
  const sql = postgres('postgres://postgres:Sss1234!@localhost:5432/postgres');
  try {
    await sql`CREATE DATABASE ai_visibility_tracker`;
    console.log("Database 'ai_visibility_tracker' created successfully!");
  } catch (err) {
    if (err.code === '42P04') {
      console.log("Database already exists.");
    } else {
      console.error("Error creating database:", err);
    }
  } finally {
    await sql.end();
  }
}

setup();
