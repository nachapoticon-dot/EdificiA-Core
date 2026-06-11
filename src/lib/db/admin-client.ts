import { localGetProfile, localRefresh, localSignIn, localSignUp } from "@/lib/auth/local-auth";
import { getFsStorage } from "@/lib/storage/fs-adapter";
import { PgQueryBuilder } from "./query-builder";
import type { AdminClient } from "./types";

/**
 * Cliente admin local: misma forma que el SDK de InsForge, implementado sobre
 * Postgres propio (query-builder pg), auth local (JWT HS256 + refresh tokens)
 * y storage filesystem.
 */
export function getPgAdminClient(): AdminClient {
  return {
    database: {
      from: (table: string) => new PgQueryBuilder(table),
    },
    storage: getFsStorage(),
    auth: {
      signUp: (args) => localSignUp(args),
      signInWithPassword: (args) => localSignIn(args),
      getProfile: (userId) => localGetProfile(userId),
      refreshSession: ({ refreshToken }) => localRefresh(refreshToken),
    },
    getHttpClient: () => ({ getHeaders: () => ({}) }),
  };
}
