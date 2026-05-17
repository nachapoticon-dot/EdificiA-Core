import { writeAuditLogEvent } from "@/lib/audit/audit-log";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import type { ProjectSubcontractStatus } from "@/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

interface BaseCtx {
  organizationId: string;
  projectId: string;
  actorUserId?: string | null;
}

export interface RegisterSubcontractInput extends BaseCtx {
  vendorName: string;
  trade?: string | null;
  contractAmount?: number | null;
  currency?: string;
  status?: ProjectSubcontractStatus;
  startDate?: string | null;
  endDate?: string | null;
  retentionPct?: number | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  note?: string;
}

export interface RegisterSubcontractResult {
  ok: boolean;
  reason?: string;
  message: string;
  subcontractId?: string;
}

interface SubcontractRow {
  id: string;
  vendor_name: string;
  trade: string | null;
  contract_amount: number | string | null;
  currency: string;
  status: ProjectSubcontractStatus;
  start_date: string | null;
  end_date: string | null;
  retention_pct: number | string | null;
}

export interface AuditSubcontractsInput extends BaseCtx {
  includeCompleted?: boolean;
  horizonDays?: number;
}

export interface AuditSubcontractsResult {
  ok: boolean;
  projectId: string;
  totalCount: number;
  activeCount: number;
  totalContractAmount: number;
  activeContractAmount: number;
  totalRetentionAmount: number;
  currency: string;
  byStatus: Record<string, { count: number; amount: number }>;
  byTrade: Array<{ trade: string; count: number; amount: number; incidencePct: number }>;
  endingSoon: Array<{ id: string; vendorName: string; trade: string | null; endDate: string; daysToEnd: number; amount: number | null }>;
  expired: Array<{ id: string; vendorName: string; trade: string | null; endDate: string; daysOverdue: number; amount: number | null }>;
  summary: string;
}

export async function registerSubcontract(input: RegisterSubcontractInput): Promise<RegisterSubcontractResult> {
  const vendorName = input.vendorName.trim();
  if (!vendorName) return { ok: false, reason: "missing_vendor", message: "Indicá vendorName." };
  if (input.startDate && !ISO_DATE.test(input.startDate)) {
    return { ok: false, reason: "invalid_date", message: `startDate "${input.startDate}" no respeta YYYY-MM-DD.` };
  }
  if (input.endDate && !ISO_DATE.test(input.endDate)) {
    return { ok: false, reason: "invalid_date", message: `endDate "${input.endDate}" no respeta YYYY-MM-DD.` };
  }
  if (input.retentionPct != null && (input.retentionPct < 0 || input.retentionPct > 100)) {
    return { ok: false, reason: "invalid_retention", message: "retentionPct debe estar entre 0 y 100." };
  }

  const client = getInsForgeAdminClient();
  const insert = await client.database
    .from("project_subcontracts")
    .insert({
      organization_id: input.organizationId,
      project_id: input.projectId,
      vendor_name: vendorName,
      trade: input.trade?.trim() || null,
      contract_amount: input.contractAmount ?? null,
      currency: input.currency ?? "ARS",
      status: input.status ?? "draft",
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      retention_pct: input.retentionPct ?? null,
      contact_name: input.contactName ?? null,
      contact_email: input.contactEmail ?? null,
      contact_phone: input.contactPhone ?? null,
      metadata: input.note ? { note: input.note } : {},
      created_by: input.actorUserId ?? null,
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    dbLogger.warn({ err: insert.error }, "register_subcontract insert failed");
    return { ok: false, reason: "db_error", message: insert.error?.message ?? "No se pudo registrar el subcontrato." };
  }

  const subcontractId = (insert.data as { id: string }).id;
  await writeAuditLogEvent({
    organizationId: input.organizationId,
    projectId: input.projectId,
    actorUserId: input.actorUserId ?? null,
    eventType: "subcontract.registered",
    entityType: "project_subcontract",
    entityId: subcontractId,
    severity: "info",
    payload: {
      vendorName,
      trade: input.trade ?? null,
      contractAmount: input.contractAmount ?? null,
      currency: input.currency ?? "ARS",
      status: input.status ?? "draft",
      endDate: input.endDate ?? null,
      retentionPct: input.retentionPct ?? null,
    },
  });

  return {
    ok: true,
    subcontractId,
    message: `Subcontrato "${vendorName}" registrado${input.contractAmount != null ? ` por ${input.currency ?? "ARS"} ${input.contractAmount}` : ""}.`,
  };
}

export async function auditSubcontracts(input: AuditSubcontractsInput): Promise<AuditSubcontractsResult> {
  const horizonDays = input.horizonDays ?? 30;
  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("project_subcontracts")
    .select("id, vendor_name, trade, contract_amount, currency, status, start_date, end_date, retention_pct")
    .eq("organization_id", input.organizationId)
    .eq("project_id", input.projectId)
    .is("deleted_at", null)
    .order("end_date", { ascending: true })
    .limit(300);

  if (result.error) {
    dbLogger.warn({ err: result.error }, "audit_subcontracts query failed");
    return emptyAudit(input.projectId, "No se pudieron leer los subcontratos.");
  }

  const allRows = (result.data ?? []) as SubcontractRow[];
  const rows = input.includeCompleted
    ? allRows
    : allRows.filter((row) => row.status !== "completed" && row.status !== "terminated");
  const currency = rows.find((row) => row.currency)?.currency ?? "ARS";
  const today = startOfUtcDay(new Date());
  const horizon = new Date(today.getTime() + horizonDays * DAY_MS);

  const byStatus: AuditSubcontractsResult["byStatus"] = {};
  const tradeMap = new Map<string, { count: number; amount: number }>();
  const endingSoon: AuditSubcontractsResult["endingSoon"] = [];
  const expired: AuditSubcontractsResult["expired"] = [];

  let totalContractAmount = 0;
  let activeContractAmount = 0;
  let totalRetentionAmount = 0;
  let activeCount = 0;

  for (const row of rows) {
    const amount = toNumber(row.contract_amount) ?? 0;
    const retentionPct = toNumber(row.retention_pct) ?? 0;
    totalContractAmount += amount;
    totalRetentionAmount += amount * (retentionPct / 100);
    if (row.status === "active") {
      activeCount++;
      activeContractAmount += amount;
    }

    const statusStats = byStatus[row.status] ?? { count: 0, amount: 0 };
    statusStats.count++;
    statusStats.amount += amount;
    byStatus[row.status] = statusStats;

    const trade = row.trade?.trim() || "Sin rubro";
    const tradeStats = tradeMap.get(trade) ?? { count: 0, amount: 0 };
    tradeStats.count++;
    tradeStats.amount += amount;
    tradeMap.set(trade, tradeStats);

    const endDate = parseDate(row.end_date);
    if (endDate && row.status !== "completed" && row.status !== "terminated") {
      const days = Math.round((endDate.getTime() - today.getTime()) / DAY_MS);
      const item = {
        id: row.id,
        vendorName: row.vendor_name,
        trade: row.trade,
        endDate: row.end_date!,
        amount: toNumber(row.contract_amount),
      };
      if (endDate < today) expired.push({ ...item, daysOverdue: Math.abs(days) });
      else if (endDate <= horizon) endingSoon.push({ ...item, daysToEnd: days });
    }
  }

  const byTrade = Array.from(tradeMap.entries())
    .map(([trade, stats]) => ({
      trade,
      count: stats.count,
      amount: roundMoney(stats.amount),
      incidencePct: totalContractAmount > 0 ? roundPct((stats.amount / totalContractAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const summaryParts = [
    `${rows.length} subcontrato(s) auditado(s)`,
    `${activeCount} activo(s)`,
    `${endingSoon.length} vencen en ${horizonDays}d`,
    `${expired.length} vencido(s)`,
  ];
  if (totalRetentionAmount > 0) summaryParts.push(`retenciones estimadas ${currency} ${roundMoney(totalRetentionAmount)}`);

  return {
    ok: true,
    projectId: input.projectId,
    totalCount: rows.length,
    activeCount,
    totalContractAmount: roundMoney(totalContractAmount),
    activeContractAmount: roundMoney(activeContractAmount),
    totalRetentionAmount: roundMoney(totalRetentionAmount),
    currency,
    byStatus,
    byTrade,
    endingSoon: endingSoon.slice(0, 12),
    expired: expired.slice(0, 12),
    summary: summaryParts.join(" · "),
  };
}

function emptyAudit(projectId: string, summary: string): AuditSubcontractsResult {
  return {
    ok: false,
    projectId,
    totalCount: 0,
    activeCount: 0,
    totalContractAmount: 0,
    activeContractAmount: 0,
    totalRetentionAmount: 0,
    currency: "ARS",
    byStatus: {},
    byTrade: [],
    endingSoon: [],
    expired: [],
    summary,
  };
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}
