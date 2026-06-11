#!/usr/bin/env node
/**
 * Import one-shot del export de InsForge al Postgres local (cutover Fase 2).
 *
 * Uso: node --env-file-if-exists=.env.local scripts/import-local.mjs [--in data/export]
 *
 * - Preserva ids (organization_members.user_id, FKs, etc.).
 * - session_replication_role=replica: desactiva triggers/FK durante el import
 *   (preserva hashes originales del audit log encadenado).
 * - Usuarios → auth.users con password_hash NULL (flujo "olvidé mi contraseña").
 * - Archivos de storage → copiar data/export/storage/* a STORAGE_DIR.
 */
import { cp, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const IN_DIR = process.argv.includes("--in")
  ? process.argv[process.argv.indexOf("--in") + 1]
  : "data/export";
const STORAGE_DIR = process.env.STORAGE_DIR ?? "./data/storage";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? "postgres://edificia:edificia_dev@localhost:5432/edificia",
});
await client.connect();

const colTypes = new Map(); // "table" → Map<col, udt>
async function getTypes(table, schema = "public") {
  const key = `${schema}.${table}`;
  if (!colTypes.has(key)) {
    const { rows } = await client.query(
      "SELECT column_name, udt_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2",
      [schema, table],
    );
    colTypes.set(key, new Map(rows.map((r) => [r.column_name, r.udt_name])));
  }
  return colTypes.get(key);
}

function encode(value, udt) {
  if (value === null || value === undefined) return null;
  if (udt === "jsonb" || udt === "json") return JSON.stringify(value);
  if (udt?.startsWith("_")) return value;
  if (typeof value === "object" && !Array.isArray(value)) return JSON.stringify(value);
  return value;
}

async function importRows(table, rows, schema = "public") {
  if (rows.length === 0) return 0;
  const types = await getTypes(table, schema);
  const columns = Object.keys(rows[0]).filter((c) => types.has(c));
  let inserted = 0;
  for (const row of rows) {
    const values = columns.map((c) => encode(row[c], types.get(c)));
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    try {
      await client.query(
        `INSERT INTO ${schema}."${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values,
      );
      inserted++;
    } catch (err) {
      console.warn(`  ⚠ ${schema}.${table} fila ${row.id ?? "?"}: ${err.message}`);
    }
  }
  return inserted;
}

await client.query("SET session_replication_role = replica");

// ── Usuarios primero (FKs lógicas apuntan acá) ──────────────────────────────
const usersPath = path.join(IN_DIR, "users.json");
if (existsSync(usersPath)) {
  const users = JSON.parse(await readFile(usersPath, "utf8"));
  const rows = users.map((u) => ({
    id: u.id,
    email: (u.email ?? "").toLowerCase(),
    name: u.name ?? u.user_metadata?.name ?? null,
    password_hash: null,
    created_at: u.created_at ?? new Date().toISOString(),
  }));
  const n = await importRows("users", rows, "auth");
  console.log(`  auth.users: ${n}/${rows.length}`);
}

// ── Tablas (orden alfabético; FKs desactivadas por replica mode) ────────────
const tablesDir = path.join(IN_DIR, "tables");
if (existsSync(tablesDir)) {
  for (const file of (await readdir(tablesDir)).filter((f) => f.endsWith(".json")).sort()) {
    const table = file.replace(/\.json$/, "");
    const rows = JSON.parse(await readFile(path.join(tablesDir, file), "utf8"));
    const n = await importRows(table, rows);
    console.log(`  ${table}: ${n}/${rows.length}`);
  }
}

await client.query("SET session_replication_role = DEFAULT");
await client.end();

// ── Storage ─────────────────────────────────────────────────────────────────
const storageSrc = path.join(IN_DIR, "storage");
if (existsSync(storageSrc)) {
  await cp(storageSrc, STORAGE_DIR, { recursive: true, force: false, errorOnExist: false });
  console.log(`  storage copiado a ${STORAGE_DIR}`);
}

console.log("\nImport completo.");
