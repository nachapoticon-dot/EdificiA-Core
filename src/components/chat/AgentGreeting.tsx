"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Upload, ChevronRight, Plus, Building2,
  FileSpreadsheet, FileText, FileCode2, FileType2, Image, MessageSquare,
} from "lucide-react";
import { useSessionHistory, type SessionEntry } from "@/hooks/useSessionHistory";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useProjectCoverage } from "@/hooks/useProjectCoverage";
import type { Project } from "@/hooks/useProjects";

interface AgentGreetingProps {
  userName?: string;
  onQuickAction: (text: string) => void;
  onSessionSelect: (entry: SessionEntry) => void;
  onFileSelect?: (file: File) => void;
}

const QUICK_PROMPTS = [
  "¿Qué incidencia tiene el rubro estructura?",
  "Compará este presupuesto con el promedio del sector",
  "Detectá ítems duplicados o inconsistencias",
  "Calculá m² de revoque grueso necesarios",
];

const FILE_ICONS: Record<string, { Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; color: string }> = {
  excel: { Icon: FileSpreadsheet, color: "text-[var(--ok)]" },
  pdf:   { Icon: FileText,        color: "text-[var(--err)]" },
  dxf:   { Icon: FileCode2,       color: "text-[oklch(0.55_0.16_235)]" },
  docx:  { Icon: FileType2,       color: "text-[oklch(0.55_0.16_245)]" },
  image: { Icon: Image,           color: "text-[oklch(0.74_0.15_75)]" },
};

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ayer" : `hace ${days}d`;
}

function fileTypeSummary(fileType?: SessionEntry["fileType"]): string {
  const map: Record<string, string> = { excel: "xlsx", pdf: "pdf", dxf: "dxf", docx: "docx", image: "imagen" };
  return map[fileType ?? ""] ?? "conversación";
}

const ACCEPTED_EXTENSIONS = ".xlsx,.xls,.csv,.pdf,.dxf,.docx,.doc,.png,.jpg,.jpeg,.gif,.webp";

export function AgentGreeting({ userName, onQuickAction, onSessionSelect, onFileSelect }: AgentGreetingProps) {
  const firstName = userName?.split(" ")[0];
  const { sessions } = useSessionHistory();
  const { projects, activeProject, createProject, activateProject, isLoading, isCreating } = useProjectContext();
  const { data: coverage } = useProjectCoverage(activeProject?.id ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [timeGreeting, setTimeGreeting] = useState("Hola");
  const [newProjectName, setNewProjectName] = useState("");

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelect?.(file);
    e.target.value = "";
  }

  useEffect(() => {
    const h = new Date().getHours();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeGreeting(h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches");
  }, []);

  const fullGreeting = firstName ? `${timeGreeting}, ${firstName}.` : `${timeGreeting}.`;

  if (isLoading) return null;

  function handleCreateProject() {
    if (!newProjectName.trim()) return;
    createProject(newProjectName.trim());
    setNewProjectName("");
  }

  /* ── PROJECT PICKER — no active project ─────────────────────── */
  if (!activeProject) {
    return (
      <div className="py-4">
        <div className="mx-auto max-w-[720px] px-6">

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
            className="mb-5 flex items-center justify-center gap-3"
          >
            <span className="h-px w-4 bg-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary">
              EdificIA · v0.6 · auditoría asistida
            </span>
            <span className="h-px w-4 bg-primary" />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.45 }}
            className="mb-8 text-center"
          >
            <h1 className="font-display text-[38px] font-normal leading-[1.05] tracking-[-0.02em] text-foreground">
              {fullGreeting}
            </h1>
            <h2 className="font-display text-[38px] font-normal leading-[1.05] tracking-[-0.02em] text-primary">
              ¿En qué obra trabajamos hoy?
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Seleccioná un proyecto o creá uno nuevo para empezar.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>

            {/* Existing projects */}
            {projects.length > 0 && (
              <div className="mb-4">
                <SectionLabel>Proyectos</SectionLabel>
                <div className="mt-3 overflow-hidden rounded-[10px] border border-border bg-card">
                  {projects.map((project, i) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      isLast={i === projects.length - 1}
                      onClick={() => activateProject(project)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* New project input */}
            <div className="mt-3">
              {projects.length > 0 && (
                <SectionLabel>Nueva obra</SectionLabel>
              )}
              <div className={`flex gap-2 ${projects.length > 0 ? "mt-3" : ""}`}>
                <div className="relative flex-1">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                    placeholder="Nombre de la obra o proyecto…"
                    className="w-full rounded-[10px] border border-border bg-card py-3 pl-10 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    autoFocus={projects.length === 0}
                  />
                </div>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || isCreating}
                  className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-3 text-[13px] font-semibold text-primary-foreground transition-opacity disabled:opacity-40 hover:opacity-90"
                >
                  {isCreating
                    ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    : <Plus className="h-4 w-4" />
                  }
                  {isCreating ? "Creando…" : "Crear"}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="my-8 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                o subí un archivo directamente
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            {/* Dropzone CTA */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group w-full rounded-[14px] border border-dashed border-primary/40 bg-primary/[0.03] py-8 text-center transition-all hover:border-primary/60 hover:bg-primary/[0.07]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={handleFileInputChange}
              />
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-primary/10 text-primary transition-colors group-hover:bg-primary/[0.16]">
                  <Upload className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    Arrastrá tu archivo o{" "}
                    <span className="text-primary underline underline-offset-2">seleccionalo</span>
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    XLSX · PDF · DXF · DOCX · PNG/JPG · máx. 50 MB
                  </p>
                </div>
              </div>
            </button>

          </motion.div>
        </div>
      </div>
    );
  }

  /* ── NORMAL WELCOME — project selected ───────────────────────── */
  return (
    <div className="py-4">
      <div className="mx-auto max-w-[720px] px-6">

        {/* Eyebrow */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
          className="mb-5 flex items-center justify-center gap-3"
        >
          <span className="h-px w-4 bg-primary" />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary">
            {activeProject.name} · v0.6 · auditoría asistida
          </span>
          <span className="h-px w-4 bg-primary" />
        </motion.div>

        {/* Headline */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.5 }}
          className="mb-3 text-center"
        >
          <h1 className="font-display text-[40px] font-normal leading-[1.05] tracking-[-0.02em] text-foreground">
            {fullGreeting}
          </h1>
          <h2 className="font-display text-[40px] font-normal leading-[1.05] tracking-[-0.02em]">
            <em className="not-italic text-primary">¿Qué hacemos</em>{" "}
            <span className="text-foreground">hoy?</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Cargá un documento o preguntá sobre{" "}
            <span className="font-medium text-foreground">{activeProject.name}</span>.
          </p>
        </motion.div>

        {/* Hero dropzone */}
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.45 }}
          onClick={() => fileInputRef.current?.click()}
          className="group mt-6 w-full rounded-[14px] border border-dashed border-primary/40 bg-primary/[0.03] py-10 text-center transition-all hover:border-primary/60 hover:bg-primary/[0.07]"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={handleFileInputChange}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-primary/10 text-primary transition-colors group-hover:bg-primary/[0.16]">
              <Upload className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Arrastrá tu archivo o{" "}
                <span className="text-primary underline underline-offset-2">seleccionalo</span>
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                XLSX · PDF · DXF · DOCX · PNG/JPG · máx. 50 MB
              </p>
            </div>
          </div>
        </motion.button>

        {/* Or divider */}
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">o preguntá directamente</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* Sample prompt chips */}
        <div className="flex flex-wrap justify-center gap-2">
          {QUICK_PROMPTS.map((p) => (
            <button key={p} onClick={() => onQuickAction(p)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground"
            >
              <ArrowRight className="h-3 w-3 text-primary" />
              <span>{p}</span>
            </button>
          ))}
        </div>

        {/* Cobertura documental de la obra */}
        {coverage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Estado de la obra</SectionLabel>
              <span className="font-mono text-[10px] text-muted-foreground">
                {coverage.completePhases}/{coverage.totalPhases} fases completas
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {coverage.phases.map((phase) => (
                <button
                  key={phase.key}
                  onClick={() => onQuickAction(`¿Qué falta documentar en la fase de ${phase.name}?`)}
                  title={phase.missingRequired.length > 0
                    ? `Falta: ${phase.missingRequired.map(d => d.label).join(", ")}`
                    : "Fase completa"
                  }
                  className="flex items-center gap-1.5 rounded-[6px] border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${
                    phase.status === "complete" ? "bg-[var(--ok)]" :
                    phase.status === "partial"  ? "bg-[oklch(0.72_0.16_65)]" :
                                                  "bg-border"
                  }`} />
                  <span className="text-muted-foreground">{phase.name}</span>
                </button>
              ))}
            </div>
            {coverage.nextSuggestion && (
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-primary">Sugerencia: </span>
                {coverage.nextSuggestion}
              </p>
            )}
            <button
              onClick={() => onQuickAction(`Analizá el estado actual de la obra "${activeProject.name}" y decime qué falta documentar en cada fase.`)}
              className="mt-3 flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/[0.04] px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/[0.09]"
            >
              <ArrowRight className="h-3 w-3" />
              Analizar estado con el agente
            </button>
          </motion.div>
        )}

        {/* Trabajos recientes — filtrados por proyecto activo */}
        {(() => {
          const projectSessions = sessions.filter(s => s.projectId === activeProject?.id);
          if (projectSessions.length === 0) return null;
          return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
            className="mt-10"
          >
            <SectionLabel>Trabajos recientes</SectionLabel>
            <div className="mt-3 overflow-hidden rounded-[10px] border border-border bg-card">
              {projectSessions.slice(0, 5).map((s, i) => {
                const cfg = FILE_ICONS[s.fileType ?? ""];
                const Icon = cfg?.Icon ?? MessageSquare;
                const iconColor = cfg?.color ?? "text-muted-foreground";
                const isLast = i === Math.min(projectSessions.length, 5) - 1;
                return (
                  <button key={s.id} onClick={() => onSessionSelect(s)}
                    className={`flex w-full items-center gap-3 px-4 py-[10px] text-left text-[13px] transition-colors hover:bg-accent ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} strokeWidth={1.5} />
                    <span className="flex-1 truncate text-foreground">{s.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{fileTypeSummary(s.fileType)}</span>
                    <span className="w-14 shrink-0 text-right font-mono text-[10px] text-muted-foreground/60">
                      {formatRelative(s.startedAt)}
                    </span>
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                  </button>
                );
              })}
            </div>
          </motion.div>
          );
        })()}

      </div>
    </div>
  );
}

/* ── Shared sub-components ───────────────────────────────────── */

function ProjectRow({ project, isLast, onClick }: { project: Project; isLast: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/[0.04] ${!isLast ? "border-b border-border" : ""}`}
    >
      <Building2 className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
      <span className="flex-1 truncate text-[13px] font-medium text-foreground">{project.name}</span>
      <span className="font-mono text-[10px] text-muted-foreground/60">
        {formatRelative(project.lastActiveAt)}
      </span>
      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground shrink-0">
        {children}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

