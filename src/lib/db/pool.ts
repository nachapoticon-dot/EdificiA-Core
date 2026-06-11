import { Pool } from "pg";

/**
 * Pool singleton de PostgreSQL para el backend.
 * Sobrevive a hot-reload en dev guardándose en globalThis (patrón estándar Next.js).
 */
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
