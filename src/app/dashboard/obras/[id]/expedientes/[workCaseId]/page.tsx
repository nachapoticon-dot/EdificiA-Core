"use client";

import { use, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Activity,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Gavel,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Lock,
  RotateCcw,
  X,
} from "lucide-react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useSessionContext } from "@/contexts/SessionContext";
import {
  updateWorkCaseStatus,
  useWorkCaseDetails,
  type UpdateWorkCaseInput,
  type WorkCaseDetail,
} from "@/hooks/useWorkCases";
import { KIND_LABELS, STATUS_LABELS, VERDICT_LABELS, WORK_CASE_VERDICTS, type WorkCaseVerdict } from "@/lib/work-cases/types";
import { cn } from "@/lib/utils";

type WorkCase = NonNullable<WorkCaseDetail>["workCase"];
type WorkCaseEvent = NonNullable<WorkCaseDetail>["events"][number];
type AgentRun = NonNullable<WorkCaseDetail>["agentRuns"][number];

const VERDICT_TONE: Record<WorkCaseVerdict, string> = {
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  flagged: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  inconclusive: "bg-muted text-muted-foreground",
  rejected: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  superseded: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const EVENT_LABELS: Record<string, string> = {
  "chat_session.linked": "Sesión asociada",
  "chat_session.legacy_linked": "Sesión previa asociada",
  "chat.turn_completed": "Turno completado",
  "work_case.status_changed": "Cambio de estado",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ClosureMode = "resolved" | "closed";

export default function WorkCaseDetailPage({ params }: { params: Promise<{ id: string; workCaseId: string }> }) {
  const { id: projectId, workCaseId } = use(params);
  const router = useRouter();
  const { projects, activateProject } = useProjectContext();
  const { switchSession } = useSessionContext();
  const query = useWorkCaseDetails(workCaseId);
  const detail = query.data;
  const workCase = detail?.workCase ?? null;
  const project = projects.find((p) => p.id === projectId);
  const projectName = project?.name ?? "Obra";
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [closureMode, setClosureMode] = useState<ClosureMode | null>(null);

  function openChat() {
    if (!workCase?.chatSessionId) return;
    if (project) activateProject(project);
    switchSession({
      id: workCase.chatSessionId,
      title: workCase.chatSessionTitle ?? workCase.title,
      fileType: workCase.chatSessionFileType ?? undefined,
      startedAt: workCase.chatSessionStartedAt ?? Date.parse(workCase.createdAt),
      projectId: workCase.projectId ?? undefined,
    });
    router.push("/dashboard/chat");
  }

  async function applyUpdate(input: UpdateWorkCaseInput) {
    if (!workCase) return;
    setIsUpdatingStatus(true);
    try {
      await updateWorkCaseStatus(workCase.id, input);
      await query.refetch();
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function reopen() {
    await applyUpdate({ status: "open", summary: null, verdict: null });
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-background">
      <div className="border-b border-border bg-card px-8 py-5">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/obras/${projectId}` as Route)}
              className="flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Detalle de obra
            </button>
            <span className="hidden text-muted-foreground/40 sm:inline">/</span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Expediente · {projectName}
              </p>
              <h1 className="truncate font-display text-[20px] font-medium tracking-[-0.01em] text-foreground">
                {workCase?.title ?? "Expediente"}
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
                title="Actualizar"
                className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} />
              </button>
              <button
                type="button"
                onClick={openChat}
                disabled={!workCase?.chatSessionId}
                className="flex items-center gap-2 rounded-[8px] bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <MessageSquare className="h-4 w-4" />
                Abrir chat
              </button>
              {workCase && workCase.status !== "resolved" && workCase.status !== "closed" && (
                <button
                  type="button"
                  onClick={() => setClosureMode("resolved")}
                  disabled={isUpdatingStatus}
                  className="flex items-center gap-2 rounded-[8px] border border-border bg-background px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Resolver
                </button>
              )}
              {workCase && workCase.status !== "closed" && (
                <button
                  type="button"
                  onClick={() => setClosureMode("closed")}
                  disabled={isUpdatingStatus}
                  className="flex items-center gap-2 rounded-[8px] border border-border bg-background px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <Lock className="h-4 w-4" />
                  Cerrar
                </button>
              )}
              {workCase && (workCase.status === "resolved" || workCase.status === "closed" || workCase.status === "archived") && (
                <button
                  type="button"
                  onClick={() => void reopen()}
                  disabled={isUpdatingStatus}
                  className="flex items-center gap-2 rounded-[8px] border border-border bg-background px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reabrir
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-8 py-8">
        {query.isLoading && <DetailSkeleton />}

        {!query.isLoading && !detail && (
          <div className="rounded-[8px] border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
            No se pudo cargar este expediente.
          </div>
        )}

        {detail && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Metric icon={BriefcaseBusiness} label="Tipo" value={KIND_LABELS[detail.workCase.kind] ?? detail.workCase.kind} />
              <Metric icon={ShieldCheck} label="Estado" value={STATUS_LABELS[detail.workCase.status]} />
              <Metric icon={ClipboardList} label="Eventos" value={String(detail.events.length)} />
              <Metric icon={Activity} label="Turnos del agente" value={String(detail.agentRuns.length)} />
            </div>

            {(detail.workCase.verdict || detail.workCase.summary || detail.workCase.closedAt) && (
              <ClosureSummary workCase={detail.workCase} />
            )}

            <section className="rounded-[10px] border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <p className="text-[13px] font-semibold text-foreground">Historial</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Turnos del agente y eventos registrados en el expediente.</p>
              </div>
              {detail.events.length === 0 && detail.agentRuns.length === 0 ? (
                <EmptyState text="Este expediente todavía no tiene eventos." />
              ) : (
                <div className="divide-y divide-border">
                  {detail.agentRuns.map((run) => (
                    <AgentRunRow key={run.id} run={run} />
                  ))}
                  {detail.events.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {closureMode && workCase && (
        <ClosureModal
          mode={closureMode}
          workCase={workCase}
          isSubmitting={isUpdatingStatus}
          onCancel={() => setClosureMode(null)}
          onSubmit={async ({ summary, verdict }) => {
            await applyUpdate({ status: closureMode, summary, verdict });
            setClosureMode(null);
          }}
        />
      )}
    </div>
  );
}

function ClosureSummary({ workCase }: { workCase: WorkCase }) {
  return (
    <section className="rounded-[10px] border border-border bg-card px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Gavel className="h-4 w-4 text-muted-foreground" />
        <p className="text-[13px] font-semibold text-foreground">Resolución del expediente</p>
        {workCase.verdict && (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", VERDICT_TONE[workCase.verdict])}>
            {VERDICT_LABELS[workCase.verdict]}
          </span>
        )}
        {workCase.closedAt && (
          <span className="ml-auto text-[11px] text-muted-foreground">Cerrado el {formatDateTime(workCase.closedAt)}</span>
        )}
      </div>
      {workCase.summary && (
        <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{workCase.summary}</p>
      )}
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em]">{label}</span>
      </div>
      <p className="mt-2 truncate text-[14px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function AgentRunRow({ run }: { run: AgentRun }) {
  const hasErrors = run.toolErrorsTotal > 0;
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Activity className={cn("mt-0.5 h-4 w-4 shrink-0", hasErrors ? "text-amber-500" : "text-primary")} strokeWidth={1.7} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-foreground">
          Turno del agente{hasErrors ? ` · ${run.toolErrorsTotal} error(es) de tools` : ""}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {formatDateTime(run.startedAt)} · {run.model} ({run.tier}) · {run.steps} pasos · {run.toolCallsTotal} tool call(s) · {run.latencyMs} ms
        </span>
      </span>
    </div>
  );
}

function EventRow({ event }: { event: WorkCaseEvent }) {
  const [open, setOpen] = useState(false);
  const title = EVENT_LABELS[event.eventType] ?? event.eventType;
  return (
    <div className="px-4 py-3">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-start gap-3 text-left">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-foreground">{title}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {formatDateTime(event.createdAt)}{event.summary ? ` · ${event.summary}` : ""}
          </span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-[8px] border border-border bg-background p-3 text-[11px] leading-relaxed text-muted-foreground">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">{text}</div>;
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-[8px] border border-border bg-card" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-[10px] border border-border bg-card" />
    </div>
  );
}

function ClosureModal({
  mode,
  workCase,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  mode: ClosureMode;
  workCase: WorkCase;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (input: { summary: string | null; verdict: WorkCaseVerdict | null }) => Promise<void>;
}) {
  const [summary, setSummary] = useState<string>(workCase.summary ?? "");
  const [verdict, setVerdict] = useState<WorkCaseVerdict | "">(workCase.verdict ?? "");

  const title = mode === "resolved" ? "Resolver expediente" : "Cerrar expediente";
  const helper =
    mode === "resolved"
      ? "Antes de marcar como resuelto, capturá la conclusión operativa y un veredicto editable."
      : "Antes de cerrar el expediente, dejá registrado el veredicto final y el resumen.";

  async function handleSubmit() {
    const trimmed = summary.trim();
    await onSubmit({
      summary: trimmed ? trimmed.slice(0, 2000) : null,
      verdict: verdict ? (verdict as WorkCaseVerdict) : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[12px] border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Resolución</p>
            <h2 className="mt-1 font-display text-[18px] font-medium text-foreground">{title}</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">{helper}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="text-[12px] font-semibold text-foreground">Veredicto</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {WORK_CASE_VERDICTS.map((option) => {
                const isActive = verdict === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setVerdict(isActive ? "" : option)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                      isActive
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent",
                    )}
                  >
                    {VERDICT_LABELS[option]}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Opcional. Quedará registrado en el evento de cierre.</p>
          </div>

          <div>
            <label htmlFor="closure-summary" className="text-[12px] font-semibold text-foreground">
              Resumen / conclusión
            </label>
            <textarea
              id="closure-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value.slice(0, 2000))}
              rows={5}
              placeholder="Conclusión operativa del expediente: qué se verificó, qué quedó abierto, próximos pasos."
              className="mt-2 w-full rounded-[8px] border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none transition-colors focus:border-primary"
            />
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{summary.length}/2000</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-[8px] border border-border bg-background px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-[8px] bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {mode === "resolved" ? <ShieldCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {mode === "resolved" ? "Marcar resuelto" : "Cerrar expediente"}
          </button>
        </div>
      </div>
    </div>
  );
}
