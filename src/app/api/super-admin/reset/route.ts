import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getQdrantClient, COLLECTION_NAME, EMBEDDING_DIM } from "@/lib/qdrant/client";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import {
  superAdminResetRequestSchema,
  superAdminResetResponseSchema,
} from "@/lib/validators/api-responses";

export const runtime = "nodejs";

type DbClient = ReturnType<typeof getInsForgeAdminClient>["database"];

function isAuthorized(req: Request): boolean {
  const secret = process.env.SUPER_ADMIN_KEY;
  if (!secret) return false;
  const auth = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  return auth === secret;
}

// Tablas globales — orden hoja → raíz para el scope "all"
const ALL_TABLES = [
  "audit_results",
  "chat_messages",
  "chat_snapshots",
  "app_error_events",
  "enterprise_sync_runs",
  "enterprise_documents",
  "enterprise_sources",
  "work_case_evidence",
  "work_case_events",
  "agent_runs",
  "document_intelligence_reports",
  "work_cases",
  "operational_findings",
  "obra_relations",
  "document_chunks",
  "project_schedule_tasks",
  "project_financial_snapshots",
  "project_subcontracts",
  "project_hse_records",
  "project_supply_items",
  "project_phase_docs",
  "company_learned_patterns",
  "price_indices",
  "industry_benchmarks",
  "audit_sessions",
  "chat_sessions",
  "uploaded_files",
  "projects",
  "organization_invitations",
  "org_founder_invitations",
  "organization_members",
  "organizations",
] as const;

async function deleteAll(db: DbClient, log: string[]): Promise<void> {
  for (const table of ALL_TABLES) {
    try {
      await (db.from(table) as unknown as { delete: () => { neq: (c: string, v: string) => Promise<unknown> } })
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      log.push(`✓ ${table}`);
    } catch (err) {
      log.push(`✗ ${table}: ${String(err)}`);
    }
  }
}

async function selectIds(
  db: DbClient,
  table: string,
  org: string,
): Promise<string[]> {
  const res = await (db.from(table) as unknown as {
    select: (cols: string) => { eq: (c: string, v: string) => Promise<{ data: unknown; error: unknown }> };
  })
    .select("id")
    .eq("organization_id", org);
  if (res.error || !Array.isArray(res.data)) return [];
  return (res.data as Array<{ id?: string }>)
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string");
}

async function deleteByOrg(db: DbClient, table: string, org: string, log: string[]): Promise<void> {
  try {
    await (db.from(table) as unknown as {
      delete: () => { eq: (c: string, v: string) => Promise<unknown> };
    })
      .delete()
      .eq("organization_id", org);
    log.push(`✓ ${table} (org)`);
  } catch (err) {
    log.push(`✗ ${table}: ${String(err)}`);
  }
}

async function deleteByIn(
  db: DbClient,
  table: string,
  col: string,
  ids: string[],
  log: string[],
): Promise<void> {
  if (ids.length === 0) {
    log.push(`◦ ${table}: sin filas`);
    return;
  }
  try {
    await (db.from(table) as unknown as {
      delete: () => { in: (c: string, v: string[]) => Promise<unknown> };
    })
      .delete()
      .in(col, ids);
    log.push(`✓ ${table} (${ids.length} por ${col})`);
  } catch (err) {
    log.push(`✗ ${table}: ${String(err)}`);
  }
}

async function resetOrganization(db: DbClient, organizationId: string, log: string[]): Promise<void> {
  // 1. Capturar IDs de tablas padre para tablas hijas que no tienen organization_id directo
  const chatSessionIds = await selectIds(db, "chat_sessions", organizationId);
  const auditSessionIds = await selectIds(db, "audit_sessions", organizationId);
  const projectIds = await selectIds(db, "projects", organizationId);

  // 2. Borrar hojas
  await deleteByIn(db, "chat_messages", "session_id", chatSessionIds, log);
  await deleteByIn(db, "chat_snapshots", "session_id", chatSessionIds, log);
  await deleteByIn(db, "audit_results", "session_id", auditSessionIds, log);
  await deleteByIn(db, "project_phase_docs", "project_id", projectIds, log);

  // 3. Borrar tablas con organization_id directo (preservando org/members/founder_invitations)
  await deleteByOrg(db, "enterprise_sync_runs", organizationId, log);
  await deleteByOrg(db, "app_error_events", organizationId, log);
  await deleteByOrg(db, "enterprise_documents", organizationId, log);
  await deleteByOrg(db, "enterprise_sources", organizationId, log);
  await deleteByOrg(db, "work_case_evidence", organizationId, log);
  await deleteByOrg(db, "work_case_events", organizationId, log);
  await deleteByOrg(db, "agent_runs", organizationId, log);
  await deleteByOrg(db, "document_intelligence_reports", organizationId, log);
  await deleteByOrg(db, "work_cases", organizationId, log);
  await deleteByOrg(db, "operational_findings", organizationId, log);
  await deleteByOrg(db, "obra_relations", organizationId, log);
  await deleteByOrg(db, "document_chunks", organizationId, log);
  await deleteByOrg(db, "project_schedule_tasks", organizationId, log);
  await deleteByOrg(db, "project_financial_snapshots", organizationId, log);
  await deleteByOrg(db, "project_subcontracts", organizationId, log);
  await deleteByOrg(db, "project_hse_records", organizationId, log);
  await deleteByOrg(db, "project_supply_items", organizationId, log);
  await deleteByOrg(db, "company_learned_patterns", organizationId, log);
  await deleteByOrg(db, "price_indices", organizationId, log);
  await deleteByOrg(db, "uploaded_files", organizationId, log);
  await deleteByOrg(db, "audit_sessions", organizationId, log);
  await deleteByOrg(db, "chat_sessions", organizationId, log);
  await deleteByOrg(db, "projects", organizationId, log);
  // organization_invitations: se mantienen para no perder el rastro de invitaciones pendientes
  // organization_members + organizations + org_founder_invitations: preservados
}

async function resetQdrantAll(log: string[]): Promise<void> {
  try {
    const qdrant = getQdrantClient();
    const { exists } = await qdrant.collectionExists(COLLECTION_NAME);
    if (exists) {
      await qdrant.deleteCollection(COLLECTION_NAME);
      log.push("✓ qdrant: colección eliminada");
    }
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
    });
    log.push("✓ qdrant: colección recreada");
  } catch (err) {
    log.push(`✗ qdrant: ${String(err)}`);
  }
}

async function resetQdrantOrg(organizationId: string, log: string[]): Promise<void> {
  try {
    const qdrant = getQdrantClient();
    const { exists } = await qdrant.collectionExists(COLLECTION_NAME);
    if (!exists) {
      log.push("◦ qdrant: colección inexistente, nada que limpiar");
      return;
    }
    await qdrant.delete(COLLECTION_NAME, {
      filter: { must: [{ key: "org_id", match: { value: organizationId } }] },
      wait: true,
    });
    log.push(`✓ qdrant: vectores de la org borrados`);
  } catch (err) {
    log.push(`✗ qdrant (org): ${String(err)}`);
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "super-admin-reset"), { limit: 6, windowMs: 3_600_000 })) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!isAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = superAdminResetRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = getInsForgeAdminClient().database;
  const log: string[] = [];

  if (parsed.data.scope === "all") {
    log.push("→ scope: TOTAL");
    await deleteAll(db, log);
    await resetQdrantAll(log);
    return Response.json(
      superAdminResetResponseSchema.parse({ ok: true, scope: "all", organizationId: null, log }),
    );
  }

  const { organizationId, confirmation } = parsed.data;

  // Validar que la confirmación coincida con el slug de la org (defensa adicional)
  const orgRes = await (db.from("organizations") as unknown as {
    select: (c: string) => {
      eq: (c: string, v: string) => {
        limit: (n: number) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  })
    .select("id, name, slug")
    .eq("id", organizationId)
    .limit(1);

  if (orgRes.error || !Array.isArray(orgRes.data) || orgRes.data.length === 0) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }
  const org = orgRes.data[0] as { id: string; name: string; slug?: string };
  const expectedTokens = [org.name?.trim(), (org as { slug?: string }).slug?.trim()].filter(
    (v): v is string => Boolean(v),
  );
  if (!expectedTokens.includes(confirmation.trim())) {
    return Response.json(
      {
        error: "Confirmation does not match organization name or slug",
        hint: `Esperado uno de: ${expectedTokens.join(" | ")}`,
      },
      { status: 400 },
    );
  }

  log.push(`→ scope: ORG · ${org.name} (${organizationId})`);
  await resetOrganization(db, organizationId, log);
  await resetQdrantOrg(organizationId, log);

  return Response.json(
    superAdminResetResponseSchema.parse({
      ok: true,
      scope: "organization",
      organizationId,
      log,
    }),
  );
}
