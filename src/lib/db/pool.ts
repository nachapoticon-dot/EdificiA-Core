import { Pool, types } from "pg";

/**
 * Pool singleton de PostgreSQL para el backend.
 * Sobrevive a hot-reload en dev guardándose en globalThis (patrón estándar Next.js).
 */

// Compat con el SDK de InsForge (PostgREST): los timestamps llegan como string
// ISO, no como Date. Los schemas Zod y la UI del codebase dependen de eso.
types.setTypeParser(types.builtins.TIMESTAMPTZ, (v) => new Date(v).toISOString());
types.setTypeParser(types.builtins.TIMESTAMP, (v) => new Date(`${v}Z`).toISOString());
types.setTypeParser(types.builtins.DATE, (v) => v); // "YYYY-MM-DD" tal cual
// PostgREST serializa bigint/numeric como número JSON; pg los devuelve como
// string. Los schemas Zod del codebase esperan number (file_size_bytes,
// storage_quota_bytes, contract_amount, etc.).
types.setTypeParser(types.builtins.INT8, (v) => Number(v));
types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));

const globalForPg = globalThis as unknown as { __edificiaPgPool?: Pool };

export function getPool(): Pool {
  if (!globalForPg.__edificiaPgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Missing DATABASE_URL — requerida con DATA_BACKEND=postgres (ver .env.local.example)");
    }
    globalForPg.__edificiaPgPool = new Pool({ connectionString, max: 10 });
  }
  return globalForPg.__edificiaPgPool;
}
