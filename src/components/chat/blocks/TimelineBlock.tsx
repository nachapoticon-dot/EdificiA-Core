"use client";

import { HardHat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineSpec } from "@/lib/validators/blocks";
import { BlockShell, MonoLabel } from "./BlockShell";

// ─────────────────────────────────────────────────────────────────────────────
// TimelineBlock — Gantt horizontal con línea HOY, fases con progreso, hitos.
// El día actual se calcula server-side a partir de obras.fecha_inicio para
// evitar drift entre clientes.
// ─────────────────────────────────────────────────────────────────────────────
export function TimelineBlock({
  spec,
  accentVar,
}: {
  spec: TimelineSpec;
  accentVar?: string;
}) {
  const { phases, totalDays, todayDay, milestones, months, title } = spec;
  const todayPct = (todayDay / totalDays) * 100;

  return (
    <BlockShell
      icon={HardHat}
      fig="FIG. 05 · TIMELINE"
      title={title}
      meta={`${totalDays}d · ${phases.length} etapas`}
      accentVar={accentVar}
      footer={
        <MonoLabel>
          hoy <span className="text-foreground">día {todayDay}</span> · {Math.round(todayPct)}% transcurrido
        </MonoLabel>
      }
    >
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          {/* Axis */}
          <div className="grid grid-cols-[200px_1fr] gap-3 border-b border-dashed border-border pb-1.5">
            <span />
            <div className="relative flex items-end">
              {months.map((m, i) => (
                <div key={i} className="relative flex flex-1 flex-col items-center font-mono text-[9.5px] tracking-[0.08em] text-muted-foreground">
                  <span>{m}</span>
                  <span className="absolute top-full h-1 w-px bg-border" />
                </div>
              ))}
              {/* Today marker */}
              <div
                className="pointer-events-none absolute -top-0.5 bottom-[-300px] z-[4] w-px bg-[var(--warn)]"
                style={{ left: `${todayPct}%` }}
                aria-label={`Fecha actual: día ${todayDay} de ${totalDays}`}
              >
                <span className="absolute -left-[3px] top-0 h-[7px] w-[7px] rounded-full bg-[var(--warn)]" />
                <span className="absolute -left-4 -top-4 rounded-[3px] bg-[var(--warn)] px-1.5 py-px font-mono text-[9px] font-bold tracking-[0.08em] text-primary-foreground">
                  HOY
                </span>
              </div>
            </div>
          </div>

          {/* Phase rows */}
          <div className="flex flex-col">
            {phases.map((p, i) => {
              const left = (p.start / totalDays) * 100;
              const width = ((p.end - p.start) / totalDays) * 100;
              const done = Math.min(
                100,
                Math.max(0, ((Math.min(todayDay, p.end) - p.start) / (p.end - p.start)) * 100)
              );
              const status: "done" | "in-progress" | "pending" =
                p.end < todayDay ? "done" : p.start <= todayDay ? "in-progress" : "pending";

              const barColor = status === "done" ? "var(--green)" : accentVar ?? "var(--primary)";
              const dotColor =
                status === "done"
                  ? "var(--green)"
                  : status === "in-progress"
                    ? accentVar ?? "var(--primary)"
                    : "var(--muted-foreground)";

              return (
                <div
                  key={i}
                  className="grid grid-cols-[200px_1fr] items-center gap-3 border-b border-dashed border-border/60 py-1.5 last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
                    <span className="text-[11.5px] font-medium">{p.name}</span>
                    {p.crew && (
                      <span className="ml-auto whitespace-nowrap font-mono text-[9.5px] text-muted-foreground">
                        {p.crew}
                      </span>
                    )}
                  </div>
                  <div className="relative h-[22px] rounded-[4px] bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(100%/7_-_1px),color-mix(in_oklch,var(--foreground)_6%,transparent)_calc(100%/7_-_1px),color-mix(in_oklch,var(--foreground)_6%,transparent)_calc(100%/7))]">
                    <div
                      className={cn(
                        "absolute inset-y-[2px] flex items-center overflow-hidden rounded-[4px] px-2 text-[10px] font-semibold transition-[width] duration-500",
                        status === "pending" ? "opacity-35" : "opacity-100"
                      )}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        backgroundColor: barColor,
                        color: "var(--primary-foreground)",
                      }}
                    >
                      {/* Progress fill */}
                      <div className="absolute inset-y-0 left-0 border-r-2 border-primary-foreground/40 bg-foreground/20" style={{ width: status === "pending" ? "0%" : `${done}%` }} />
                      <span className="relative z-[1] truncate">{p.name}</span>
                      <span className="relative z-[1] ml-auto font-mono text-[10px]">{Math.round(done)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Milestones */}
          {milestones.length > 0 && (
            <div className="grid grid-cols-[200px_1fr] gap-3 border-t border-border pt-2.5">
              <MonoLabel>HITOS</MonoLabel>
              <div className="flex flex-col gap-1.5">
                {milestones.map((m, i) => {
                  const isPast = m.day < todayDay;
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span
                        className="mt-[5px] h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: isPast ? "var(--green)" : "var(--warn)" }}
                      />
                      <div>
                        <div className="text-[11.5px] font-medium">{m.label}</div>
                        <div className="mt-0.5 font-mono text-[9.5px] text-muted-foreground">
                          día {m.day}
                          {m.note ? ` · ${m.note}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
      </div>
    </BlockShell>
  );
}
