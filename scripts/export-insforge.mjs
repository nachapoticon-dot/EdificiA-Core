#!/usr/bin/env node
/**
 * Export one-shot de InsForge (DB + usuarios + storage) a disco, previo al cutover.
 *
 * Uso: node --env-file=.env.local scripts/export-insforge.mjs [--out data/export]
 *
 * - Tablas: las del schema local (public.*) — pagina por cursor de id vía SDK.
 * - Usuarios: /auth/v1/admin/users (paginado). Passwords NO exportables → hash NULL.
 * - Storage: descarga cada uploaded_files.storage_path del bucket "presupuestos".
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@insforge/sdk";
import pg from "pg";

const OUT_DIR = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "data/export";
const BUCKET = "presupuestos";
const PAGE = 500;

const BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL;
const KEY = process.env.INSFORGE_SERVICE_ROLE_KEY;
if (!BASE_URL || !KEY) {
  console.error("Faltan NEXT_PUBLIC_INSFORGE_URL / INSFORGE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const insforge = createClient({ baseUrl: BASE_URL, anonKey: KEY, isServerMode: true });

// La lista de tablas sale del Postgres local (schema canónico post-migraciones)
const local = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? "postgres://edificia:edificia_dev@localhost:5432/edificia",
});
await local.connect();
const { rows: tableRows } = await local.query(`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public' AND tablename NOT IN ('schema_migrations') AND tablename NOT LIKE 'test_%'
  ORDER BY tablename
`);
await local.end();
const tables = tableRows.map((r) => r.tablename);

await mkdir(path.join(OUT_DIR, "tables"), { recursive: true });
await mkdir(path.join(OUT_DIR, "storage", BUCKET), { recursive: true });

// ── Tablas ──────────────────────────────────────────────────────────────────
const summary = {};
for (const table of tables) {
  const rows = [];
  let cursor = null;
  for (;;) {
    let q = insforge.database.from(table).select("*").order("id", { ascending: true }).limit(PAGE);
    if (cursor) q = q.gt("id", cursor);
    const { data, error } = await q;
    if (error) {
      console.warn(`  ⚠ ${table}: ${error.message} (se exporta vacía)`);
      break;
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    cursor = batch[batch.length - 1].id;
  }
  await writeFile(path.join(OUT_DIR, "tables", `${table}.json`), JSON.stringify(rows));
  summary[table] = rows.length;
  console.log(`  ${table}: ${rows.length} filas`);
}

// ── Usuarios ────────────────────────────────────────────────────────────────
const users = [];
for (let page = 1; ; page++) {
  const res = await fetch(`${BASE_URL}/auth/v1/admin/users?page=${page}&per_page=100`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) {
    console.warn(`  ⚠ admin/users página ${page}: HTTP ${res.status}`);
    break;
  }
  const body = await res.json();
  const batch = body.users ?? body.data ?? [];
  users.push(...batch);
  if (batch.length < 100) break;
}
await writeFile(path.join(OUT_DIR, "users.json"), JSON.stringify(users, null, 2));
console.log(`  auth.users: ${users.length} usuarios`);

// ── Storage ─────────────────────────────────────────────────────────────────
const filesJson = JSON.parse(
  await import("node:fs/promises").then((fs) => fs.readFile(path.join(OUT_DIR, "tables", "uploaded_files.json"), "utf8")),
);
let downloaded = 0;
for (const file of filesJson) {
  if (!file.storage_path) continue;
  const { data, error } = await insforge.storage.from(BUCKET).download(file.storage_path);
  if (error || !data) {
    console.warn(`  ⚠ storage ${file.storage_path}: ${error?.message ?? "sin data"}`);
    continue;
  }
  const target = path.join(OUT_DIR, "storage", BUCKET, file.storage_path);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await data.arrayBuffer()));
  downloaded++;
}
console.log(`  storage: ${downloaded} archivos descargados`);

await writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify({ exportedAt: new Date().toISOString(), tables: summary, users: users.length, storageFiles: downloaded }, null, 2));
console.log(`\nExport completo en ${OUT_DIR}/`);
