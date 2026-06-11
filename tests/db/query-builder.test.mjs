import test from "node:test";
import assert from "node:assert/strict";
import { PgQueryBuilder } from "../../src/lib/db/query-builder.ts";
import { getPool } from "../../src/lib/db/pool.ts";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://edificia:edificia_dev@localhost:5432/edificia";

// ── Unit: compilación de selects (no toca la DB) ──────────────────────────

test("select compila filtros eq/is/order/limit con params posicionales", async () => {
  const qb = new PgQueryBuilder("projects")
    .select("id, name")
    .eq("organization_id", "org-1")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(10);
  const { text, params } = await qb.compile();
  assert.equal(
    text,
    'SELECT "id", "name" FROM "projects" WHERE "organization_id" = $1 AND "deleted_at" IS NULL ORDER BY "updated_at" DESC LIMIT 10',
  );
  assert.deepEqual(params, ["org-1"]);
});

test("or() estilo PostgREST compila eq y is.null", async () => {
  const qb = new PgQueryBuilder("price_indices")
    .select("*")
    .or("organization_id.eq.abc,organization_id.is.null");
  const { text, params } = await qb.compile();
  assert.match(text, /\("organization_id" = \$1 OR "organization_id" IS NULL\)/);
  assert.deepEqual(params, ["abc"]);
});

test("in() con lista vacía compila a FALSE (sin SQL inválido)", async () => {
  const { text } = await new PgQueryBuilder("uploaded_files").select("id").in("id", []).compile();
  assert.match(text, /WHERE FALSE/);
});

test("textSearch compila a to_tsvector/to_tsquery con config validada", async () => {
  const qb = new PgQueryBuilder("document_chunks")
    .select("chunk_text")
    .textSearch("chunk_text", "hormigon:* & curado:*", { config: "spanish" });
  const { text, params } = await qb.compile();
  assert.match(text, /to_tsvector\('spanish', "chunk_text"\) @@ to_tsquery\('spanish', \$1\)/);
  assert.deepEqual(params, ["hormigon:* & curado:*"]);
});

test("not(col, is, null) compila a IS NOT NULL; otros operadores rechazan", async () => {
  const { text } = await new PgQueryBuilder("document_chunks")
    .select("id")
    .not("qdrant_id", "is", null)
    .compile();
  assert.match(text, /"qdrant_id" IS NOT NULL/);
  assert.throws(() => new PgQueryBuilder("t").select("id").not("a", "eq", 1));
});

test("select embebido rel(cols) compila subquery jsonb por convención FK", async () => {
  const { text } = await new PgQueryBuilder("organization_members")
    .select("organization_id, role, organizations(name)")
    .compile();
  assert.match(text, /SELECT to_jsonb\(_sub\)/);
  assert.match(text, /"organizations"\."id" = "organization_members"\."organization_id"/);
  assert.match(text, /AS "organizations"/);
});

test("count exact head compila a SELECT count(*)", async () => {
  const { text } = await new PgQueryBuilder("projects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", "x")
    .compile();
  assert.equal(text, 'SELECT count(*)::int AS count FROM "projects" WHERE "organization_id" = $1');
});

test("identificadores inválidos rechazan al compilar (inyección por nombre de columna)", async () => {
  const qb = new PgQueryBuilder("projects").select("id").eq('a"; DROP TABLE x;--', 1);
  await assert.rejects(qb.compile(), /Identificador SQL inválido/);
});

// ── Integración contra Postgres local (skip si no está disponible) ────────

const pool = getPool();
let dbAvailable = false;
try {
  await pool.query("SELECT 1");
  dbAvailable = true;
} catch {
  // sin Postgres local: los tests de integración se saltean
}

test("integración: contratos del builder contra Postgres real", { skip: !dbAvailable }, async (t) => {
  const table = "test_qb_scratch";
  await pool.query(`DROP TABLE IF EXISTS ${table}`);
  await pool.query(`
    CREATE TABLE ${table} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org TEXT NOT NULL,
      label TEXT,
      payload JSONB,
      tags TEXT[],
      n INT,
      UNIQUE (org, label)
    )
  `);
  t.after(async () => {
    await pool.query(`DROP TABLE IF EXISTS ${table}`);
  });

  // insert().select().single() = RETURNING
  const inserted = await new PgQueryBuilder(table)
    .insert({ org: "o1", label: "a", payload: { total: 10, items: [1, 2] }, tags: ["x", "y"], n: 1 })
    .select("id, payload, tags")
    .single();
  assert.equal(inserted.error, null);
  assert.ok(inserted.data.id);
  assert.deepEqual(inserted.data.payload, { total: 10, items: [1, 2] }); // objeto a jsonb
  assert.deepEqual(inserted.data.tags, ["x", "y"]); // array nativo text[]

  // arrays JS a columnas jsonb (el caso que rompe con pg default)
  const arrJson = await new PgQueryBuilder(table)
    .insert({ org: "o1", label: "arr", payload: [{ a: 1 }, { b: 2 }] })
    .select("payload")
    .single();
  assert.equal(arrJson.error, null);
  assert.deepEqual(arrJson.data.payload, [{ a: 1 }, { b: 2 }]);

  // maybeSingle con 0 filas: data null SIN error
  const none = await new PgQueryBuilder(table).select("*").eq("org", "nadie").maybeSingle();
  assert.equal(none.error, null);
  assert.equal(none.data, null);

  // single con 0 filas: error PGRST116
  const noneSingle = await new PgQueryBuilder(table).select("*").eq("org", "nadie").single();
  assert.equal(noneSingle.data, null);
  assert.equal(noneSingle.error?.code, "PGRST116");

  // upsert con onConflict actualiza
  const up1 = await new PgQueryBuilder(table).upsert(
    { org: "o1", label: "a", n: 99 },
    { onConflict: "org,label" },
  );
  assert.equal(up1.error, null);
  const after = await new PgQueryBuilder(table).select("n").eq("org", "o1").eq("label", "a").single();
  assert.equal(after.data.n, 99);

  // count exact head
  const counted = await new PgQueryBuilder(table).select("id", { count: "exact", head: true }).eq("org", "o1");
  assert.equal(counted.count, 2);

  // update().eq() sin select: error null, data null
  const upd = await new PgQueryBuilder(table).update({ n: 5 }).eq("label", "arr");
  assert.equal(upd.error, null);
  assert.equal(upd.data, null);

  // delete().eq()
  const del = await new PgQueryBuilder(table).delete().eq("label", "arr");
  assert.equal(del.error, null);
  const remaining = await new PgQueryBuilder(table).select("id", { count: "exact", head: true });
  assert.equal(remaining.count, 1);

  // error de DB NO lanza: resuelve { error }
  const bad = await new PgQueryBuilder("tabla_que_no_existe").select("*");
  assert.equal(bad.data, null);
  assert.ok(bad.error?.message.includes("tabla_que_no_existe"));
});

test("integración: select embebido organizations(name) devuelve objeto anidado", { skip: !dbAvailable }, async (t) => {
  const org = await new PgQueryBuilder("organizations")
    .insert({ name: "Constructora QB Test", slug: `qb-test-${Date.now()}` })
    .select("id")
    .single();
  assert.equal(org.error, null);
  const orgId = org.data.id;
  const userId = "00000000-0000-4000-8000-000000000001";
  t.after(async () => {
    await pool.query("DELETE FROM organization_members WHERE organization_id = $1", [orgId]);
    await pool.query("DELETE FROM organizations WHERE id = $1", [orgId]);
  });

  const member = await new PgQueryBuilder("organization_members")
    .insert({ organization_id: orgId, user_id: userId, role: "admin", email: "qb@test.local" });
  assert.equal(member.error, null);

  const rows = await new PgQueryBuilder("organization_members")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", userId);
  assert.equal(rows.error, null);
  assert.equal(rows.data.length, 1);
  assert.deepEqual(rows.data[0].organizations, { name: "Constructora QB Test" });
});
