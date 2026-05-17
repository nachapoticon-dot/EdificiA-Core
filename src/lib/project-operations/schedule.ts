import { writeAuditLogEvent } from "@/lib/audit/audit-log";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import type { ProjectScheduleTaskStatus } from "@/types";

interface TaskRow {
  id: string;
  organization_id: string;
  project_id: string;
  task_code: string | null;
  name: string;
  status: ProjectScheduleTaskStatus;
  start_date: string | null;
  due_date: string | null;
  progress_pct: number | string | null;
}

export interface ReprogramTaskInput {
  organizationId: string;
  projectId: string;
  taskRef: string;
  newDueDate: string;
  reason?: string;
  notifyTo?: string[];
  actorUserId?: string | null;
}

export interface ReprogramTaskResult {
  ok: boolean;
  reason?: string;
  task?: {
    id: string;
    name: string;
    taskCode: string | null;
    previousDueDate: string | null;
    newDueDate: string;
    previousStatus: ProjectScheduleTaskStatus;
    newStatus: ProjectScheduleTaskStatus;
    progressPct: number;
  };
  auditEventType: string;
  message: string;
  candidates?: { id: string; name: string; taskCode: string | null; dueDate: string | null }[];
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function reprogramAndInform(input: ReprogramTaskInput): Promise<ReprogramTaskResult> {
  if (!ISO_DATE_PATTERN.test(input.newDueDate)) {
    return {
      ok: false,
      reason: "invalid_date",
      auditEventType: "schedule.reschedule_failed",
      message: `La fecha "${input.newDueDate}" no es válida. Usar formato YYYY-MM-DD.`,
    };
  }

  const client = getInsForgeAdminClient();
  const needle = input.taskRef.trim().toLowerCase();

  const lookup = await client.database
    .from("project_schedule_tasks")
    .select("id, organization_id, project_id, task_code, name, status, start_date, due_date, progress_pct")
    .eq("organization_id", input.organizationId)
    .eq("project_id", input.projectId)
    .is("deleted_at", null)
    .limit(200);

  if (lookup.error) {
    dbLogger.warn({ err: lookup.error, projectId: input.projectId }, "reprogram lookup failed");
    throw new Error(lookup.error.message ?? "No se pudo consultar tareas de cronograma");
  }

  const tasks = (lookup.data ?? []) as TaskRow[];
  const matched = tasks.filter((task) => {
    const code = task.task_code?.toLowerCase() ?? "";
    return task.id === input.taskRef
      || code === needle
      || task.name.toLowerCase().includes(needle);
  });

  if (matched.length === 0) {
    return {
      ok: false,
      reason: "task_not_found",
      auditEventType: "schedule.reschedule_failed",
      message: `No encontré una tarea que coincida con "${input.taskRef}" en esta obra.`,
    };
  }

  if (matched.length > 1) {
    return {
      ok: false,
      reason: "ambiguous_task",
      auditEventType: "schedule.reschedule_failed",
      message: `La referencia "${input.taskRef}" coincide con ${matched.length} tareas. Pedí al usuario que precise código o nombre exacto.`,
      candidates: matched.slice(0, 5).map((task) => ({
        id: task.id,
        name: task.name,
        taskCode: task.task_code,
        dueDate: task.due_date,
      })),
    };
  }

  const task = matched[0]!;
  const previousStatus = task.status;
  const previousDueDate = task.due_date;
  const progressPct = toNumber(task.progress_pct) ?? 0;
  const nextStatus: ProjectScheduleTaskStatus = previousStatus === "done" || previousStatus === "cancelled"
    ? previousStatus
    : progressPct > 0 ? "in_progress" : "not_started";

  const update = await client.database
    .from("project_schedule_tasks")
    .update({
      due_date: input.newDueDate,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id)
    .eq("organization_id", input.organizationId);

  if (update.error) {
    dbLogger.warn({ err: update.error, taskId: task.id }, "reprogram update failed");
    throw new Error(update.error.message ?? "No se pudo actualizar la tarea");
  }

  await writeAuditLogEvent({
    organizationId: input.organizationId,
    projectId: input.projectId,
    actorUserId: input.actorUserId ?? null,
    eventType: "schedule.rescheduled",
    entityType: "project_schedule_task",
    entityId: task.id,
    severity: "info",
    payload: {
      taskName: task.name,
      taskCode: task.task_code,
      previousDueDate,
      newDueDate: input.newDueDate,
      previousStatus,
      newStatus: nextStatus,
      reason: input.reason ?? null,
      notifyTo: input.notifyTo ?? [],
      progressPct,
    },
  });

  return {
    ok: true,
    auditEventType: "schedule.rescheduled",
    task: {
      id: task.id,
      name: task.name,
      taskCode: task.task_code,
      previousDueDate,
      newDueDate: input.newDueDate,
      previousStatus,
      newStatus: nextStatus,
      progressPct,
    },
    message: previousDueDate
      ? `Tarea "${task.name}" reprogramada del ${previousDueDate} al ${input.newDueDate}.`
      : `Tarea "${task.name}" agendada para el ${input.newDueDate}.`,
  };
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
