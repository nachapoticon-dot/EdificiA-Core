import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import type { ProjectHseRecordStatus, ProjectHseRecordType } from "@/types";

interface HseRow {
  id: string;
  subject_name: string | null;
  worker_identifier: string | null;
  subcontractor_name: string | null;
  record_type: ProjectHseRecordType;
  status: ProjectHseRecordStatus;
  issued_at: string | null;
  expires_at: string | null;
}

export interface PersonnelClearanceCheck {
  recordId: string;
  type: ProjectHseRecordType;
  status: ProjectHseRecordStatus;
  expiresAt: string | null;
  daysToExpire: number | null;
  observation: string | null;
}

export interface PersonnelClearanceResult {
  found: boolean;
  cuadrilla: string;
  projectId: string;
  subjectsChecked: string[];
  verdict: "apto" | "observado" | "no_apto" | "sin_registro";
  blockingTypes: ProjectHseRecordType[];
  expiringTypes: ProjectHseRecordType[];
  missingTypes: ProjectHseRecordType[];
  records: PersonnelClearanceCheck[];
  summary: string;
}

const REQUIRED_TYPES: ProjectHseRecordType[] = ["art", "epp"];

export async function verifyPersonnelClearance(input: {
  cuadrilla: string;
  projectId: string;
  organizationId: string;
  now?: Date;
}): Promise<PersonnelClearanceResult> {
  const now = input.now ?? new Date();
  const client = getInsForgeAdminClient();
  const needle = input.cuadrilla.trim().toLowerCase();

  const result = await client.database
    .from("project_hse_records")
    .select("id, subject_name, worker_identifier, subcontractor_name, record_type, status, issued_at, expires_at")
    .eq("organization_id", input.organizationId)
    .eq("project_id", input.projectId)
    .is("deleted_at", null)
    .limit(200);

  if (result.error) {
    dbLogger.warn({ err: result.error, projectId: input.projectId }, "verify_personnel_clearance query failed");
    throw new Error(result.error.message ?? "No se pudo consultar registros HSE");
  }

  const rows = (result.data ?? []) as HseRow[];
  const matched = rows.filter((row) => {
    const fields = [row.subject_name, row.worker_identifier, row.subcontractor_name];
    return fields.some((field) => field && field.toLowerCase().includes(needle));
  });

  if (matched.length === 0) {
    return {
      found: false,
      cuadrilla: input.cuadrilla,
      projectId: input.projectId,
      subjectsChecked: [],
      verdict: "sin_registro",
      blockingTypes: [],
      expiringTypes: [],
      missingTypes: REQUIRED_TYPES,
      records: [],
      summary: `No hay registros HSE cargados para "${input.cuadrilla}" en esta obra. Pedí ART/EPP antes de habilitar ingreso.`,
    };
  }

  const subjectsChecked = Array.from(
    new Set(
      matched
        .map((row) => row.subject_name ?? row.subcontractor_name ?? row.worker_identifier)
        .filter((value): value is string => Boolean(value))
    )
  );

  const records: PersonnelClearanceCheck[] = matched.map((row) => {
    const expiresAt = row.expires_at;
    const daysToExpire = expiresAt ? differenceInDays(expiresAt, now) : null;
    let observation: string | null = null;

    if (row.status === "incident") observation = "Incidente registrado — requiere revisión antes de habilitar ingreso.";
    else if (row.status === "expired") observation = `Vencido${expiresAt ? ` el ${expiresAt}` : ""}.`;
    else if (row.status === "missing") observation = "Marcado como faltante.";
    else if (daysToExpire != null && daysToExpire <= 14) observation = `Vence en ${daysToExpire} día(s).`;

    return {
      recordId: row.id,
      type: row.record_type,
      status: row.status,
      expiresAt,
      daysToExpire,
      observation,
    };
  });

  const blocking = records.filter((rec) => rec.status === "expired" || rec.status === "missing" || rec.status === "incident");
  const expiring = records.filter((rec) => rec.status === "expiring" || (rec.daysToExpire != null && rec.daysToExpire <= 14 && rec.status !== "expired"));
  const presentTypes = new Set(records.map((rec) => rec.type));
  const missing = REQUIRED_TYPES.filter((type) => !presentTypes.has(type));

  let verdict: PersonnelClearanceResult["verdict"];
  if (blocking.length > 0 || missing.length > 0) verdict = "no_apto";
  else if (expiring.length > 0) verdict = "observado";
  else verdict = "apto";

  const summaryParts: string[] = [];
  if (verdict === "apto") summaryParts.push(`Habilitación vigente para "${input.cuadrilla}".`);
  if (blocking.length > 0) summaryParts.push(`${blocking.length} registro(s) bloqueante(s)`);
  if (missing.length > 0) summaryParts.push(`falta ${missing.map((m) => m.toUpperCase()).join(", ")}`);
  if (expiring.length > 0) summaryParts.push(`${expiring.length} por vencer en ≤14 días`);

  return {
    found: true,
    cuadrilla: input.cuadrilla,
    projectId: input.projectId,
    subjectsChecked,
    verdict,
    blockingTypes: Array.from(new Set(blocking.map((rec) => rec.type))),
    expiringTypes: Array.from(new Set(expiring.map((rec) => rec.type))),
    missingTypes: missing,
    records,
    summary: summaryParts.join(" · ") || "Sin observaciones.",
  };
}

function differenceInDays(date: string, reference: Date): number | null {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const refUtc = Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate());
  return Math.round((parsed.getTime() - refUtc) / 86_400_000);
}
