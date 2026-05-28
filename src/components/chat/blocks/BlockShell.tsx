"use client";

import { cn } from "@/lib/utils";
import { Maximize2, Download, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// BlockShell — header con FIG. label, icon pill, slot de body + footer.
// Idéntico patrón visual al ChartBlock / ComparisonTable existentes.
// ─────────────────────────────────────────────────────────────────────────────
export interface BlockShellProps {
  icon: LucideIcon;
  fig: string;                  // "FIG. 02 · METRICS"
  title: string;
  meta?: string;                // "n = 8"
  accentVar?: string;           // CSS color para el icon pill
  footer?: ReactNode;
  dense?: boolean;
  children: ReactNode;
}

export function BlockShell({
  icon: Icon,
  fig,
  title,
  meta,
  accentVar,
  footer,
  dense,
  children,
}: BlockShellProps) {
  return (
    <div
      role="region"
      aria-label={title}
      className={cn(
        "eb-num w-full max-w-[720px] overflow-hidden rounded-[10px] border border-border bg-card",
        "shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]",
        "animate-in fade-in slide-in-from-bottom-1 duration-300"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border bg-gradient-to-b from-muted/45 to-transparent px-3.5 py-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[6px]"
            style={{
              color: accentVar ?? "var(--primary)",
              backgroundColor: `color-mix(in oklch, ${accentVar ?? "var(--primary)"} 14%, transparent)`,
            }}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-semibold leading-tight">{title}</div>
            <div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">
              {fig}
              {meta ? ` · ${meta}` : ""}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <IconBtn title="Abrir en panel"><Maximize2 className="h-3 w-3" strokeWidth={1.5} /></IconBtn>
          <IconBtn title="Exportar"><Download className="h-3 w-3" strokeWidth={1.5} /></IconBtn>
        </div>
      </div>

      {/* Body */}
      <div className={cn("flex flex-col gap-3.5", dense ? "p-2.5" : "p-3.5")}>{children}</div>

      {/* Footer */}
      {footer && (
        <div className="border-t border-border bg-muted/20 px-3.5 py-2 text-[11px]">
          {footer}
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, title }: { children: ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      className="grid h-6 w-6 place-items-center rounded-[6px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

// ── Shared mono label helper ────────────────────────────────────────────────
export function MonoLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground", className)}>
      {children}
    </span>
  );
}
