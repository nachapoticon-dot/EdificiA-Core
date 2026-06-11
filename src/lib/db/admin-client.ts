import { getFsStorage } from "@/lib/storage/fs-adapter";
import { PgQueryBuilder } from "./query-builder";
import type { AdminClient } from "./types";

/**
 * Cliente admin local: misma forma que el SDK de InsForge, implementado sobre
 * Postgres propio (query-builder pg) y filesystem (storage adapter).
 *
 * `auth` queda stubeado hasta la Fase 2 (auth local con JWT propio): con
 * DATA_BACKEND=postgres los flujos de login/registro todavía no deben usarse.
 */

function authNotImplemented(method: string): never {
  throw new Error(
    `auth.${method} no disponible con DATA_BACKEND=postgres todavía — la auth local llega en la Fase 2 del plan de desconexión.`,
  );
}

export function getPgAdminClient(): AdminClient {
  return {
    database: {
      from: (table: string) => new PgQueryBuilder(table),
    },
    storage: getFsStorage(),
    auth: {
      signUp: async () => authNotImplemented("signUp"),
      signInWithPassword: async () => authNotImplemented("signInWithPassword"),
      getProfile: async () => authNotImplemented("getProfile"),
      refreshSession: async () => authNotImplemented("refreshSession"),
    },
    getHttpClient: () => ({ getHeaders: () => ({}) }),
  };
}
