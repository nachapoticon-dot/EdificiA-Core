#!/usr/bin/env node
/**
 * Runner de migraciones propio (reemplaza @insforge/cli db migrations).
 *
 * Uso:
 *   node scripts/migrate.mjs            → aplica las pendientes de migrations/*.sql
 *   node scripts/migrate.mjs --dry-run  → lista pendientes sin aplicar
 *   node scripts/migrate.mjs new <nombre-kebab>  → crea migración vacía con timestamp
 *
 * Registro en tabla schema_migrations(filename, applied_at).
 * Cada migración corre dentro de su propia transacción.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "..", "migrations");
const DEFAULT_DATABASE_URL = "postgres://edificia:edificia_dev@localhost:5432/edificia";

async function createNewMigration(name) {
  if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    console.error("Uso: node scripts/migrate.mjs new <nombre-en-kebab-case>");
    process.exit(1);
  }
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const file = path.join(MIGRATIONS_DIR, `${ts}_${name}.sql`);
  await writeFile(file, `-- ${name}\n`, { flag: "wx" });
  console.log(`Creada: ${path.relative(process.cwd(), file)}`);
}

async function run() {
  const [, , ...args] = process.argv;
  if (args[0] === "new") {
    await createNewMigration(args[1]);
    return;
  }
  const dryRun = args.includes("--dry-run");

  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    console.warn(`DATABASE_URL no seteada; usando default local (${DEFAULT_DATABASE_URL.replace(/:[^:@/]+@/, ":***@")})`);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const { rows } = await client.query("SELECT filename FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.filename));
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log("Sin migraciones pendientes.");
      return;
    }
    if (dryRun) {
      console.log(`Pendientes (${pending.length}):`);
      for (const f of pending) console.log(`  - ${f}`);
      return;
    }

    for (const file of pending) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`Aplicando ${file} ... `);
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log("OK");
      } catch (err) {
        await client.query("ROLLBACK");
        console.log("ERROR");
        console.error(`\nFalló ${file}:\n${err.message}`);
        process.exit(1);
      }
    }
    console.log(`Listo: ${pending.length} migración(es) aplicada(s).`);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
