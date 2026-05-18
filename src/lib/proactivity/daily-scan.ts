import { writeAuditLogEvent } from "@/lib/audit/audit-log";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import { replaceProjectOperationalFindings } from "./operational-findings";

type FindingSeverity = "info" | "warning" | "critical";
type FindingType =
  | "schedule.overdue"
  | "schedule.upcoming"
  | "schedule.blocked"
  | "hse.non_compliant"
  | "hse.expiring"
  | "supply.delayed"
  | "supply.required_soon"
  | "financial.overrun"
  | "project.stale_docs";

export interface ProactivityFinding {
  id: string;
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  detail: string;
  organizationId: string;
  projectId: string;
  projectName: string;
  entityType: string;
  entityId?: string | null;
  dueDate?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProjectProactivitySummary {
  organizationId: string;
  projectId: string;
  projectName: string;
  findings: ProactivityFinding[];
}

export interface DailyProjectScanResult {
  scannedAt: string;
  scannedProjects: number;
  findingsCount: number;
  bySeverity: Record<FindingSeverity, number>;
  projects: ProjectProactivitySummary[];
}

interface RunDailyProjectScanOptions {
  limit?: number;
  now?: Date;
}

interface ProjectRow {
  id: string;
  organization_id: string;
  name: string;
  status: string;
  updated_at: string;
}

interface ScheduleTaskRow {
  id: string;
  name: string;
  status: string;
  due_date: string | null;
  progress_pct: number | string | null;
}

interface HseRecordRow {
  id: string;
  subject_name: string | null;
  subcontractor_name: string | null;
  record_type: string;
  status: string;
  expires_at: string | null;
}

interface SupplyItemRow {
  id: string;
  item_name: string;
  status: string;
  required_by: string | null;
  required_quantity: number | string | null;
  received_quantity: number | string | null;
}

interface FinancialSnapshotRow {
  id: string;
  snapshot_date: string;
  planned_amount: number | string | null;
  actual_amount: number | string | null;
  committed_amount: number | string | null;
}

interface FileRow {
  id: string;
  created_at: string;
}

const ACTIVE_PROJECT_STATUSES = ["en_obra", "planificacion"];
const DAY_MS = 24 * 60 * 60 * 1000;

export async function runDailyProjectScan(options: RunDailyProjectScanOptions = {}): Promise<DailyProjectScanResult> {
  const now = options.now ?? new Date();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const client = getInsForgeAdminClient();

  const projectsResult = await client.database
    .from("projects")
    .select("id, organization_id, name, status, updated_at")
    .in("status", ACTIVE_PROJECT_STATUSES)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (projectsResult.error) {
    throw new Error(projectsResult.error.message ?? "No se pudieron listar obras activas");
  }

  const projects = (projectsResult.data ?? []) as ProjectRow[];
  const summaries: ProjectProactivitySummary[] = [];

  for (const project of projects) {
    const summary = await scanProject(client, project, now);
    summaries.push(summary);
    await replaceProjectOperationalFindings(client, summary, now);

    await writeAuditLogEvent({
      organizationId: project.organization_id,
      projectId: project.id,
      eventType: "project.proactivity_scan",
      entityType: "project",
      entityId: project.id,
      severity: summary.findings.some((finding) => finding.severity === "critical" || finding.severity === "warning")
        ? "warning"
        : "info",
      payload: {
        projectName: project.name,
        findingCount: summary.findings.length,
        bySeverity: countBySeverity(summary.findings),
        findingKeys: summary.findings.slice(0, 50).map((finding) => finding.id),
        readModel: "operational_findings",
      },
    });
  }

  const allFindings = summaries.flatMap((summary) => summary.findings);
  const result: DailyProjectScanResult = {
    scannedAt: now.toISOString(),
    scannedProjects: summaries.length,
    findingsCount: allFindings.length,
    bySeverity: countBySeverity(allFindings),
    projects: summaries,
  };

  dbLogger.info(
    { scannedProjects: result.scannedProjects, findingsCount: result.findingsCount, bySeverity: result.bySeverity },
    "daily project proactivity scan completed"
  );

  return result;
}

async function scanProject(
  client: ReturnType<typeof getInsForgeAdminClient>,
  project: ProjectRow,
  now: Date
): Promise<ProjectProactivitySummary> {
  const [schedule, hse, supplies, financial, latestFile] = await Promise.all([
    fetchScheduleTasks(client, project),
    fetchHseRecords(client, project),
    fetchSupplyItems(client, project),
    fetchLatestFinancialSnapshot(client, project),
    fetchLatestFile(client, project),
  ]);

  const findings = [
    ...scanSchedule(project, schedule, now),
    ...scanHse(project, hse, now),
    ...scanSupplies(project, supplies, now),
    ...scanFinancial(project, financial),
    ...scanLatestFile(project, latestFile, now),
  ];

  return {
    organizationId: project.organization_id,
    projectId: project.id,
    projectName: project.name,
    findings: findings.slice(0, 50),
  };
}

async function fetchScheduleTasks(client: ReturnType<typeof getInsForgeAdminClient>, project: ProjectRow) {
  const result = await client.database
    .from("project_schedule_tasks")
    .select("id, name, status, due_date, progress_pct")
    .eq("organization_id", project.organization_id)
    .eq("project_id", project.id)
    .is("deleted_at", null)
    .in("status", ["not_started", "in_progress", "blocked"])
    .order("due_date", { ascending: true })
    .limit(100);

  if (result.error) dbLogger.warn({ err: result.error, projectId: project.id }, "proactivity schedule query failed");
  return (result.data ?? []) as ScheduleTaskRow[];
}

async function fetchHseRecords(client: ReturnType<typeof getInsForgeAdminClient>, project: ProjectRow) {
  const result = await client.database
    .from("project_hse_records")
    .select("id, subject_name, subcontractor_name, record_type, status, expires_at")
    .eq("organization_id", project.organization_id)
    .eq("project_id", project.id)
    .is("deleted_at", null)
    .order("expires_at", { ascending: true })
    .limit(100);

  if (result.error) dbLogger.warn({ err: result.error, projectId: project.id }, "proactivity hse query failed");
  return (result.data ?? []) as HseRecordRow[];
}

async function fetchSupplyItems(client: ReturnType<typeof getInsForgeAdminClient>, project: ProjectRow) {
  const result = await client.database
    .from("project_supply_items")
    .select("id, item_name, status, required_by, required_quantity, received_quantity")
    .eq("organization_id", project.organization_id)
    .eq("project_id", project.id)
    .is("deleted_at", null)
    .in("status", ["planned", "quoted", "ordered", "partial", "delayed"])
    .order("required_by", { ascending: true })
    .limit(100);

  if (result.error) dbLogger.warn({ err: result.error, projectId: project.id }, "proactivity supply query failed");
  return (result.data ?? []) as SupplyItemRow[];
}

async function fetchLatestFinancialSnapshot(client: ReturnType<typeof getInsForgeAdminClient>, project: ProjectRow) {
  const result = await client.database
    .from("project_financial_snapshots")
    .select("id, snapshot_date, planned_amount, actual_amount, committed_amount")
    .eq("organization_id", project.organization_id)
    .eq("project_id", project.id)
    .is("deleted_at", null)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (result.error) dbLogger.warn({ err: result.error, projectId: project.id }, "proactivity financial query failed");
  return ((result.data ?? []) as FinancialSnapshotRow[])[0] ?? null;
}

async function fetchLatestFile(client: ReturnType<typeof getInsForgeAdminClient>, project: ProjectRow) {
  const result = await client.database
    .from("uploaded_files")
    .select("id, created_at")
    .eq("organization_id", project.organization_id)
    .eq("project_id", project.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (result.error) dbLogger.warn({ err: result.error, projectId: project.id }, "proactivity latest file query failed");
  return ((result.data ?? []) as FileRow[])[0] ?? null;
}

function scanSchedule(project: ProjectRow, tasks: ScheduleTaskRow[], now: Date): ProactivityFinding[] {
  const soon = addDays(now, 14);
  const findings: ProactivityFinding[] = [];

  for (const task of tasks) {
    const due = parseDate(task.due_date);
    const progress = toNumber(task.progress_pct) ?? 0;
    const base = baseFinding(project, "project_schedule_task", task.id, task.due_date, { progressPct: progress });

    if (task.status === "blocked") {
      findings.push({
        ...base,
        id: `schedule.blocked:${task.id}`,
        type: "schedule.blocked",
        severity: "critical",
        title: `Tarea bloqueada: ${task.name}`,
        detail: "Hay una tarea marcada como bloqueada en una obra activa.",
      });
      continue;
    }

    if (due && due < startOfDay(now)) {
      findings.push({
        ...base,
        id: `schedule.overdue:${task.id}`,
        type: "schedule.overdue",
        severity: "critical",
        title: `Tarea vencida: ${task.name}`,
        detail: `Vencio el ${task.due_date} y registra ${progress}% de avance.`,
      });
      continue;
    }

    if (due && due <= soon && progress < 100) {
      findings.push({
        ...base,
        id: `schedule.upcoming:${task.id}`,
        type: "schedule.upcoming",
        severity: "warning",
        title: `Tarea proxima a vencer: ${task.name}`,
        detail: `Vence el ${task.due_date} y registra ${progress}% de avance.`,
      });
    }
  }

  return findings;
}

function scanHse(project: ProjectRow, records: HseRecordRow[], now: Date): ProactivityFinding[] {
  const soon = addDays(now, 14);
  const findings: ProactivityFinding[] = [];

  for (const record of records) {
    const expires = parseDate(record.expires_at);
    const subject = record.subject_name ?? record.subcontractor_name ?? "registro sin responsable";
    const base = baseFinding(project, "project_hse_record", record.id, record.expires_at, {
      recordType: record.record_type,
      status: record.status,
    });

    if (["expired", "missing", "incident"].includes(record.status) || (expires && expires < startOfDay(now))) {
      findings.push({
        ...base,
        id: `hse.non_compliant:${record.id}`,
        type: "hse.non_compliant",
        severity: "critical",
        title: `HSE no conforme: ${subject}`,
        detail: `${record.record_type.toUpperCase()} figura como ${record.status}${record.expires_at ? `, vence/vencio ${record.expires_at}` : ""}.`,
      });
      continue;
    }

    if (expires && expires <= soon) {
      findings.push({
        ...base,
        id: `hse.expiring:${record.id}`,
        type: "hse.expiring",
        severity: "warning",
        title: `HSE por vencer: ${subject}`,
        detail: `${record.record_type.toUpperCase()} vence el ${record.expires_at}.`,
      });
    }
  }

  return findings;
}

function scanSupplies(project: ProjectRow, items: SupplyItemRow[], now: Date): ProactivityFinding[] {
  const soon = addDays(now, 10);
  const findings: ProactivityFinding[] = [];

  for (const item of items) {
    const requiredBy = parseDate(item.required_by);
    const required = toNumber(item.required_quantity);
    const received = toNumber(item.received_quantity) ?? 0;
    const base = baseFinding(project, "project_supply_item", item.id, item.required_by, {
      status: item.status,
      requiredQuantity: required,
      receivedQuantity: received,
    });

    if (item.status === "delayed" || (requiredBy && requiredBy < startOfDay(now) && item.status !== "received")) {
      findings.push({
        ...base,
        id: `supply.delayed:${item.id}`,
        type: "supply.delayed",
        severity: "critical",
        title: `Suministro demorado: ${item.item_name}`,
        detail: `Estado ${item.status}${item.required_by ? `, requerido para ${item.required_by}` : ""}.`,
      });
      continue;
    }

    if (requiredBy && requiredBy <= soon && item.status !== "received" && (required == null || received < required)) {
      findings.push({
        ...base,
        id: `supply.required_soon:${item.id}`,
        type: "supply.required_soon",
        severity: "warning",
        title: `Suministro requerido pronto: ${item.item_name}`,
        detail: `Requerido para ${item.required_by}; recibido ${received}${required != null ? ` de ${required}` : ""}.`,
      });
    }
  }

  return findings;
}

function scanFinancial(project: ProjectRow, snapshot: FinancialSnapshotRow | null): ProactivityFinding[] {
  if (!snapshot) return [];

  const planned = toNumber(snapshot.planned_amount);
  const actual = toNumber(snapshot.actual_amount);
  const committed = toNumber(snapshot.committed_amount);
  if (!planned || planned <= 0) return [];

  const actualRatio = actual != null ? actual / planned : null;
  const committedRatio = committed != null ? committed / planned : null;
  const overrunRatio = Math.max(actualRatio ?? 0, committedRatio ?? 0);

  if (overrunRatio <= 1.08) return [];

  return [{
    ...baseFinding(project, "project_financial_snapshot", snapshot.id, snapshot.snapshot_date, {
      plannedAmount: planned,
      actualAmount: actual,
      committedAmount: committed,
      overrunPct: Math.round((overrunRatio - 1) * 10000) / 100,
    }),
    id: `financial.overrun:${snapshot.id}`,
    type: "financial.overrun",
    severity: overrunRatio > 1.15 ? "critical" : "warning",
    title: "Desvio financiero sobre curva planificada",
    detail: `El ultimo snapshot supera el plan en ${Math.round((overrunRatio - 1) * 100)}%.`,
  }];
}

function scanLatestFile(project: ProjectRow, file: FileRow | null, now: Date): ProactivityFinding[] {
  if (!file) {
    return [{
      ...baseFinding(project, "project", project.id, null),
      id: `project.stale_docs:${project.id}:none`,
      type: "project.stale_docs",
      severity: "info",
      title: "Obra sin documentacion reciente",
      detail: "No hay archivos asociados a la obra activa.",
    }];
  }

  const lastUpload = new Date(file.created_at);
  if (Number.isNaN(lastUpload.getTime()) || now.getTime() - lastUpload.getTime() <= 30 * DAY_MS) return [];

  return [{
    ...baseFinding(project, "uploaded_file", file.id, file.created_at),
    id: `project.stale_docs:${project.id}:${file.id}`,
    type: "project.stale_docs",
    severity: "info",
    title: "Obra sin actualizacion documental reciente",
    detail: `Ultimo archivo registrado el ${file.created_at.slice(0, 10)}.`,
  }];
}

function baseFinding(
  project: ProjectRow,
  entityType: string,
  entityId: string,
  dueDate?: string | null,
  metadata?: Record<string, unknown>
): Omit<ProactivityFinding, "id" | "type" | "severity" | "title" | "detail"> {
  return {
    organizationId: project.organization_id,
    projectId: project.id,
    projectName: project.name,
    entityType,
    entityId,
    dueDate,
    metadata,
  };
}

function countBySeverity(findings: ProactivityFinding[]): Record<FindingSeverity, number> {
  return findings.reduce<Record<FindingSeverity, number>>(
    (acc, finding) => {
      acc[finding.severity] += 1;
      return acc;
    },
    { info: 0, warning: 0, critical: 0 }
  );
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDays(value: Date, days: number): Date {
  return new Date(startOfDay(value).getTime() + days * DAY_MS);
}
