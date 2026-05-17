"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, ShieldAlert, CircleAlert, Info, ListChecks } from "lucide-react";
import { useProactivityFindings } from "@/hooks/useProactivityFindings";
import type { ProactivityFindingsResponse } from "@/lib/validators/api-responses";

type ProjectSummary = ProactivityFindingsResponse["projects"][number];
type Finding = ProjectSummary["findings"][number];

interface ProactivityAlertsBannerProps {
  projectId?: string | null;
  /** Si se omite, oculta el banner cuando solo hay severidad `info`. */
  showInfoOnly?: boolean;
}

export function ProactivityAlertsBanner({ projectId, showInfoOnly = false }: ProactivityAlertsBannerProps) {
  const { data, isLoading, isError } = useProactivityFindings({ projectId });
  const [expanded, setExpanded] = useState(false);

  if (isLoading || isError || !data?.hasData) return null;
  const { bySeverity, projects, latestScanAt } = data;
  if (!showInfoOnly && bySeverity.critical === 0 && bySeverity.warning === 0) return null;

  const tone = bySeverity.critical > 0 ? "critical" : bySeverity.warning > 0 ? "warning" : "info";
  const wrapperClass = TONE_WRAPPER[tone];
  const iconClass = TONE_ICON[tone];
  const Icon = tone === "critical" ? ShieldAlert : tone === "warning" ? AlertTriangle : Info;

  const title = buildTitle(bySeverity);
  const lastScan = latestScanAt ? formatScanDate(latestScanAt) : null;

  return (
    <div className={`border-b ${wrapperClass} px-6 py-3`}>
      <div className="mx-auto flex max-w-[920px] flex-col gap-2">
        <div className="flex items-center gap-3">
          <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-foreground">{title}</p>
            <p className="text-[11.5px] text-muted-foreground">
              {data.projectsScanned} obra{data.projectsScanned === 1 ? "" : "s"} escaneada{data.projectsScanned === 1 ? "" : "s"}
              {lastScan ? ` · último análisis ${lastScan}` : ""}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[8px] border border-border bg-background/40 px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-background/70"
          >
            <ListChecks className="h-3.5 w-3.5" />
            {expanded ? "Ocultar" : "Ver detalle"}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {expanded && (
          <div className="flex flex-col gap-2">
            {projects.map((project) => (
              <ProjectSummaryRow key={project.projectId} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TONE_WRAPPER: Record<"critical" | "warning" | "info", string> = {
  critical: "border-[oklch(0.55_0.22_25)]/40 bg-[oklch(0.55_0.22_25)]/[0.08]",
  warning:  "border-[oklch(0.72_0.16_65)]/30 bg-[oklch(0.72_0.16_65)]/[0.07]",
  info:     "border-border bg-muted/40",
};

const TONE_ICON: Record<"critical" | "warning" | "info", string> = {
  critical: "text-[oklch(0.52_0.22_25)]",
  warning:  "text-[oklch(0.62_0.18_60)]",
  info:     "text-muted-foreground",
};

function buildTitle(by: { critical: number; warning: number; info: number }): string {
  const parts: string[] = [];
  if (by.critical > 0) parts.push(`${by.critical} crítico${by.critical === 1 ? "" : "s"}`);
  if (by.warning > 0)  parts.push(`${by.warning} advertencia${by.warning === 1 ? "" : "s"}`);
  if (by.info > 0 && parts.length === 0) parts.push(`${by.info} observación${by.info === 1 ? "" : "es"}`);
  return parts.length === 0
    ? "Análisis proactivo sin hallazgos"
    : `Análisis proactivo: ${parts.join(" · ")}`;
}

function formatScanDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

function ProjectSummaryRow({ project }: { project: ProjectSummary }) {
  const top = pickTopFindings(project.findings, 4);
  return (
    <div className="rounded-[8px] border border-border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-semibold text-foreground">{project.projectName}</p>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {project.bySeverity.critical > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.55_0.22_25)]/15 px-2 py-0.5 text-[10.5px] font-medium text-[oklch(0.52_0.22_25)]">
              <CircleAlert className="h-3 w-3" /> {project.bySeverity.critical}
            </span>
          )}
          {project.bySeverity.warning > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.72_0.16_65)]/15 px-2 py-0.5 text-[10.5px] font-medium text-[oklch(0.62_0.18_60)]">
              <AlertTriangle className="h-3 w-3" /> {project.bySeverity.warning}
            </span>
          )}
          {project.bySeverity.info > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
              <Info className="h-3 w-3" /> {project.bySeverity.info}
            </span>
          )}
        </div>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {top.map((finding) => (
          <li key={finding.id} className="flex items-start gap-2 text-[11.5px] text-muted-foreground">
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor(finding.severity)}`} />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-foreground">{finding.title}</span>
              {finding.detail ? ` — ${finding.detail}` : ""}
            </span>
          </li>
        ))}
        {project.findings.length > top.length && (
          <li className="text-[11px] text-muted-foreground/80">+ {project.findings.length - top.length} hallazgo(s) adicionales</li>
        )}
      </ul>
    </div>
  );
}

function pickTopFindings(findings: Finding[], max: number): Finding[] {
  const order: Record<Finding["severity"], number> = { critical: 0, warning: 1, info: 2 };
  return [...findings]
    .sort((a, b) => order[a.severity] - order[b.severity])
    .slice(0, max);
}

function dotColor(severity: Finding["severity"]): string {
  if (severity === "critical") return "bg-[oklch(0.52_0.22_25)]";
  if (severity === "warning")  return "bg-[oklch(0.62_0.18_60)]";
  return "bg-muted-foreground/60";
}
