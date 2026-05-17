import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited } from "@/lib/api/errors";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getRequestLogger, dbLogger } from "@/lib/logger";
import { parseScheduleCsv, type ParsedScheduleRow } from "@/lib/schedule/csv-importer";
import { scheduleImportResponseSchema } from "@/lib/validators/api-responses";
import { writeAuditLogEvent } from "@/lib/audit/audit-log";

export const runtime = "nodejs";

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_TASKS_PER_IMPORT = 500;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkRateLimit(rateLimitKey(req, "schedule-import"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req, { role: "engineer" });
  if (auth instanceof Response) return auth;

  const { id: projectId } = await params;
  const log = getRequestLogger(req);

  try {
    const client = getInsForgeAdminClient();
    const project = await client.database
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .eq("organization_id", auth.orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (project.error || !project.data) {
      return Response.json({ error: "Proyecto no encontrado." }, { status: 404 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    let csvText: string;
    let originalFileName = "schedule.csv";
    let mode: "replace" | "append" = "append";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      const rawMode = formData.get("mode");
      if (typeof rawMode === "string" && (rawMode === "replace" || rawMode === "append")) mode = rawMode;
      if (!(file instanceof File)) {
        return Response.json({ error: "Falta el archivo CSV ('file')." }, { status: 400 });
      }
      if (file.size > MAX_CSV_BYTES) {
        return Response.json({ error: "El CSV supera 2MB. Dividilo en partes." }, { status: 413 });
      }
      originalFileName = file.name || originalFileName;
      csvText = await file.text();
    } else if (contentType.includes("application/json")) {
      const body = (await req.json()) as { csv?: string; mode?: string; fileName?: string };
      if (typeof body.csv !== "string") {
        return Response.json({ error: "Falta el campo 'csv'." }, { status: 400 });
      }
      if (body.csv.length > MAX_CSV_BYTES * 4) {
        return Response.json({ error: "El CSV es demasiado grande." }, { status: 413 });
      }
      csvText = body.csv;
      if (body.fileName) originalFileName = body.fileName;
      if (body.mode === "replace" || body.mode === "append") mode = body.mode;
    } else {
      return Response.json({ error: "Content-Type no soportado. Usar multipart/form-data o application/json." }, { status: 415 });
    }

    const parsed = parseScheduleCsv(csvText);
    if (parsed.errors.length > 0) {
      return Response.json({ error: "CSV inválido", details: parsed.errors }, { status: 400 });
    }
    if (parsed.rows.length === 0) {
      return Response.json({ error: "El CSV no tiene filas para importar." }, { status: 400 });
    }
    if (parsed.rows.length > MAX_TASKS_PER_IMPORT) {
      return Response.json({
        error: `Demasiadas tareas (${parsed.rows.length}). Máximo ${MAX_TASKS_PER_IMPORT} por import.`,
      }, { status: 413 });
    }

    if (mode === "replace") {
      const softDelete = await client.database
        .from("project_schedule_tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("organization_id", auth.orgId)
        .eq("project_id", projectId)
        .is("deleted_at", null);
      if (softDelete.error) {
        log.warn({ err: softDelete.error }, "schedule replace soft-delete failed");
      }
    }

    const codeToId = new Map<string, string>();
    const inserted: ParsedScheduleRow[] = [];
    const insertWarnings = [...parsed.warnings];

    // First pass: insert rows without predecessor reference so we have task UUIDs.
    for (const row of parsed.rows) {
      const insertResult = await client.database
        .from("project_schedule_tasks")
        .insert({
          organization_id: auth.orgId,
          project_id: projectId,
          task_code: row.task_code,
          name: row.name,
          description: row.description,
          status: row.status,
          start_date: row.start_date,
          due_date: row.due_date,
          progress_pct: row.progress_pct,
          metadata: { source: "csv_import", originalFileName, importedAt: new Date().toISOString() },
          created_by: auth.userId,
        })
        .select("id")
        .single();

      if (insertResult.error || !insertResult.data) {
        insertWarnings.push(`Fila ${row.rowNumber} (${row.name}): no se pudo insertar — ${insertResult.error?.message ?? "error desconocido"}.`);
        continue;
      }

      const newId = (insertResult.data as { id: string }).id;
      if (row.task_code) codeToId.set(row.task_code, newId);
      inserted.push(row);
    }

    // Second pass: resolve predecessors by code.
    for (const row of parsed.rows) {
      if (!row.predecessor_code) continue;
      const predecessorId = codeToId.get(row.predecessor_code);
      if (!predecessorId) {
        insertWarnings.push(`Fila ${row.rowNumber}: predecesor "${row.predecessor_code}" no encontrado.`);
        continue;
      }
      if (!row.task_code) continue;
      const selfId = codeToId.get(row.task_code);
      if (!selfId || selfId === predecessorId) continue;
      const update = await client.database
        .from("project_schedule_tasks")
        .update({ predecessor_task_id: predecessorId })
        .eq("id", selfId)
        .eq("organization_id", auth.orgId);
      if (update.error) {
        insertWarnings.push(`Fila ${row.rowNumber}: no se pudo vincular predecesor.`);
      }
    }

    const response = {
      ok: true as const,
      mode,
      totalRows: parsed.rows.length,
      insertedCount: inserted.length,
      warnings: insertWarnings,
    };

    void writeAuditLogEvent({
      organizationId: auth.orgId,
      projectId,
      actorUserId: auth.userId,
      eventType: "schedule.csv_import",
      entityType: "project",
      entityId: projectId,
      severity: "info",
      payload: {
        fileName: originalFileName,
        mode,
        totalRows: parsed.rows.length,
        insertedCount: inserted.length,
        warningCount: insertWarnings.length,
      },
    });

    return Response.json(scheduleImportResponseSchema.parse(response));
  } catch (err) {
    dbLogger.error({ err }, "schedule import failed");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
