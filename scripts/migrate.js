#!/usr/bin/env node
// Runs all SQL migrations in order against the local postgres (Docker only).
// Uses DATABASE_URL from environment. Skips gracefully if not set.
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgres")) {
    console.log("[migrate] DATABASE_URL not set or not postgres — skipping local migrations.");
    return;
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  // Ensure tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  const migrationsDir = path.join(__dirname, "../db/migrations");
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const { rows } = await client.query("SELECT 1 FROM _migrations WHERE name = $1", [file]);
    if (rows.length > 0) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`[migrate] Applying ${file}…`);
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      console.log(`[migrate] ✓ ${file}`);
    } catch (err) {
      console.error(`[migrate] ✗ ${file}: ${err.message}`);
    }
  }

  await client.end();
  console.log("[migrate] Done.");
}

run().catch(err => {
  console.error("[migrate] Fatal:", err.message);
  process.exit(0); // Don't block app startup
});
