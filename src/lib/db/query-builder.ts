import { getPool } from "./pool";
import type { DbError, DbQueryBuilder, DbResult } from "./types";

/**
 * Query-builder compatible con la superficie del SDK de InsForge usada en el
 * codebase, compilado a SQL parametrizado sobre node-postgres.
 *
 * Contratos que replica (los call-sites dependen de ellos — ver types.ts):
 * - Nunca lanza por errores de DB: resuelve { data, error, count }.
 * - single(): 0 o >1 filas → error con code PGRST116, data null.
 * - maybeSingle(): 0 filas → data null sin error; >1 filas → error.
 * - select con { count: "exact", head: true } → solo count, data null.
 * - select embebido `rel(cols)` (PostgREST): se resuelve como subquery jsonb
 *   por convención FK `rel sin "s" final + "_id"` (ej. organizations → organization_id).
 */

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const TS_CONFIGS = new Set(["spanish", "english", "simple"]);

function qIdent(name: string): string {
  const trimmed = name.trim();
  if (!IDENT_RE.test(trimmed)) throw new Error(`Identificador SQL inválido: "${name}"`);
  return `"${trimmed}"`;
}

function toDbError(err: unknown): DbError {
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string; detail?: string };
    return { message: e.message ?? String(err), code: e.code, details: e.detail };
  }
  return { message: String(err) };
}

/** Cache de tipos de columna por tabla (udt_name) para serializar jsonb vs arrays nativos. */
const columnTypesCache = new Map<string, Promise<Map<string, string>>>();

function getColumnTypes(table: string): Promise<Map<string, string>> {
  let cached = columnTypesCache.get(table);
  if (!cached) {
    cached = getPool()
      .query(
        `SELECT column_name, udt_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [table],
      )
      .then((res) => new Map(res.rows.map((r) => [r.column_name as string, r.udt_name as string])));
    columnTypesCache.set(table, cached);
  }
  return cached;
}

/**
 * Serializa un valor JS según el tipo real de la columna destino:
 * - jsonb/json → JSON.stringify (objetos Y arrays; pg por defecto convertiría
 *   arrays JS a arrays de Postgres, que no son asignables a jsonb).
 * - tipos array nativos (udt con prefijo "_", ej. _text) → array JS tal cual.
 * - resto → passthrough (pg maneja Date, string, number, boolean).
 */
function encodeValue(value: unknown, udt: string | undefined): unknown {
  if (value === null || value === undefined) return null;
  if (udt === "jsonb" || udt === "json") return JSON.stringify(value);
  if (udt?.startsWith("_")) return value;
  if (typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

/** Divide la lista de columnas de un select por comas de primer nivel (respeta paréntesis). */
function splitColumns(spec: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of spec) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

type Filter =
  | { kind: "cmp"; op: "=" | "<>" | ">"; column: string; value: unknown }
  | { kind: "is"; column: string; value: null | boolean; negated: boolean }
  | { kind: "in"; column: string; values: readonly unknown[] }
  | { kind: "ilike"; column: string; pattern: string }
  | { kind: "or"; expression: string }
  | { kind: "textSearch"; column: string; query: string; config: string };

type Operation = "select" | "insert" | "update" | "upsert" | "delete";

export class PgQueryBuilder implements DbQueryBuilder {
  private op: Operation = "select";
  private columnsSpec = "*";
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private limitN: number | null = null;
  private rowMode: "many" | "single" | "maybeSingle" = "many";
  private countHead = false;
  private rows: Record<string, unknown>[] = [];
  private patch: Record<string, unknown> | null = null;
  private onConflict: string | null = null;
  private returningSpec: string | null = null;

  private readonly table: string;

  constructor(table: string) {
    qIdent(table);
    this.table = table;
  }

  select(columns = "*", opts?: { count?: "exact"; head?: boolean }): DbQueryBuilder {
    if (this.op === "select") {
      this.columnsSpec = columns;
      if (opts?.count === "exact" && opts.head) this.countHead = true;
    } else {
      // select() después de insert/update/upsert/delete = RETURNING
      this.returningSpec = columns;
    }
    return this;
  }

  insert(rows: Record<string, unknown> | Record<string, unknown>[]): DbQueryBuilder {
    this.op = "insert";
    this.rows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(patch: Record<string, unknown>): DbQueryBuilder {
    this.op = "update";
    this.patch = patch;
    return this;
  }

  upsert(
    rows: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string },
  ): DbQueryBuilder {
    this.op = "upsert";
    this.rows = Array.isArray(rows) ? rows : [rows];
    this.onConflict = opts?.onConflict ?? null;
    return this;
  }

  delete(): DbQueryBuilder {
    this.op = "delete";
    return this;
  }

  eq(column: string, value: unknown): DbQueryBuilder {
    this.filters.push({ kind: "cmp", op: "=", column, value });
    return this;
  }

  neq(column: string, value: unknown): DbQueryBuilder {
    this.filters.push({ kind: "cmp", op: "<>", column, value });
    return this;
  }

  gt(column: string, value: unknown): DbQueryBuilder {
    this.filters.push({ kind: "cmp", op: ">", column, value });
    return this;
  }

  is(column: string, value: null | boolean): DbQueryBuilder {
    this.filters.push({ kind: "is", column, value, negated: false });
    return this;
  }

  in(column: string, values: readonly unknown[]): DbQueryBuilder {
    this.filters.push({ kind: "in", column, values });
    return this;
  }

  ilike(column: string, pattern: string): DbQueryBuilder {
    this.filters.push({ kind: "ilike", column, pattern });
    return this;
  }

  not(column: string, operator: string, value: unknown): DbQueryBuilder {
    if (operator !== "is" || value !== null) {
      throw new Error(`not("${column}", "${operator}", ...) no soportado: solo not(col, "is", null)`);
    }
    this.filters.push({ kind: "is", column, value: null, negated: true });
    return this;
  }

  or(expression: string): DbQueryBuilder {
    this.filters.push({ kind: "or", expression });
    return this;
  }

  textSearch(column: string, query: string, opts?: { config?: string }): DbQueryBuilder {
    const config = opts?.config ?? "simple";
    if (!TS_CONFIGS.has(config)) throw new Error(`textSearch config no soportada: ${config}`);
    this.filters.push({ kind: "textSearch", column, query, config });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): DbQueryBuilder {
    this.orders.push({ column, ascending: opts?.ascending !== false });
    return this;
  }

  limit(n: number): DbQueryBuilder {
    this.limitN = n;
    return this;
  }

  single(): DbQueryBuilder {
    this.rowMode = "single";
    return this;
  }

  maybeSingle(): DbQueryBuilder {
    this.rowMode = "maybeSingle";
    return this;
  }

  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  // ── Compilación ──────────────────────────────────────────────────────────

  private compileWhere(params: unknown[]): string {
    if (this.filters.length === 0) return "";
    const clauses = this.filters.map((f) => {
      switch (f.kind) {
        case "cmp":
          params.push(f.value);
          return `${qIdent(f.column)} ${f.op} $${params.length}`;
        case "is": {
          const op = f.negated ? "IS NOT" : "IS";
          if (f.value === null) return `${qIdent(f.column)} ${op} NULL`;
          return `${qIdent(f.column)} ${op} ${f.value ? "TRUE" : "FALSE"}`;
        }
        case "in":
          if (f.values.length === 0) return "FALSE";
          params.push([...f.values]);
          return `${qIdent(f.column)} = ANY($${params.length})`;
        case "ilike":
          params.push(f.pattern);
          return `${qIdent(f.column)} ILIKE $${params.length}`;
        case "or":
          return this.compileOr(f.expression, params);
        case "textSearch":
          params.push(f.query);
          // config validada contra whitelist; va inline para que el planner use el índice GIN
          return `to_tsvector('${f.config}', ${qIdent(f.column)}) @@ to_tsquery('${f.config}', $${params.length})`;
      }
    });
    return ` WHERE ${clauses.join(" AND ")}`;
  }

  /** Mini-parser de expresiones or() estilo PostgREST: "col.eq.valor,col.is.null". */
  private compileOr(expression: string, params: unknown[]): string {
    const clauses = expression.split(",").map((part) => {
      const match = part.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.(eq|is)\.(.*)$/);
      if (!match || match[1] === undefined || match[3] === undefined) {
        throw new Error(`Expresión or() no soportada: "${part}"`);
      }
      const column = match[1];
      const op = match[2];
      const rawValue = match[3];
      if (op === "is") {
        if (rawValue !== "null") throw new Error(`or() solo soporta is.null: "${part}"`);
        return `${qIdent(column)} IS NULL`;
      }
      params.push(rawValue);
      return `${qIdent(column)} = $${params.length}`;
    });
    return `(${clauses.join(" OR ")})`;
  }

  private compileSelectColumns(spec: string): string {
    return splitColumns(spec)
      .map((col) => {
        if (col === "*") return "*";
        const embedded = col.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)$/);
        if (embedded && embedded[1] !== undefined && embedded[2] !== undefined) {
          const rel = embedded[1];
          const relColsSpec = embedded[2];
          const fkColumn = `${rel.replace(/s$/, "")}_id`;
          const relCols = splitColumns(relColsSpec).map(qIdent).join(", ");
          return (
            `(SELECT to_jsonb(_sub) FROM (SELECT ${relCols} FROM ${qIdent(rel)} ` +
            `WHERE ${qIdent(rel)}."id" = ${qIdent(this.table)}.${qIdent(fkColumn)} LIMIT 1) _sub) AS ${qIdent(rel)}`
          );
        }
        return qIdent(col);
      })
      .join(", ");
  }

  private async compileWrite(params: unknown[]): Promise<string> {
    const types = await getColumnTypes(this.table);
    const tbl = qIdent(this.table);

    if (this.op === "update") {
      const patch = this.patch ?? {};
      const sets = Object.entries(patch)
        .filter(([, v]) => v !== undefined)
        .map(([col, value]) => {
          params.push(encodeValue(value, types.get(col)));
          return `${qIdent(col)} = $${params.length}`;
        });
      if (sets.length === 0) throw new Error("update() sin columnas");
      let sql = `UPDATE ${tbl} SET ${sets.join(", ")}${this.compileWhere(params)}`;
      if (this.returningSpec) sql += ` RETURNING ${this.compileSelectColumns(this.returningSpec)}`;
      return sql;
    }

    if (this.op === "delete") {
      let sql = `DELETE FROM ${tbl}${this.compileWhere(params)}`;
      if (this.returningSpec) sql += ` RETURNING ${this.compileSelectColumns(this.returningSpec)}`;
      return sql;
    }

    // insert / upsert — asume filas homogéneas (cierto en todo el codebase)
    const firstRow = this.rows[0];
    if (!firstRow) throw new Error(`${this.op}() sin filas`);
    const columns = Object.keys(firstRow).filter((c) => firstRow[c] !== undefined);
    const tuples = this.rows.map((row) => {
      const placeholders = columns.map((col) => {
        params.push(encodeValue(row[col], types.get(col)));
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    let sql = `INSERT INTO ${tbl} (${columns.map(qIdent).join(", ")}) VALUES ${tuples.join(", ")}`;

    if (this.op === "upsert") {
      const conflictCols = (this.onConflict ?? "").split(",").map((c) => c.trim()).filter(Boolean);
      if (conflictCols.length === 0) throw new Error("upsert() requiere onConflict");
      const updatable = columns.filter((c) => !conflictCols.includes(c));
      sql += ` ON CONFLICT (${conflictCols.map(qIdent).join(", ")})`;
      sql += updatable.length === 0
        ? " DO NOTHING"
        : ` DO UPDATE SET ${updatable.map((c) => `${qIdent(c)} = EXCLUDED.${qIdent(c)}`).join(", ")}`;
    }

    if (this.returningSpec) sql += ` RETURNING ${this.compileSelectColumns(this.returningSpec)}`;
    return sql;
  }

  /** Expuesto para tests: compila sin ejecutar. */
  async compile(): Promise<{ text: string; params: unknown[] }> {
    const params: unknown[] = [];
    if (this.op !== "select") {
      return { text: await this.compileWrite(params), params };
    }
    if (this.countHead) {
      return {
        text: `SELECT count(*)::int AS count FROM ${qIdent(this.table)}${this.compileWhere(params)}`,
        params,
      };
    }
    let sql = `SELECT ${this.compileSelectColumns(this.columnsSpec)} FROM ${qIdent(this.table)}`;
    sql += this.compileWhere(params);
    if (this.orders.length > 0) {
      sql += ` ORDER BY ${this.orders.map((o) => `${qIdent(o.column)} ${o.ascending ? "ASC" : "DESC"}`).join(", ")}`;
    }
    if (this.rowMode !== "many" && this.limitN === null) {
      // single/maybeSingle necesitan detectar ">1 fila": traemos hasta 2
      sql += " LIMIT 2";
    } else if (this.limitN !== null) {
      sql += ` LIMIT ${Math.max(0, Math.floor(this.limitN))}`;
    }
    return { text: sql, params };
  }

  private async execute(): Promise<DbResult> {
    try {
      const { text, params } = await this.compile();
      const result = await getPool().query(text, params);

      if (this.countHead) {
        return { data: null, error: null, count: (result.rows[0]?.count as number) ?? 0 };
      }

      const hasRows =
        this.op === "select" || this.returningSpec !== null;
      const rows = hasRows ? result.rows : null;

      if (this.rowMode === "single") {
        if (!rows || rows.length !== 1) {
          return {
            data: null,
            error: {
              message: `JSON object requested, multiple (or no) rows returned (${rows?.length ?? 0} rows)`,
              code: "PGRST116",
            },
            count: null,
          };
        }
        return { data: rows[0], error: null, count: null };
      }

      if (this.rowMode === "maybeSingle") {
        if (rows && rows.length > 1) {
          return {
            data: null,
            error: { message: "JSON object requested, multiple rows returned", code: "PGRST116" },
            count: null,
          };
        }
        return { data: rows?.[0] ?? null, error: null, count: null };
      }

      return { data: rows, error: null, count: null };
    } catch (err) {
      return { data: null, error: toDbError(err), count: null };
    }
  }
}
