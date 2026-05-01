"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Upload, ChevronRight, Plus, Building2,
  FileSpreadsheet, FileText, FileCode2, FileType2, Image, MessageSquare,
} from "lucide-react";
import { useSessionHistory, type SessionEntry } from "@/hooks/useSessionHistory";
import { useProjectContext } from "@/contexts/ProjectContext";
import type { Project } from "@/hooks/useProjects";

interface AgentGreetingProps {
  userName?: string;
  onQuickAction: (text: string) => void;
  onSessionSelect: (entry: SessionEntry) => void;
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

export function AgentGreeting({ userName, onQuickAction, onSessionSelect }: AgentGreetingProps) {
  const firstName = userName?.split(" ")[0];
  const { sessions } = useSessionHistory();
  const { projects, activeProject, createProject, activateProject, isLoading, isCreating } = useProjectContext();

  const [timeGreeting, setTimeGreeting] = useState("Hola");
  const [newProjectName, setNewProjectName] = useState("");

  useEffect(() => {
    const h = new Date().getHours();
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
      <div className="flex flex-col items-center px-6 py-12 pb-6">
        <div className="w-full max-w-[620px]">

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
            <div className="relative overflow-hidden rounded-[14px] border border-dashed border-primary/40 bg-primary/[0.04] px-8 py-6">
              <CornerTicks />
              <div className="flex items-center gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                  <Upload className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    Arrastrá tu archivo o{" "}
                    <span className="cursor-pointer text-primary underline underline-offset-2">seleccionalo</span>
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    XLSX · PDF · DXF · DOCX · PNG/JPG &nbsp;·&nbsp; máx. 50 MB
                  </p>
                </div>
              </div>
            </div>

          </motion.div>
        </div>
      </div>
    );
  }

  /* ── NORMAL WELCOME — project selected ───────────────────────── */
  return (
    <div className="flex flex-col items-center px-6 py-12 pb-6">
      <div className="w-full max-w-[680px]">

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
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.45 }}
          className="relative mt-8 overflow-hidden rounded-[14px] border border-dashed border-primary/40 bg-primary/[0.04] px-8 py-7"
        >
          <CornerTicks />
          <div className="flex items-center gap-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] bg-primary text-primary-foreground shadow-sm">
              <Upload className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Arrastrá tu archivo o{" "}
                <span className="cursor-pointer text-primary underline underline-offset-2">seleccionalo</span>
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                XLSX · PDF · DXF · DOCX · PNG/JPG &nbsp;·&nbsp; máx. 50 MB
              </p>
            </div>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/50 sm:block"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              INPUT — 01
            </span>
          </div>
        </motion.div>

        {/* Or divider */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          className="my-6 flex items-center gap-3"
        >
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">o preguntá directamente</span>
          <span className="h-px flex-1 bg-border" />
        </motion.div>

        {/* Sample prompt chips */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2"
        >
          {QUICK_PROMPTS.map((p) => (
            <button key={p} onClick={() => onQuickAction(p)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground"
            >
              <ArrowRight className="h-3 w-3 text-primary" />
              <span>{p}</span>
            </button>
          ))}
        </motion.div>

        {/* Trabajos recientes — filtrados por proyecto activo */}
        {(() => {
          const projectSessions = sessions.filter(s => s.projectId === activeProject?.id);
          if (projectSessions.length === 0) return null;
          return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
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

function CornerTicks() {
  const c = "stroke-primary";
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <line x1="8" y1="8" x2="18" y2="8" className={c} strokeWidth="1.5" />
      <line x1="8" y1="8" x2="8" y2="18" className={c} strokeWidth="1.5" />
      <line x1="100%" y1="8" x2="calc(100% - 10px)" y2="8" className={c} strokeWidth="1.5" />
      <line x1="calc(100% - 8px)" y1="8" x2="calc(100% - 8px)" y2="18" className={c} strokeWidth="1.5" />
      <line x1="8" y1="100%" x2="18" y2="100%" className={c} strokeWidth="1.5" />
      <line x1="8" y1="calc(100% - 8px)" x2="8" y2="calc(100% - 18px)" className={c} strokeWidth="1.5" />
      <line x1="100%" y1="100%" x2="calc(100% - 10px)" y2="100%" className={c} strokeWidth="1.5" />
      <line x1="calc(100% - 8px)" y1="100%" x2="calc(100% - 8px)" y2="calc(100% - 18px)" className={c} strokeWidth="1.5" />
    </svg>
  );
}
