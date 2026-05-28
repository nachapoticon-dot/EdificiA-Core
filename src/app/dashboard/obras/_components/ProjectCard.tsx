"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { motion } from "framer-motion";
import { Building2, FileText, ChevronRight, Clock, ExternalLink } from "lucide-react";
import { useProjectCoverage } from "@/hooks/useProjectCoverage";
import { useProjectContext } from "@/contexts/ProjectContext";
import type { Project } from "@/hooks/useProjects";

interface ProjectCardProps {
  project: Project;
  index: number;
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days}d`;
  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}

/** Circular SVG arc gauge showing overall coverage percentage */
function CoverageGauge({ pct, loading }: { pct: number; loading: boolean }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pct / 100);

  return (
    <svg width={68} height={68} viewBox="0 0 68 68" className="shrink-0">
      {/* Track */}
      <circle
        cx={34} cy={34} r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth={5}
      />
      {/* Fill */}
      {!loading && (
        <circle
          cx={34} cy={34} r={r}
          fill="none"
          stroke={pct === 100 ? "var(--ok)" : "var(--primary)"}
          strokeWidth={5}
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 34 34)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      )}
      {/* Label */}
      {loading ? (
        <circle cx={34} cy={34} r={10} fill="var(--muted)" opacity={0.4} />
      ) : (
        <>
          <text
            x={34} y={31}
            textAnchor="middle"
            fontSize={13}
            fontWeight={700}
            fill="currentColor"
            fontFamily="inherit"
          >
            {pct}%
          </text>
          <text
            x={34} y={43}
            textAnchor="middle"
            fontSize={8}
            fill="var(--muted-foreground)"
            fontFamily="inherit"
            letterSpacing="0.05em"
          >
            COB.
          </text>
        </>
      )}
    </svg>
  );
}

export function ProjectCard({ project, index }: ProjectCardProps) {
  const router = useRouter();
  const { activateProject } = useProjectContext();
  const { data: coverage, isLoading } = useProjectCoverage(project.id);

  function handleActivate() {
    activateProject(project);
    router.push("/dashboard/chat");
  }

  const pct = coverage?.overallPct ?? 0;
  const phases = coverage?.phases ?? [];
  const docCount = coverage?.docCount ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      className="group relative flex min-h-[270px] flex-col overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)] transition-shadow hover:shadow-md"
    >
      {/* Header strip */}
      <div className="flex items-start gap-4 p-4 pb-3">
        {/* Icon */}
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
          <Building2 className="h-4 w-4" strokeWidth={1.75} />
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <Link
            href={`/dashboard/obras/${project.id}` as Route}
            className="group/title flex items-center gap-1.5 hover:underline underline-offset-2"
          >
            <h3 className="truncate text-[14px] font-semibold leading-tight text-foreground">
              {project.name}
            </h3>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover/title:opacity-100" />
          </Link>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" strokeWidth={1.5} />
            <span>{formatRelative(project.lastActiveAt)}</span>
          </div>
        </div>

        {/* Gauge */}
        <CoverageGauge pct={pct} loading={isLoading} />
      </div>

      {/* Phase dots */}
      <div className="px-4 pb-3">
        {isLoading ? (
          <div className="flex gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-2 w-2 rounded-full bg-border" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {phases.map((phase) => (
              <span
                key={phase.key}
                title={phase.name}
                className={`h-2 w-2 rounded-full transition-colors ${
                  phase.status === "complete"
                    ? "bg-[var(--ok)]"
                  : phase.status === "partial"
                    ? "bg-[var(--warn)]"
                    : "bg-border"
                }`}
              />
            ))}
          </div>
        )}
        {!isLoading && phases.length > 0 && (
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70">
            {coverage?.completePhases ?? 0}/{coverage?.totalPhases ?? 0} fases · {docCount} doc{docCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Suggestion */}
      {!isLoading && coverage?.nextSuggestion && (
        <div className="mx-4 mb-3 rounded-[8px] border border-primary/20 bg-primary/[0.04] px-3 py-2">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-primary">Siguiente: </span>
            {coverage.nextSuggestion}
          </p>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer action */}
      <div className="border-t border-border px-4 py-3">
        <button
          onClick={handleActivate}
          className="flex w-full items-center justify-between rounded-[8px] bg-primary/[0.06] px-3 py-2 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/[0.12]"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
            Abrir en asistente
          </span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
