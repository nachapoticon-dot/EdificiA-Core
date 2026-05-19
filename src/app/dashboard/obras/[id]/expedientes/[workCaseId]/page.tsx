"use client";

import { use, useState } from "react";
import type { ReactNode } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Activity,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Database,
  FileText,
  Gavel,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Lock,
  RotateCcw,
  Wrench,
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
import type { WorkCaseVerdict } from "@/lib/validators/api-responses";
import { cn } from "@/lib/utils";

type WorkCase = NonNullable<WorkCaseDetail>["workCase"];
type WorkCaseEvent = NonNullable<WorkCaseDetail>["events"][number];
type WorkCaseEvidence = NonNullable<WorkCaseDetail>["evidence"][number];
type DocumentReport = NonNullable<WorkCaseDetail>["documentReports"][number];
type AgentRun = NonNullable<WorkCaseDetail>["agentRuns"][number];

const KIND_LABELS: Record<WorkCase["kind"], string> = {
  budget_audit: "Auditoría de presupuesto",
  document_audit: "Auditoría documental",
  schedule_review: "Cronograma",
  financial_review: "Finanzas",
  hse_review: "HSE",
  supplies_review: "Acopios",
  subcontract_review: "Subcontratos",
  daily_brief: "Brief diario",
  operations_update: "Actualización operativa",
  communication: "Comunicación",
  general: "General",
  legacy_conversation: "Conversación legacy",
};

const STATUS_LABELS: Record<WorkCase["status"], string> = {
  open: "Abierto",
  in_progress: "En curso",
  waiting: "En espera",
  resolved: "Resuelto",
  closed: "Cerrado",
  archived: "Archivado",
};

const VERDICT_LABELS: Record<WorkCaseVerdict, string> = {
  approved: "Aprobado",
  flagged: "Con observaciones",
  inconclusive: "Inconcluso",
  rejected: "Rechazado",
  superseded: "Reemplazado",
};

const VERDICT_TONE: Record<WorkCaseVerdict, string> = {
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  flagged: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  inconclusive: "bg-muted text-muted-foreground",
  rejected: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  superseded: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const REPORT_VERDICT_LABELS: Record<DocumentReport["verdict"], string> = {
  consistent: "Consistente",
  inconsistent: "Inconsistente",
  needs_review: "Requiere revisión",
  unsupported: "No soportado",
};

const REPORT_VERDICT_TONE: Record<DocumentReport["verdict"], string> = {
  consistent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  inconsistent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  needs_review: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  unsupported: "bg-muted text-muted-foreground",
};

const EVENT_LABELS: Record<string, string> = {
  "chat_session.linked": "Sesión asociada",
  "chat_session.legacy_linked": "Sesión legacy migrada",
  "chat.turn_completed": "Turno completado",
  "work_case.status_changed": "Cambio de estado",
};

const EVIDENCE_LABELS: Record<WorkCaseEvidence["evidenceType"], string> = {
  file: "Archivo",
  chunk: "Fragmento",
  relation: "Relación",
  audit_event: "Evento auditado",
  tool_run: "Ejecución de tool",
  finding: "Hallazgo",
  message: "Mensajes",
  schedule_task: "Tarea",
  hse_record: "HSE",
  supply_item: "Acopio",
  financial_snapshot: "Snapshot financiero",
  subcontract: "Subcontrato",
  document_report: "Reporte documental",
  external: "Externo",
};

const CLOSURE_VERDICT_OPTIONS: WorkCaseVerdict[] = [
  "approved",
  "flagged",
  "inconclusive",
  "rejected",
  "superseded",
];

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
                Expediente operativo · {projectName}
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <Metric icon={BriefcaseBusiness} label="Tipo" value={KIND_LABELS[detail.workCase.kind]} />
              <Metric icon={ShieldCheck} label="Estado" value={STATUS_LABELS[detail.workCase.status]} />
              <Metric icon={ClipboardList} label="Eventos" value={String(detail.events.length)} />
              <Metric icon={Database} label="Evidencias" value={String(detail.evidence.length)} />
              <Metric icon={RefreshCw} label="Runs" value={String(detail.agentRuns.length)} />
            </div>

            {(detail.workCase.verdict || detail.workCase.summary || detail.workCase.closedAt) && (
              <ClosureSummary workCase={detail.workCase} />
            )}

            {detail.documentReports.length > 0 && (
              <section className="rounded-[10px] border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-[13px] font-semibold text-foreground">Reportes documentales</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Clasificación, riesgos y veredicto extraídos de cada documento vinculado al expediente.
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {detail.documentReports.map((report) => (
                    <DocumentReportRow
                      key={report.id}
                      report={report}
                      agentRuns={detail.agentRuns}
                      evidence={detail.evidence}
                    />
                  ))}
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
              <section className="rounded-[10px] border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-[13px] font-semibold text-foreground">Replay de auditoría</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Ejecuciones del agente, tools usadas y eventos registrados para el expediente.</p>
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

              <section className="rounded-[10px] border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-[13px] font-semibold text-foreground">Evidencia vinculada</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Fuentes y objetos usados como soporte del expediente.</p>
                </div>
                {detail.evidence.length === 0 ? (
                  <EmptyState text="Sin evidencia vinculada todavía." />
                ) : (
                  <div className="divide-y divide-border">
                    {detail.evidence.map((item) => (
                      <EvidenceRow key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </section>
            </div>
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

function DocumentReportRow({
  report,
  agentRuns,
  evidence,
}: {
  report: DocumentReport;
  agentRuns: AgentRun[];
  evidence: WorkCaseEvidence[];
}) {
  const [open, setOpen] = useState(false);
  const confidencePct = report.confidence == null ? null : Math.round(Number(report.confidence) * 100);
  return (
    <div className="px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-3 text-left"
      >
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.6} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-foreground">
              {report.fileName ?? "Documento"}
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", REPORT_VERDICT_TONE[report.verdict])}>
              {REPORT_VERDICT_LABELS[report.verdict]}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {report.documentType}
            </span>
          </span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {formatDateTime(report.createdAt)}
            {confidencePct != null ? ` · confianza ${confidencePct}%` : ""}
            {report.risks.length > 0 ? ` · ${report.risks.length} riesgo(s)` : ""}
            {report.findings.length > 0 ? ` · ${report.findings.length} hallazgo(s)` : ""}
          </span>
          {report.summary && (
            <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">{report.summary}</span>
          )}
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {report.findings.length > 0 && (
            <ReportList title="Hallazgos" items={report.findings as Record<string, unknown>[]} report={report} agentRuns={agentRuns} evidence={evidence} />
          )}
          {report.risks.length > 0 && (
            <ReportList title="Riesgos" items={report.risks as Record<string, unknown>[]} report={report} agentRuns={agentRuns} evidence={evidence} />
          )}
          <details className="rounded-[8px] border border-border bg-background p-3 text-[11px] text-muted-foreground">
            <summary className="cursor-pointer text-[11px] font-semibold text-foreground">Clasificación y extracción</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(
                { classification: report.classification, extraction: report.extraction, metadata: report.metadata },
                null,
                2,
              )}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

function ReportList({
  title,
  items,
  report,
  agentRuns,
  evidence,
}: {
  title: string;
  items: Record<string, unknown>[];
  report: DocumentReport;
  agentRuns: AgentRun[];
  evidence: WorkCaseEvidence[];
}) {
  const [selected, setSelected] = useState<{ item: Record<string, unknown>; index: number } | null>(null);
  const linkedEvidence = evidence.filter((item) => item.entityId === report.id || item.metadata?.fileId === report.fileId);
  const latestRun = agentRuns[0] ?? null;

  return (
    <>
      <div className="rounded-[8px] border border-border bg-background p-3">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        </div>
        <ul className="mt-2 space-y-1.5">
          {items.map((item, index) => {
            const message = getFindingMessage(item);
            const severity = typeof item.severity === "string" ? item.severity : null;
            return (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => setSelected({ item, index })}
                  className="flex w-full items-start gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] leading-snug text-foreground transition-colors hover:bg-muted"
                >
                  <span className="min-w-0 flex-1">
                    {severity && (
                      <span className="mr-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {severity}
                      </span>
                    )}
                    {message}
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold text-primary">Por qué</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {selected && (
        <FindingWhyModal
          title={title}
          item={selected.item}
          index={selected.index}
          report={report}
          agentRun={latestRun}
          linkedEvidence={linkedEvidence}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function FindingWhyModal({
  title,
  item,
  index,
  report,
  agentRun,
  linkedEvidence,
  onClose,
}: {
  title: string;
  item: Record<string, unknown>;
  index: number;
  report: DocumentReport;
  agentRun: AgentRun | null;
  linkedEvidence: WorkCaseEvidence[];
  onClose: () => void;
}) {
  const message = getFindingMessage(item);
  const severity = typeof item.severity === "string" ? item.severity : "sin severidad";
  const rawEvidence = isRecord(item.evidence) ? item.evidence : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-[10px] border border-border bg-card shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Por qué · {title} #{index + 1}
            </p>
            <h2 className="mt-1 text-[15px] font-semibold leading-snug text-foreground">{message}</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Fuente: {report.fileName ?? "Documento"} · {report.documentType} · {severity}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(86vh-76px)] space-y-4 overflow-y-auto px-5 py-4">
          <WhySection title="Evidencia principal">
            {rawEvidence ? (
              <KeyValueGrid value={rawEvidence} />
            ) : (
              <p className="text-[12px] text-muted-foreground">El hallazgo no trae un bloque de evidencia estructurada.</p>
            )}
          </WhySection>

          <WhySection title="Reporte documental">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <SmallFact label="Veredicto" value={REPORT_VERDICT_LABELS[report.verdict]} />
              <SmallFact label="Confianza" value={report.confidence == null ? "Sin dato" : `${Math.round(report.confidence * 100)}%`} />
              <SmallFact label="Generado" value={formatDateTime(report.createdAt)} />
            </div>
            {report.summary && <p className="mt-3 text-[12px] leading-relaxed text-foreground">{report.summary}</p>}
          </WhySection>

          <WhySection title="Evidencia vinculada">
            {linkedEvidence.length > 0 ? (
              <div className="space-y-2">
                {linkedEvidence.slice(0, 5).map((evidenceItem) => (
                  <div key={evidenceItem.id} className="rounded-[8px] border border-border bg-background px-3 py-2">
                    <p className="text-[12px] font-semibold text-foreground">{evidenceItem.label ?? evidenceItem.entityType}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {EVIDENCE_LABELS[evidenceItem.evidenceType]} · {formatDateTime(evidenceItem.createdAt)}
                      {evidenceItem.confidence != null ? ` · confianza ${Math.round(evidenceItem.confidence * 100)}%` : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">No hay evidencia adicional vinculada a este reporte.</p>
            )}
          </WhySection>

          <WhySection title="Ejecución del agente">
            {agentRun ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <SmallFact label="Modelo" value={agentRun.model} />
                  <SmallFact label="Tier" value={agentRun.tier} />
                  <SmallFact label="Tools" value={String(agentRun.toolCallsTotal)} />
                  <SmallFact label="Latencia" value={`${agentRun.latencyMs} ms`} />
                </div>
                {agentRun.toolTelemetry.length > 0 && (
                  <pre className="max-h-48 overflow-auto rounded-[8px] border border-border bg-background p-3 text-[11px] leading-relaxed text-muted-foreground">
                    {JSON.stringify(agentRun.toolTelemetry, null, 2)}
                  </pre>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">Este hallazgo proviene del escaneo documental, sin ejecución de agente asociada.</p>
            )}
          </WhySection>

          <details className="rounded-[8px] border border-border bg-background p-3 text-[11px] text-muted-foreground">
            <summary className="cursor-pointer text-[11px] font-semibold text-foreground">Payload raw del hallazgo</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(item, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

function WhySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[8px] border border-border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-border bg-background px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-[12px] font-medium text-foreground">{value}</p>
    </div>
  );
}

function KeyValueGrid({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value);
  if (entries.length === 0) return <p className="text-[12px] text-muted-foreground">Sin campos.</p>;

  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {entries.map(([key, entry]) => (
        <div key={key} className="rounded-[8px] border border-border bg-background px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{key}</dt>
          <dd className="mt-1 break-words text-[12px] text-foreground">{formatUnknown(entry)}</dd>
        </div>
      ))}
    </dl>
  );
}

function getFindingMessage(item: Record<string, unknown>): string {
  return (
    (typeof item.message === "string" && item.message) ||
    (typeof item.detail === "string" && item.detail) ||
    (typeof item.type === "string" && item.type) ||
    "Sin detalle"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatUnknown(value: unknown): string {
  if (value == null) return "Sin dato";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

type ToolRow = { tool: string; calls: number; errors: number; retries: number };

function normalizeToolRows(value: unknown): ToolRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const tool = typeof item.tool === "string" ? item.tool : null;
    if (!tool) return [];
    return [{
      tool,
      calls: typeof item.calls === "number" ? item.calls : 0,
      errors: typeof item.errors === "number" ? item.errors : 0,
      retries: typeof item.retries === "number" ? item.retries : 0,
    }];
  });
}

function formatToolName(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeUsage(usage: Record<string, unknown>): string {
  const total =
    (typeof usage.totalTokens === "number" && usage.totalTokens) ||
    (typeof usage.total_tokens === "number" && usage.total_tokens) ||
    (typeof usage.tokens === "number" && usage.tokens) ||
    null;
  return total == null ? "Sin dato" : String(total);
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
  const [open, setOpen] = useState(false);
  const toolRows = normalizeToolRows(run.toolTelemetry);
  const hasErrors = run.toolErrorsTotal > 0;

  return (
    <div className="px-4 py-3">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-start gap-3 text-left">
        <Activity className={cn("mt-0.5 h-4 w-4 shrink-0", hasErrors ? "text-amber-500" : "text-primary")} strokeWidth={1.7} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">Ejecución del agente</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {run.tier}
            </span>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              hasErrors ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            )}>
              {hasErrors ? "con errores" : run.status}
            </span>
          </span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {formatDateTime(run.finishedAt)} · {run.model} · {run.steps}/{run.stepBudget} pasos · {run.toolCallsTotal} tool call(s) · {run.latencyMs} ms
          </span>
          {run.routeReason && (
            <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">{run.routeReason}</span>
          )}
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SmallFact label="Tools" value={String(run.toolCallsTotal)} />
            <SmallFact label="Errores" value={String(run.toolErrorsTotal)} />
            <SmallFact label="Reintentos" value={String(run.toolRetriesTotal)} />
            <SmallFact label="Tokens" value={summarizeUsage(run.usage)} />
          </div>

          {toolRows.length > 0 ? (
            <div className="rounded-[8px] border border-border bg-background p-3">
              <div className="flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-primary" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tools ejecutadas</p>
              </div>
              <ol className="mt-2 space-y-1.5">
                {toolRows.map((tool, index) => (
                  <li key={`${tool.tool}-${index}`} className="flex items-center gap-2 rounded-[6px] bg-card px-2 py-1.5 text-[12px]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{formatToolName(tool.tool)}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{tool.calls} call(s)</span>
                    {tool.errors > 0 && <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">{tool.errors} err</span>}
                    {tool.retries > 0 && <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600">{tool.retries} retry</span>}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="rounded-[8px] border border-border bg-background p-3 text-[12px] text-muted-foreground">El turno no registró tools.</p>
          )}

          <details className="rounded-[8px] border border-border bg-background p-3 text-[11px] text-muted-foreground">
            <summary className="cursor-pointer text-[11px] font-semibold text-foreground">Payload técnico del run</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(
                {
                  id: run.id,
                  requestId: run.requestId,
                  modelProvider: run.modelProvider,
                  model: run.model,
                  tier: run.tier,
                  capabilityIds: run.capabilityIds,
                  usage: run.usage,
                  toolTelemetry: run.toolTelemetry,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </div>
      )}
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

function EvidenceRow({ item }: { item: WorkCaseEvidence }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-4 py-3">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-start gap-3 text-left">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.6} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-foreground">{item.label ?? item.entityType}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {EVIDENCE_LABELS[item.evidenceType]} · {formatDateTime(item.createdAt)}
            {item.confidence != null ? ` · confianza ${Math.round(item.confidence * 100)}%` : ""}
          </span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-[8px] border border-border bg-background p-3 text-[11px] leading-relaxed text-muted-foreground">
          {JSON.stringify({ entityType: item.entityType, entityId: item.entityId, metadata: item.metadata }, null, 2)}
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
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="h-96 animate-pulse rounded-[10px] border border-border bg-card" />
        <div className="h-96 animate-pulse rounded-[10px] border border-border bg-card" />
      </div>
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
              {CLOSURE_VERDICT_OPTIONS.map((option) => {
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
