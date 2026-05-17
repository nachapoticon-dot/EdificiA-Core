import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { writeAuditLogEvent } from "@/lib/audit/audit-log";
import { dbLogger } from "@/lib/logger";
import { computeSupplyStatus } from "../supplies/supply-status";
import type {
  ProjectFinancialSnapshotSource,
  ProjectHseRecordStatus,
  ProjectHseRecordType,
  ProjectSupplyItemStatus,
} from "@/types";

export { computeSupplyStatus };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface BaseWriteCtx {
  organizationId: string;
  projectId: string;
  actorUserId?: string | null;
}

// ──────────────────────────────────────────────────────────────────────────
// 1 · Financial snapshots
// ──────────────────────────────────────────────────────────────────────────

export interface RegisterFinancialSnapshotInput extends BaseWriteCtx {
  snapshotDate: string;
  plannedAmount?: number | null;
  actualAmount?: number | null;
  committedAmount?: number | null;
  invoicedAmount?: number | null;
  paidAmount?: number | null;
  currency?: string;
  source?: ProjectFinancialSnapshotSource;
  note?: string;
}

export interface FinancialSnapshotResult {
  ok: boolean;
  reason?: string;
  message: string;
  snapshotId?: string;
  mode?: "created" | "updated";
}

export async function registerFinancialSnapshot(input: RegisterFinancialSnapshotInput): Promise<FinancialSnapshotResult> {
  if (!ISO_DATE.test(input.snapshotDate)) {
    return { ok: false, reason: "invalid_date", message: `snapshotDate "${input.snapshotDate}" no respeta YYYY-MM-DD.` };
  }
  const numbers = [input.plannedAmount, input.actualAmount, input.committedAmount, input.invoicedAmount, input.paidAmount];
  if (numbers.every((value) => value == null)) {
    return { ok: false, reason: "no_data", message: "Debe especificarse al menos un monto (planned / actual / committed / invoiced / paid)." };
  }

  const client = getInsForgeAdminClient();
  const existing = await client.database
    .from("project_financial_snapshots")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("project_id", input.projectId)
    .eq("snapshot_date", input.snapshotDate)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    snapshot_date: input.snapshotDate,
    planned_amount: input.plannedAmount ?? null,
    actual_amount: input.actualAmount ?? null,
    committed_amount: input.committedAmount ?? null,
    invoiced_amount: input.invoicedAmount ?? null,
    paid_amount: input.paidAmount ?? null,
    currency: input.currency ?? "ARS",
    source: input.source ?? "agent",
    metadata: input.note ? { note: input.note } : {},
    updated_at: new Date().toISOString(),
  };

  if (existing.data?.id) {
    const update = await client.database
      .from("project_financial_snapshots")
      .update(payload)
      .eq("id", existing.data.id);
    if (update.error) {
      dbLogger.warn({ err: update.error }, "register_financial_snapshot update failed");
      return { ok: false, reason: "db_error", message: update.error.message ?? "No se pudo actualizar el snapshot." };
    }
    await writeAuditLogEvent({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId ?? null,
      eventType: "financial.snapshot_updated",
      entityType: "project_financial_snapshot",
      entityId: existing.data.id,
      severity: "info",
      payload,
    });
    return {
      ok: true,
      snapshotId: existing.data.id,
      mode: "updated",
      message: `Snapshot del ${input.snapshotDate} actualizado.`,
    };
  }

  const insert = await client.database
    .from("project_financial_snapshots")
    .insert({
      organization_id: input.organizationId,
      project_id: input.projectId,
      ...payload,
      created_by: input.actorUserId ?? null,
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    dbLogger.warn({ err: insert.error }, "register_financial_snapshot insert failed");
    return { ok: false, reason: "db_error", message: insert.error?.message ?? "No se pudo registrar el snapshot." };
  }

  const newId = (insert.data as { id: string }).id;
  await writeAuditLogEvent({
    organizationId: input.organizationId,
    projectId: input.projectId,
    actorUserId: input.actorUserId ?? null,
    eventType: "financial.snapshot_registered",
    entityType: "project_financial_snapshot",
    entityId: newId,
    severity: "info",
    payload,
  });

  return { ok: true, snapshotId: newId, mode: "created", message: `Snapshot del ${input.snapshotDate} registrado.` };
}

// ──────────────────────────────────────────────────────────────────────────
// 2 · HSE records
// ──────────────────────────────────────────────────────────────────────────

export interface RegisterHseRecordInput extends BaseWriteCtx {
  recordType: ProjectHseRecordType;
  status?: ProjectHseRecordStatus;
  subjectName?: string | null;
  workerIdentifier?: string | null;
  subcontractorName?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  note?: string;
}

export interface HseRecordResult {
  ok: boolean;
  reason?: string;
  message: string;
  recordId?: string;
  computedStatus?: ProjectHseRecordStatus;
}

export async function registerHseRecord(input: RegisterHseRecordInput): Promise<HseRecordResult> {
  if (!input.subjectName && !input.workerIdentifier && !input.subcontractorName) {
    return { ok: false, reason: "missing_subject", message: "Indicá subjectName, workerIdentifier o subcontractorName." };
  }
  if (input.issuedAt && !ISO_DATE.test(input.issuedAt)) {
    return { ok: false, reason: "invalid_date", message: `issuedAt "${input.issuedAt}" no respeta YYYY-MM-DD.` };
  }
  if (input.expiresAt && !ISO_DATE.test(input.expiresAt)) {
    return { ok: false, reason: "invalid_date", message: `expiresAt "${input.expiresAt}" no respeta YYYY-MM-DD.` };
  }

  const computedStatus: ProjectHseRecordStatus = input.status ?? computeHseStatus(input.expiresAt);

  const client = getInsForgeAdminClient();
  const insert = await client.database
    .from("project_hse_records")
    .insert({
      organization_id: input.organizationId,
      project_id: input.projectId,
      subject_name: input.subjectName ?? null,
      worker_identifier: input.workerIdentifier ?? null,
      subcontractor_name: input.subcontractorName ?? null,
      record_type: input.recordType,
      status: computedStatus,
      issued_at: input.issuedAt ?? null,
      expires_at: input.expiresAt ?? null,
      metadata: input.note ? { note: input.note } : {},
      created_by: input.actorUserId ?? null,
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    dbLogger.warn({ err: insert.error }, "register_hse_record insert failed");
    return { ok: false, reason: "db_error", message: insert.error?.message ?? "No se pudo registrar el registro HSE." };
  }

  const recordId = (insert.data as { id: string }).id;
  await writeAuditLogEvent({
    organizationId: input.organizationId,
    projectId: input.projectId,
    actorUserId: input.actorUserId ?? null,
    eventType: "hse.record_registered",
    entityType: "project_hse_record",
    entityId: recordId,
    severity: computedStatus === "incident" ? "warning" : "info",
    payload: {
      recordType: input.recordType,
      status: computedStatus,
      subjectName: input.subjectName,
      subcontractorName: input.subcontractorName,
      expiresAt: input.expiresAt,
    },
  });

  return {
    ok: true,
    recordId,
    computedStatus,
    message: `Registro HSE ${input.recordType} para "${input.subjectName ?? input.subcontractorName ?? input.workerIdentifier}" creado (${computedStatus}).`,
  };
}

function computeHseStatus(expiresAt?: string | null): ProjectHseRecordStatus {
  if (!expiresAt || !ISO_DATE.test(expiresAt)) return "valid";
  const expiry = new Date(`${expiresAt}T00:00:00.000Z`);
  if (Number.isNaN(expiry.getTime())) return "valid";
  const today = startOfUtcDay(new Date());
  const days = Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 14) return "expiring";
  return "valid";
}

// ──────────────────────────────────────────────────────────────────────────
// 3 · Supply items (acopios)
// ──────────────────────────────────────────────────────────────────────────

export interface RegisterSupplyInput extends BaseWriteCtx {
  mode: "create" | "update";
  itemName: string;
  category?: string | null;
  unit?: string | null;
  requiredQuantity?: number | null;
  orderedQuantity?: number | null;
  receivedQuantity?: number | null;
  unitCost?: number | null;
  currency?: string;
  supplierName?: string | null;
  requiredBy?: string | null;
  status?: ProjectSupplyItemStatus;
  note?: string;
}

export interface SupplyResult {
  ok: boolean;
  reason?: string;
  message: string;
  itemId?: string;
  mode?: "created" | "updated";
  computedStatus?: ProjectSupplyItemStatus;
}

export async function registerSupplyItem(input: RegisterSupplyInput): Promise<SupplyResult> {
  if (!input.itemName.trim()) {
    return { ok: false, reason: "missing_name", message: "Especificá itemName." };
  }
  if (input.requiredBy && !ISO_DATE.test(input.requiredBy)) {
    return { ok: false, reason: "invalid_date", message: `requiredBy "${input.requiredBy}" no respeta YYYY-MM-DD.` };
  }

  const client = getInsForgeAdminClient();
  const itemName = input.itemName.trim();

  const existing = await client.database
    .from("project_supply_items")
    .select("id, required_quantity, ordered_quantity, received_quantity, status")
    .eq("organization_id", input.organizationId)
    .eq("project_id", input.projectId)
    .ilike("item_name", itemName)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  const wantsCreate = input.mode === "create";

  if (wantsCreate && existing.data) {
    return {
      ok: false,
      reason: "duplicate",
      itemId: existing.data.id,
      message: `Ya existe un acopio "${itemName}" en esta obra. Usá mode="update" para modificarlo.`,
    };
  }

  if (!wantsCreate && !existing.data) {
    return {
      ok: false,
      reason: "not_found",
      message: `No existe un acopio "${itemName}" para actualizar. Usá mode="create" si querés crearlo.`,
    };
  }

  if (wantsCreate) {
    const computedStatus = input.status ?? computeSupplyStatus({
      required: input.requiredQuantity,
      ordered: input.orderedQuantity,
      received: input.receivedQuantity,
    });

    const insert = await client.database
      .from("project_supply_items")
      .insert({
        organization_id: input.organizationId,
        project_id: input.projectId,
        item_name: itemName,
        category: input.category ?? null,
        unit: input.unit ?? null,
        required_quantity: input.requiredQuantity ?? null,
        ordered_quantity: input.orderedQuantity ?? null,
        received_quantity: input.receivedQuantity ?? null,
        unit_cost: input.unitCost ?? null,
        currency: input.currency ?? "ARS",
        supplier_name: input.supplierName ?? null,
        required_by: input.requiredBy ?? null,
        status: computedStatus,
        metadata: input.note ? { note: input.note } : {},
        created_by: input.actorUserId ?? null,
      })
      .select("id")
      .single();

    if (insert.error || !insert.data) {
      dbLogger.warn({ err: insert.error }, "register_supply_item insert failed");
      return { ok: false, reason: "db_error", message: insert.error?.message ?? "No se pudo registrar el acopio." };
    }
    const itemId = (insert.data as { id: string }).id;
    await writeAuditLogEvent({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId ?? null,
      eventType: "supply.item_registered",
      entityType: "project_supply_item",
      entityId: itemId,
      severity: "info",
      payload: { itemName, status: computedStatus, requiredBy: input.requiredBy },
    });
    return { ok: true, itemId, mode: "created", computedStatus, message: `Acopio "${itemName}" creado.` };
  }

  const target = existing.data!;
  const newRequired = input.requiredQuantity ?? toNumber(target.required_quantity);
  const newOrdered = input.orderedQuantity ?? toNumber(target.ordered_quantity);
  const newReceived = input.receivedQuantity ?? toNumber(target.received_quantity);
  const computedStatus = input.status ?? computeSupplyStatus({
    required: newRequired,
    ordered: newOrdered,
    received: newReceived,
  });

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    status: computedStatus,
  };
  if (input.category !== undefined) patch.category = input.category;
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.requiredQuantity !== undefined) patch.required_quantity = input.requiredQuantity;
  if (input.orderedQuantity !== undefined) patch.ordered_quantity = input.orderedQuantity;
  if (input.receivedQuantity !== undefined) patch.received_quantity = input.receivedQuantity;
  if (input.unitCost !== undefined) patch.unit_cost = input.unitCost;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.supplierName !== undefined) patch.supplier_name = input.supplierName;
  if (input.requiredBy !== undefined) patch.required_by = input.requiredBy;

  const update = await client.database
    .from("project_supply_items")
    .update(patch)
    .eq("id", target.id);

  if (update.error) {
    dbLogger.warn({ err: update.error }, "register_supply_item update failed");
    return { ok: false, reason: "db_error", message: update.error.message ?? "No se pudo actualizar el acopio." };
  }

  await writeAuditLogEvent({
    organizationId: input.organizationId,
    projectId: input.projectId,
    actorUserId: input.actorUserId ?? null,
    eventType: "supply.item_updated",
    entityType: "project_supply_item",
    entityId: target.id,
    severity: computedStatus === "delayed" ? "warning" : "info",
    payload: { itemName, previousStatus: target.status, newStatus: computedStatus, patch: Object.keys(patch) },
  });

  return {
    ok: true,
    itemId: target.id,
    mode: "updated",
    computedStatus,
    message: `Acopio "${itemName}" actualizado (status ${computedStatus}).`,
  };
}


// ──────────────────────────────────────────────────────────────────────────
// 4 · Resolve obra_relations
// ──────────────────────────────────────────────────────────────────────────

export type ResolveAction = "confirm" | "dismiss" | "supersede";

export interface ResolveRelationInput {
  organizationId: string;
  relationId: string;
  action: ResolveAction;
  rationale?: string;
  actorUserId?: string | null;
}

export interface ResolveRelationResult {
  ok: boolean;
  reason?: string;
  message: string;
  action?: ResolveAction;
  relationId?: string;
}

export async function resolveObraRelation(input: ResolveRelationInput): Promise<ResolveRelationResult> {
  const client = getInsForgeAdminClient();
  const lookup = await client.database
    .from("obra_relations")
    .select("id, organization_id, project_id, source_file_id, target_file_id, relation_type, metadata, detected_by")
    .eq("id", input.relationId)
    .eq("organization_id", input.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (lookup.error || !lookup.data) {
    return { ok: false, reason: "not_found", message: "No se encontró la relación o no pertenece a esta organización." };
  }

  const row = lookup.data as {
    id: string;
    project_id: string | null;
    source_file_id: string;
    target_file_id: string;
    relation_type: string;
    metadata: Record<string, unknown> | null;
    detected_by: string;
  };

  if (input.action === "dismiss") {
    const update = await client.database
      .from("obra_relations")
      .update({
        deleted_at: new Date().toISOString(),
        metadata: {
          ...(row.metadata ?? {}),
          resolution: "dismissed",
          rationale: input.rationale ?? null,
          resolvedAt: new Date().toISOString(),
        },
      })
      .eq("id", row.id);
    if (update.error) return { ok: false, reason: "db_error", message: update.error.message ?? "No se pudo descartar." };

    await logResolution(row, input, "obra_relation.dismissed");
    return { ok: true, action: "dismiss", relationId: row.id, message: "Relación descartada." };
  }

  if (input.action === "confirm") {
    const update = await client.database
      .from("obra_relations")
      .update({
        detected_by: "user",
        confidence: 1,
        metadata: {
          ...(row.metadata ?? {}),
          resolution: "confirmed",
          rationale: input.rationale ?? null,
          resolvedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (update.error) return { ok: false, reason: "db_error", message: update.error.message ?? "No se pudo confirmar." };

    await logResolution(row, input, "obra_relation.confirmed");
    return { ok: true, action: "confirm", relationId: row.id, message: "Relación confirmada por el usuario." };
  }

  // supersede: el target supersede al source, así que registramos una relación
  // 'supersedes' y descartamos la original.
  const supersede = await client.database
    .from("obra_relations")
    .insert({
      organization_id: input.organizationId,
      project_id: row.project_id,
      source_file_id: row.target_file_id,
      target_file_id: row.source_file_id,
      relation_type: "supersedes",
      detected_by: "user",
      confidence: 1,
      evidence: { originatingRelationId: row.id, rationale: input.rationale ?? null },
      created_by: input.actorUserId ?? null,
    })
    .select("id")
    .single();

  if (supersede.error || !supersede.data) {
    return { ok: false, reason: "db_error", message: supersede.error?.message ?? "No se pudo registrar supersede." };
  }

  await client.database
    .from("obra_relations")
    .update({
      deleted_at: new Date().toISOString(),
      metadata: {
        ...(row.metadata ?? {}),
        resolution: "superseded",
        supersededByRelationId: (supersede.data as { id: string }).id,
        rationale: input.rationale ?? null,
        resolvedAt: new Date().toISOString(),
      },
    })
    .eq("id", row.id);

  await logResolution(row, input, "obra_relation.superseded");
  return {
    ok: true,
    action: "supersede",
    relationId: (supersede.data as { id: string }).id,
    message: "Conflicto resuelto: el archivo target supersede al source.",
  };
}

async function logResolution(
  row: { id: string; project_id: string | null; source_file_id: string; target_file_id: string; relation_type: string },
  input: ResolveRelationInput,
  eventType: string,
): Promise<void> {
  await writeAuditLogEvent({
    organizationId: input.organizationId,
    projectId: row.project_id,
    actorUserId: input.actorUserId ?? null,
    eventType,
    entityType: "obra_relation",
    entityId: row.id,
    severity: "info",
    payload: {
      relationType: row.relation_type,
      sourceFileId: row.source_file_id,
      targetFileId: row.target_file_id,
      rationale: input.rationale ?? null,
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────────

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
