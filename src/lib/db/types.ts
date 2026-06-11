/**
 * Contratos de la capa de datos propia (reemplazo de @insforge/sdk).
 *
 * `AdminClient` replica exactamente la superficie del SDK de InsForge que el
 * codebase consume (verificada por grep el 2026-06-10): nada más, nada menos.
 * Todos los call-sites tipan con `ReturnType<typeof getInsForgeAdminClient>`,
 * así que este es el contrato único contra el que compila la app.
 *
 * Semántica heredada del SDK (los call-sites dependen de ella):
 * - Las queries NUNCA lanzan por errores de DB: resuelven `{ data, error }`.
 * - `single()` con 0 filas → `{ data: null, error: { code: "PGRST116" } }`.
 * - `maybeSingle()` con 0 filas → `{ data: null, error: null }`.
 */

export interface DbError {
  message: string;
  code?: string;
  details?: string;
}

// `data` es `any` deliberadamente: replica el tipado laxo del SDK de InsForge;
// los call-sites existentes castean el shape concreto con `as`.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DbResult<T = any> {
  data: T | null;
  error: DbError | null;
  count: number | null;
}

export interface DbQueryBuilder extends PromiseLike<DbResult> {
  select(columns?: string, opts?: { count?: "exact"; head?: boolean }): DbQueryBuilder;
  insert(rows: Record<string, unknown> | Record<string, unknown>[]): DbQueryBuilder;
  update(patch: Record<string, unknown>): DbQueryBuilder;
  upsert(
    rows: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string },
  ): DbQueryBuilder;
  delete(): DbQueryBuilder;
  eq(column: string, value: unknown): DbQueryBuilder;
  neq(column: string, value: unknown): DbQueryBuilder;
  gt(column: string, value: unknown): DbQueryBuilder;
  is(column: string, value: null | boolean): DbQueryBuilder;
  in(column: string, values: readonly unknown[]): DbQueryBuilder;
  ilike(column: string, pattern: string): DbQueryBuilder;
  not(column: string, operator: string, value: unknown): DbQueryBuilder;
  or(expression: string): DbQueryBuilder;
  textSearch(column: string, query: string, opts?: { config?: string }): DbQueryBuilder;
  order(column: string, opts?: { ascending?: boolean }): DbQueryBuilder;
  limit(n: number): DbQueryBuilder;
  single(): DbQueryBuilder;
  maybeSingle(): DbQueryBuilder;
}

export interface StorageBucket {
  upload(key: string, blob: Blob): Promise<{ data: { key: string } | null; error: DbError | null }>;
  download(path: string): Promise<{ data: Blob | null; error: DbError | null }>;
  remove(paths: string[]): Promise<{ data: unknown; error: DbError | null }>;
}

export interface AdminAuth {
  signUp(args: {
    email: string;
    password: string;
    name?: string;
    autoConfirm?: boolean;
  }): Promise<{ data: any; error: DbError | null }>;
  signInWithPassword(args: {
    email: string;
    password: string;
  }): Promise<{ data: any; error: DbError | null }>;
  getProfile(userId: string): Promise<{ data: any; error: DbError | null }>;
  refreshSession(args: { refreshToken: string }): Promise<{ data: any; error: DbError | null }>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface AdminClient {
  database: { from(table: string): DbQueryBuilder };
  storage: { from(bucket: string): StorageBucket };
  auth: AdminAuth;
}
