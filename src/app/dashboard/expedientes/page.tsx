"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileWarning,
  Filter,
  MessageSquare,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useSessionContext } from "@/contexts/SessionContext";
import { useWorkCases, type WorkCaseEntry } from "@/hooks/useWorkCases";
import { cn } from "@/lib/utils";

type GroupMode = "desk" | "status" | "verdict";
type Status = WorkCaseEntry["status"];
type Verdict = NonNullable<WorkCaseEntry["verdict"]>;
type DeskLane = "attention" | "active" | "waiting" | "done";

const STATUS_ORDER: Status[] = ["open", "in_progress", "waiting", "resolved", "closed", "archived"];
const VERDICT_ORDER: (Verdict | "pending")[] = ["pending", "flagged", "inconclusive", "approved", "rejected", "superseded"];
const DESK_ORDER: DeskLane[] = ["attention", "active", "waiting", "done"];

const DESK_LABELS: Record<DeskLane, string> = {
  attention: "Para decidir",
  active: "En gestión",
  waiting: "Bloqueados o en espera",
  done: "Cerrados",
};

const DESK_DESCRIPTIONS: Record<DeskLane, string> = {
  attention: "Casos abiertos, observados o sin veredicto que necesitan lectura humana.",
  active: "Expedientes donde el agente o el equipo ya están trabajando.",
  waiting: "Dependen de evidencia, respuesta externa o validación.",
  done: "Resueltos, cerrados o archivados; sirven como trazabilidad.",
};

const STATUS_LABELS: Record<Status, string> = {
  open: "Abierto",
  in_progress: "En curso",
  waiting: "En espera",
  resolved: "Resuelto",
  closed: "Cerrado",
  archived: "Archivado",
};

const VERDICT_LABELS: Record<Verdict | "pending", string> = {
  pending: "Sin veredicto",
  approved: "Aprobado",
  flagged: "Con observaciones",
  inconclusive: "Inconcluso",
  rejected: "Rechazado",
  superseded: "Reemplazado",
};

const KIND_LABELS: Record<WorkCaseEntry["kind"], string> = {
  budget_audit: "Presupuesto",
  document_audit: "Documento",
  schedule_review: "Cronograma",
  financial_review: "Finanzas",
  hse_review: "HSE",
  supplies_review: "Acopios",
  subcontract_review: "Subcontratos",
  daily_brief: "Brief diario",
  operations_update: "Operación",
  communication: "Comunicación",
  general: "General",
  legacy_conversation: "Legacy",
};

const STATUS_TONE: Record<Status, string> = {
  open: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  in_progress: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  waiting: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
  archived: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

const VERDICT_TONE: Record<Verdict | "pending", string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  flagged: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  inconclusive: "bg-muted text-muted-foreground",
  rejected: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  superseded: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deskLane(workCase: WorkCaseEntry): DeskLane {
  if (workCase.status === "waiting") return "waiting";
  if (workCase.status === "resolved" || workCase.status === "closed" || workCase.status === "archived") return "done";
  if (workCase.status === "in_progress") return "active";
  if (workCase.verdict === "flagged" || workCase.verdict === "inconclusive" || workCase.verdict === "rejected") return "attention";
  return "attention";
}

function groupKey(workCase: WorkCaseEntry, mode: GroupMode): Status | Verdict | "pending" | DeskLane {
  if (mode === "desk") return deskLane(workCase);
  if (mode === "status") return workCase.status;
  return workCase.verdict ?? "pending";
}

export default function ExpedientesPage() {
  const router = useRouter();
  const { projects, activateProject } = useProjectContext();
  const { switchSession } = useSessionContext();
  const { data: workCases = [], isLoading, isFetching, refetch } = useWorkCases(null, 50);
  const [groupMode, setGroupMode] = useState<GroupMode>("desk");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return workCases.filter((workCase) => {
      if (statusFilter !== "all" && workCase.status !== statusFilter) return false;
      if (!needle) return true;
      const projectName = workCase.projectId ? projectsById.get(workCase.projectId)?.name ?? "" : "";
      return `${workCase.title} ${workCase.summary ?? ""} ${projectName} ${KIND_LABELS[workCase.kind]}`
        .toLowerCase()
        .includes(needle);
    });
  }, [projectsById, query, statusFilter, workCases]);

  const grouped = useMemo(() => {
    const order = groupMode === "desk" ? DESK_ORDER : groupMode === "status" ? STATUS_ORDER : VERDICT_ORDER;
    return order
      .map((key) => ({
        key,
        label:
          groupMode === "desk"
            ? DESK_LABELS[key as DeskLane]
            : groupMode === "status"
            ? STATUS_LABELS[key as Status]
            : VERDICT_LABELS[key as Verdict | "pending"],
        description: groupMode === "desk" ? DESK_DESCRIPTIONS[key as DeskLane] : null,
        items: filtered.filter((workCase) => groupKey(workCase, groupMode) === key),
      }))
      .filter((group) => group.items.length > 0);
  }, [filtered, groupMode]);

  const decisionCount = workCases.filter((workCase) => deskLane(workCase) === "attention").length;
  const activeCount = workCases.filter((workCase) => deskLane(workCase) === "active" || deskLane(workCase) === "waiting").length;
  const doneCount = workCases.filter((workCase) => deskLane(workCase) === "done").length;

  function openDetail(workCase: WorkCaseEntry) {
    if (!workCase.projectId) return;
    router.push(`/dashboard/obras/${workCase.projectId}/expedientes/${workCase.id}` as Route);
  }

  function openChat(workCase: WorkCaseEntry) {
    if (!workCase.chatSessionId) return;
    const project = workCase.projectId ? projectsById.get(workCase.projectId) : null;
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

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-background">
      <div className="border-b border-border bg-card/92 px-4 py-5 backdrop-blur md:px-8 md:py-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-primary/20 bg-primary/10 text-primary">
              <BriefcaseBusiness className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Operación y auditoría
              </p>
              <h1 className="mt-1 font-display text-[26px] font-medium leading-tight text-foreground">
                Mesa de expedientes
              </h1>
              <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
                Bandeja de trabajo para decidir, seguir y cerrar casos. Cada expediente concentra conversación, evidencia, eventos y veredicto.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <DeskPill label={`${workCases.length} expedientes`} />
                <DeskPill label={`${projects.length} obras`} />
                <DeskPill label={`${decisionCount} para decidir`} tone={decisionCount > 0 ? "warn" : "neutral"} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="ml-auto inline-flex h-9 items-center gap-2 rounded-[8px] border border-border bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <RotateCcw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricCard icon={<FileWarning className="h-4 w-4" />} label="Para decidir" value={decisionCount} />
          <MetricCard icon={<BriefcaseBusiness className="h-4 w-4" />} label="En trabajo" value={activeCount} />
          <MetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="Cerrados" value={doneCount} />
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-[10px] border border-border bg-card/70 p-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título, resumen, obra o tipo…"
              className="h-10 w-full rounded-[8px] border border-border bg-card pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedButton
              active={groupMode === "desk"}
              label="Mesa"
              onClick={() => setGroupMode("desk")}
            />
            <SegmentedButton
              active={groupMode === "status"}
              label="Estado"
              onClick={() => setGroupMode("status")}
            />
            <SegmentedButton
              active={groupMode === "verdict"}
              label="Veredicto"
              onClick={() => setGroupMode("verdict")}
            />
            <div className="flex h-10 items-center gap-2 rounded-[8px] border border-border bg-card px-3">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as Status | "all")}
                className="bg-transparent text-[12px] text-foreground outline-none"
              >
                <option value="all">Todos los estados</option>
                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-[8px] border border-border bg-card" />
            ))}
          </div>
        )}

        {!isLoading && grouped.length === 0 && (
          <div className="mt-10 rounded-[8px] border border-border bg-card px-4 py-8 text-center">
            <BriefcaseBusiness className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="mt-3 text-[14px] font-medium text-foreground">Sin expedientes para mostrar</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Los expedientes se crean desde obras, auditorías documentales y sesiones operativas.
            </p>
          </div>
        )}

        {!isLoading && grouped.length > 0 && (
          <div className="mt-6 space-y-6">
            {grouped.map((group) => (
              <section key={group.key}>
                <div className="mb-3 flex flex-wrap items-end gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {group.label}
                      </span>
                      <span className="rounded-[5px] bg-accent px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {group.items.length}
                      </span>
                    </div>
                    {group.description && (
                      <p className="mt-1 text-[12px] text-muted-foreground">{group.description}</p>
                    )}
                  </div>
                  <span className="mb-2 h-px min-w-[80px] flex-1 bg-border" />
                </div>
                <div className="overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
                  {group.items.map((workCase) => (
                    <WorkCaseRow
                      key={workCase.id}
                      workCase={workCase}
                      projectName={workCase.projectId ? projectsById.get(workCase.projectId)?.name ?? "Obra" : "Empresa"}
                      onOpenChat={openChat}
                      onOpenDetail={openDetail}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-[10px] border border-border bg-card px-4 py-3 shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.12em]">{label}</span>
      </div>
      <p className="mt-2 font-display text-[28px] font-medium leading-none text-foreground">{value}</p>
    </div>
  );
}

function DeskPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "warn" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tone === "warn"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function SegmentedButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-[8px] border px-3 text-[12px] font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function WorkCaseRow({
  workCase,
  projectName,
  onOpenChat,
  onOpenDetail,
}: {
  workCase: WorkCaseEntry;
  projectName: string;
  onOpenChat: (workCase: WorkCaseEntry) => void;
  onOpenDetail: (workCase: WorkCaseEntry) => void;
}) {
  const verdict = workCase.verdict ?? "pending";
  const needsAttention = deskLane(workCase) === "attention";
  return (
    <div className="grid gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-accent/35 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", needsAttention ? "bg-amber-500" : "bg-primary/45")} />
          <p className="min-w-0 truncate text-[13px] font-semibold text-foreground">{workCase.title}</p>
          <span className="rounded-[5px] bg-accent px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.05em] text-muted-foreground">
            {KIND_LABELS[workCase.kind]}
          </span>
          <span className={cn("rounded-[5px] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.05em]", STATUS_TONE[workCase.status])}>
            {STATUS_LABELS[workCase.status]}
          </span>
          <span className={cn("rounded-[5px] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.05em]", VERDICT_TONE[verdict])}>
            {VERDICT_LABELS[verdict]}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>{projectName}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            {formatDateTime(workCase.updatedAt)}
          </span>
          {workCase.closedAt && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>cierre {formatDateTime(workCase.closedAt)}</span>
            </>
          )}
        </div>
        {workCase.summary && (
          <p className="mt-2 line-clamp-2 max-w-3xl text-[12px] leading-relaxed text-muted-foreground">
            {workCase.summary}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <button
          type="button"
          onClick={() => onOpenDetail(workCase)}
          disabled={!workCase.projectId}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-border bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Expediente
          <ArrowUpRight className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onOpenChat(workCase)}
          disabled={!workCase.chatSessionId}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-border bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
          <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
