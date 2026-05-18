"use client";

import { use, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, MessageSquare, Building2,
  FileSpreadsheet, FileText, FileCode2, FileType2, Image,
  CheckCircle2, Circle, ChevronDown, ChevronRight,
  Pencil, Check, X, Hash, MapPin, Banknote, CalendarDays,
  BriefcaseBusiness, Clock3, ArrowUpRight,
} from "lucide-react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useSessionContext } from "@/contexts/SessionContext";
import { useProjectCoverage } from "@/hooks/useProjectCoverage";
import { useProjectFiles, type ProjectFile } from "@/hooks/useProjectFiles";
import { useProjectDetails } from "@/hooks/useProjectDetails";
import { useWorkCases, type WorkCaseEntry } from "@/hooks/useWorkCases";
import { getAuthHeaders } from "@/lib/insforge/client";
import type { PhaseCoverage } from "@/lib/obra/coverage";
import { ScheduleImportSection } from "./_components/ScheduleImportSection";

const STATUS_OPTIONS = [
  { value: "en_obra",      label: "En obra" },
  { value: "planificacion", label: "Planificación" },
  { value: "finalizado",   label: "Finalizado" },
  { value: "pausado",      label: "Pausado" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  en_obra:      "bg-[oklch(0.93_0.08_145)] text-[var(--ok)]",
  planificacion: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  finalizado:   "bg-accent text-muted-foreground",
  pausado:      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const WORK_CASE_KIND_LABELS: Record<WorkCaseEntry["kind"], string> = {
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

const WORK_CASE_STATUS_LABELS: Record<WorkCaseEntry["status"], string> = {
  open: "Abierto",
  in_progress: "En curso",
  waiting: "En espera",
  resolved: "Resuelto",
  closed: "Cerrado",
  archived: "Archivado",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FILE_ICON_MAP: Record<string, { Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; color: string; label: string }> = {
  excel:  { Icon: FileSpreadsheet, color: "text-[var(--ok)]",               label: "Excel" },
  pdf:    { Icon: FileText,        color: "text-[var(--err)]",               label: "PDF" },
  dxf:    { Icon: FileCode2,       color: "text-[oklch(0.55_0.16_235)]",     label: "DXF" },
  docx:   { Icon: FileType2,       color: "text-[oklch(0.55_0.16_245)]",     label: "DOCX" },
  image:  { Icon: Image,           color: "text-[oklch(0.74_0.15_75)]",      label: "Imagen" },
};

function FileRow({ file, index }: { file: ProjectFile; index: number }) {
  const cfg = FILE_ICON_MAP[file.file_type] ?? { Icon: FileText, color: "text-muted-foreground", label: file.file_type };
  const { Icon } = cfg;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="flex items-start gap-3 py-3"
    >
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center">
        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${cfg.color} bg-current`} />
        {index > 0 && <div className="mt-1 w-px flex-1 bg-border" style={{ height: "100%" }} />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} strokeWidth={1.5} />
          <span className="truncate text-[13px] font-medium text-foreground">{file.file_name}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>{formatDate(file.created_at)}</span>
          {file.file_size_bytes && <span>· {formatSize(file.file_size_bytes)}</span>}
          <span className="rounded-[4px] bg-accent px-1.5 py-0.5">{cfg.label}</span>
        </div>
      </div>
    </motion.div>
  );
}

function PhaseRow({ phase, index }: { phase: PhaseCoverage; index: number }) {
  const [open, setOpen] = useState(false);

  const statusColor =
    phase.status === "complete" ? "bg-[var(--ok)]"
    : phase.status === "partial"  ? "bg-[oklch(0.72_0.16_65)]"
    : "bg-border";

  const statusLabel =
    phase.status === "complete" ? "Completa"
    : phase.status === "partial"  ? "Parcial"
    : "Sin docs";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="overflow-hidden rounded-[10px] border border-border bg-card"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor}`} />
        <span className="flex-1 text-[13px] font-medium text-foreground">{phase.name}</span>
        <span className={`rounded-[6px] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${
          phase.status === "complete" ? "bg-[oklch(0.93_0.08_145)] text-[var(--ok)]"
          : phase.status === "partial"  ? "bg-[oklch(0.96_0.06_65)] text-[oklch(0.55_0.16_65)]"
          : "bg-accent text-muted-foreground"
        }`}>
          {statusLabel}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {phase.coveredDocTypes.length}/{phase.expected.length}
        </span>
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
               : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {phase.expected.map((doc) => {
            const covered = phase.coveredDocTypes.includes(doc.doc_type);
            return (
              <div key={doc.doc_type} className="flex items-center gap-2 text-[12px]">
                {covered
                  ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--ok)]" />
                  : <Circle className="h-3.5 w-3.5 shrink-0 text-border" />
                }
                <span className={covered ? "text-foreground" : "text-muted-foreground"}>
                  {doc.label}
                </span>
                {!doc.required && (
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">opcional</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function WorkCaseRow({
  workCase,
  onOpenChat,
  onOpenDetail,
}: {
  workCase: WorkCaseEntry;
  onOpenChat: (workCase: WorkCaseEntry) => void;
  onOpenDetail: (workCase: WorkCaseEntry) => void;
}) {
  const canOpenChat = Boolean(workCase.chatSessionId);

  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-border bg-background">
        <BriefcaseBusiness className="h-4 w-4 text-primary" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-semibold text-foreground">{workCase.title}</p>
          <span className="rounded-[5px] bg-accent px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.05em] text-muted-foreground">
            {WORK_CASE_KIND_LABELS[workCase.kind]}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>{WORK_CASE_STATUS_LABELS[workCase.status]}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            {formatDate(workCase.updatedAt)}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onOpenDetail(workCase)}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-border bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
      >
        Ver
        <ArrowUpRight className="h-3 w-3" />
      </button>
      <button
        type="button"
        disabled={!canOpenChat}
        onClick={() => onOpenChat(workCase)}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-border bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Abrir
        <ArrowUpRight className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ObraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { projects, activateProject } = useProjectContext();
  const { switchSession } = useSessionContext();

  const project = projects.find((p) => p.id === id);
  const { data: coverage, isLoading: coverageLoading } = useProjectCoverage(id);
  const { data: files = [], isLoading: filesLoading } = useProjectFiles(id);
  const { data: details } = useProjectDetails(id);
  const { data: workCases = [], isLoading: workCasesLoading } = useWorkCases(id);

  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [editCode, setEditCode]   = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editAmount, setEditAmount] = useState("");

  function startEdit() {
    const p = details?.project;
    setEditStatus(p?.status ?? "en_obra");
    setEditCode(p?.code ?? "");
    setEditLocation(p?.location ?? "");
    setEditAmount(p?.contract_amount != null ? String(p.contract_amount) : "");
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({
        status: editStatus,
        code: editCode.trim() || null,
        location: editLocation.trim() || null,
        contract_amount: editAmount.trim() ? parseFloat(editAmount.replace(/[^0-9.]/g, "")) : null,
      }),
    });
    await queryClient.invalidateQueries({ queryKey: ["project-details", id] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
    setSaving(false);
    setEditing(false);
  }

  function handleConverse() {
    if (project) activateProject(project);
    router.push("/dashboard/chat");
  }

  function handleOpenWorkCaseChat(workCase: WorkCaseEntry) {
    if (!workCase.chatSessionId) return;
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

  function handleOpenWorkCaseDetail(workCase: WorkCaseEntry) {
    router.push(`/dashboard/obras/${id}/expedientes/${workCase.id}` as Route);
  }

  const projectName = project?.name ?? "Obra";
  const meta = details?.project;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-background">

      {/* Header */}
      <div className="border-b border-border bg-card px-8 py-5">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard/obras")}
              className="flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Mis Obras
            </button>
            <span className="text-muted-foreground/40">/</span>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <h1 className="font-display text-[18px] font-medium tracking-[-0.01em] text-foreground">
                {projectName}
              </h1>
            </div>

            <div className="ml-auto flex items-center gap-3">
              {coverage && (
                <div className="flex items-center gap-2 rounded-[8px] border border-border bg-background px-3 py-1.5">
                  <span className={`h-2 w-2 rounded-full ${
                    coverage.overallPct === 100 ? "bg-[var(--ok)]"
                    : coverage.overallPct > 0   ? "bg-[oklch(0.72_0.16_65)]"
                    : "bg-border"
                  }`} />
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {coverage.overallPct}% cobertura
                  </span>
                </div>
              )}
              <button
                onClick={() => router.push(`/dashboard/obras/${id}/today` as Route)}
                className="flex items-center gap-2 rounded-[10px] border border-border bg-background px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <CalendarDays className="h-4 w-4" />
                Día en la obra
              </button>
              <button
                onClick={handleConverse}
                className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <MessageSquare className="h-4 w-4" />
                Conversar sobre esta obra
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Metadata band */}
      <div className="border-b border-border bg-background/60 px-8 py-3">
        <div className="mx-auto max-w-5xl">
          {!editing ? (
            <div className="flex items-center gap-4 flex-wrap">
              {meta?.status && (
                <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${STATUS_COLORS[meta.status] ?? "bg-accent text-muted-foreground"}`}>
                  {STATUS_OPTIONS.find((s) => s.value === meta.status)?.label ?? meta.status}
                </span>
              )}
              {meta?.code && (
                <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  <Hash className="h-3 w-3" />{meta.code}
                </span>
              )}
              {meta?.location && (
                <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  <MapPin className="h-3 w-3" />{meta.location}
                </span>
              )}
              {meta?.contract_amount != null && (
                <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  <Banknote className="h-3 w-3" />
                  {Number(meta.contract_amount).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}
                </span>
              )}
              <button
                onClick={startEdit}
                className="ml-auto flex items-center gap-1.5 rounded-[8px] border border-border px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
              >
                <Pencil className="h-3 w-3" />
                Editar datos
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Estado</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="rounded-[8px] border border-border bg-background px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Código</label>
                <input value={editCode} onChange={(e) => setEditCode(e.target.value)} placeholder="OP-001"
                  className="w-24 rounded-[8px] border border-border bg-background px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/40" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Ubicación</label>
                <input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Ciudad, Provincia"
                  className="w-44 rounded-[8px] border border-border bg-background px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/40" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Monto contrato</label>
                <input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} placeholder="0.00"
                  className="w-32 rounded-[8px] border border-border bg-background px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/40" />
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <button onClick={() => { void saveEdit(); }} disabled={saving}
                  className="flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-opacity disabled:opacity-50 hover:opacity-90">
                  {saving ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <Check className="h-3 w-3" />}
                  Guardar
                </button>
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1 rounded-[8px] border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent">
                  <X className="h-3 w-3" /> Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Body — two columns */}
      <div className="mx-auto w-full max-w-5xl px-8 py-8">
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground shrink-0">
              Expedientes operativos
            </span>
            <span className="h-px flex-1 bg-border" />
            {!workCasesLoading && (
              <span className="font-mono text-[10px] text-muted-foreground/60">{workCases.length}</span>
            )}
          </div>

          {workCasesLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-[10px] border border-border bg-card" />
              ))}
            </div>
          )}

          {!workCasesLoading && workCases.length === 0 && (
            <div className="rounded-[12px] border border-dashed border-border px-6 py-8 text-center">
              <p className="text-[13px] text-muted-foreground">Todavía no hay expedientes asociados a esta obra.</p>
            </div>
          )}

          {!workCasesLoading && workCases.length > 0 && (
            <div className="overflow-hidden rounded-[12px] border border-border bg-card">
              {workCases.slice(0, 6).map((workCase) => (
                <WorkCaseRow
                  key={workCase.id}
                  workCase={workCase}
                  onOpenChat={handleOpenWorkCaseChat}
                  onOpenDetail={handleOpenWorkCaseDetail}
                />
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">

          {/* ── Left: file timeline ─────────────────────────────── */}
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground shrink-0">
                Documentos subidos
              </span>
              <span className="h-px flex-1 bg-border" />
              {!filesLoading && (
                <span className="font-mono text-[10px] text-muted-foreground/60">{files.length}</span>
              )}
            </div>

            {filesLoading && (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-[8px] bg-card border border-border" />
                ))}
              </div>
            )}

            {!filesLoading && files.length === 0 && (
              <div className="rounded-[12px] border border-dashed border-border px-6 py-10 text-center">
                <p className="text-[13px] text-muted-foreground">
                  No hay archivos subidos a esta obra todavía.
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground/60">
                  Activá la obra y subí documentos desde el asistente.
                </p>
              </div>
            )}

            {!filesLoading && files.length > 0 && (
              <div className="divide-y divide-border rounded-[12px] border border-border bg-card px-4">
                {files.map((file, i) => (
                  <FileRow key={file.id} file={file} index={i} />
                ))}
              </div>
            )}
          </div>

          {/* ── Right: phase coverage ───────────────────────────── */}
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground shrink-0">
                Cobertura por fase
              </span>
              <span className="h-px flex-1 bg-border" />
              {coverage && (
                <span className="font-mono text-[10px] text-muted-foreground/60">
                  {coverage.completePhases}/{coverage.totalPhases} completas
                </span>
              )}
            </div>

            {coverageLoading && (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-[10px] border border-border bg-card" />
                ))}
              </div>
            )}

            {!coverageLoading && coverage && (
              <div className="space-y-2">
                {coverage.phases.map((phase, i) => (
                  <PhaseRow key={phase.key} phase={phase} index={i} />
                ))}
              </div>
            )}

            {/* Next suggestion */}
            {!coverageLoading && coverage?.nextSuggestion && (
              <div className="mt-4 rounded-[10px] border border-primary/20 bg-primary/[0.04] px-4 py-3">
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-primary">Sugerencia: </span>
                  {coverage.nextSuggestion}
                </p>
              </div>
            )}
          </div>

        </div>

        <ScheduleImportSection projectId={id} />
      </div>
    </div>
  );
}
