"use client";

import { Building2, X, MapPin, Hash, Banknote, HardDrive } from "lucide-react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useProjectDetails } from "@/hooks/useProjectDetails";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  en_obra:       { label: "EN OBRA",      color: "text-[oklch(0.55_0.16_145)] bg-[oklch(0.96_0.05_145)] border-[oklch(0.85_0.1_145)]" },
  planificacion: { label: "PLANIFICACIÓN",color: "text-[oklch(0.55_0.16_240)] bg-[oklch(0.96_0.04_240)] border-[oklch(0.85_0.08_240)]" },
  finalizado:    { label: "FINALIZADO",   color: "text-muted-foreground bg-muted/50 border-border" },
  pausado:       { label: "PAUSADO",      color: "text-[oklch(0.55_0.16_55)] bg-[oklch(0.97_0.05_55)] border-[oklch(0.86_0.1_55)]" },
} as const;

function fmtBytes(bytes: number): string {
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString("es-AR")}`;
}

export function ActiveProjectSection() {
  const { activeProject, clearActiveProject } = useProjectContext();
  const { data } = useProjectDetails(activeProject?.id ?? null);

  if (!activeProject) return null;

  const project = data?.project;
  const storage = data?.storage;
  const status = project?.status ?? "en_obra";
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.en_obra;

  return (
    <div className="px-2 pb-2">
      <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">
        Proyecto activo
      </p>

      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-2.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Building2 className="h-3 w-3 shrink-0 text-primary mt-0.5" />
            <span className="truncate text-[12px] font-semibold text-foreground">
              {project?.name ?? activeProject.name}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={cn("rounded-[4px] border px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.06em]", statusCfg.color)}>
              {statusCfg.label}
            </span>
            <button
              onClick={clearActiveProject}
              title="Cambiar proyecto"
              className="text-muted-foreground/40 transition-colors hover:text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Meta chips */}
        {project && (project.code ?? project.location ?? project.contract_amount != null) && (
          <div className="mt-2 flex flex-col gap-1">
            {project.code && (
              <MetaRow icon={Hash} text={project.code} />
            )}
            {project.location && (
              <MetaRow icon={MapPin} text={project.location} />
            )}
            {project.contract_amount != null && (
              <MetaRow icon={Banknote} text={`Contrato ${fmtMoney(project.contract_amount)}`} />
            )}
          </div>
        )}

        {/* Storage bar */}
        {storage && (
          <div className="mt-2.5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <HardDrive className="h-2.5 w-2.5 text-muted-foreground/60" />
                <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.06em]">Almacenamiento</span>
              </div>
              <span className="font-mono text-[10px] font-medium text-foreground">{storage.pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  storage.pct >= 90 ? "bg-[oklch(0.55_0.18_25)]" : "bg-primary",
                )}
                style={{ width: `${storage.pct}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-[9px] text-muted-foreground/60">
              {fmtBytes(storage.usedBytes)} / {fmtBytes(storage.quotaBytes)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaRow({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" />
      <span className="truncate font-mono text-[10px] text-muted-foreground">{text}</span>
    </div>
  );
}
