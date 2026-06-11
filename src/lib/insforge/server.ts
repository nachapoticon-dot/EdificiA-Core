import { getPgAdminClient } from "@/lib/db/admin-client";
import type { AdminClient } from "@/lib/db/types";

/**
 * Cliente admin para operaciones server-side. Nunca exponer al browser.
 *
 * Desde la desconexión de InsForge (2026-06) esto es un re-export de la capa
 * de datos propia: Postgres (src/lib/db) + auth local (src/lib/auth) + storage
 * filesystem (src/lib/storage). El path src/lib/insforge se conserva para no
 * tocar ~100 imports; el nombre es histórico.
 */
export function getInsForgeAdminClient(): AdminClient {
  return getPgAdminClient();
}
