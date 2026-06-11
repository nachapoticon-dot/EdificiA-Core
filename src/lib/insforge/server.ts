import { createClient } from "@insforge/sdk";
import { getPgAdminClient } from "@/lib/db/admin-client";
import type { AdminClient } from "@/lib/db/types";

const BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL;
const SERVICE_ROLE_KEY = process.env.INSFORGE_SERVICE_ROLE_KEY;

/**
 * Cliente admin para operaciones server-side. Nunca exponer al browser.
 *
 * Flag de transición DATA_BACKEND:
 * - "postgres" → capa de datos propia (Postgres local vía pg + storage filesystem).
 * - cualquier otro valor / ausente → SDK de InsForge (comportamiento legacy).
 *
 * El tipo de retorno es nuestro contrato propio (AdminClient): todos los
 * call-sites tipan con ReturnType<typeof getInsForgeAdminClient>, así que
 * compilan contra la superficie real usada, independiente del backend.
 */
export function getInsForgeAdminClient(): AdminClient {
  if (process.env.DATA_BACKEND === "postgres") {
    return getPgAdminClient();
  }

  if (!BASE_URL) throw new Error("Missing NEXT_PUBLIC_INSFORGE_URL — set it in .env.local");
  if (!SERVICE_ROLE_KEY) throw new Error("Missing INSFORGE_SERVICE_ROLE_KEY — set it in .env.local");

  return createClient({
    baseUrl: BASE_URL,
    anonKey: SERVICE_ROLE_KEY,
    isServerMode: true,
  }) as unknown as AdminClient;
}
