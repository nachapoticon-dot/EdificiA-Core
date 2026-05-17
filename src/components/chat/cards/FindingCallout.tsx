"use client";

import { AlertCircle, AlertTriangle, Info, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FindingSpec {
  type: "finding_callout";
  code: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  impact?: string;
  item?: string;
}

const SEVERITY_STYLES = {
  error: {
    border: "border-l-[var(--err)]",
    bg:     "bg-[var(--err)]/[0.04]",
    badge:  "bg-[var(--err)]/10 text-[var(--err)]",
    icon:   AlertCircle,
    iconColor: "text-[var(--err)]",
  },
  warning: {
    border: "border-l-[oklch(0.72_0.16_65)]",
    bg:     "bg-[oklch(0.72_0.16_65)]/[0.04]",
    badge:  "bg-[oklch(0.72_0.16_65)]/10 text-[oklch(0.55_0.16_65)]",
    icon:   AlertTriangle,
    iconColor: "text-[oklch(0.65_0.16_65)]",
  },
  info: {
    border: "border-l-primary",
    bg:     "bg-primary/[0.03]",
    badge:  "bg-primary/10 text-primary",
    icon:   Info,
    iconColor: "text-primary",
  },
};

export function FindingCallout({ spec }: { spec: FindingSpec }) {
  const s = SEVERITY_STYLES[spec.severity];
  const Icon = s.icon;

  return (
    <div className={cn(
      "w-full overflow-hidden rounded-r-[10px] border-l-[3px] border border-border px-4 py-3",
      s.border, s.bg,
    )}>
      {/* Header row */}
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.iconColor)} strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]", s.badge)}>
              {spec.code}
            </span>
            <span className="text-[13px] font-semibold text-foreground">{spec.title}</span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{spec.detail}</p>

          {/* Optional metadata row */}
          {(spec.item ?? spec.impact) && (
            <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
              {spec.item && (
                <span className="font-mono text-muted-foreground">
                  Ítem: <span className="text-foreground">{spec.item}</span>
                </span>
              )}
              {spec.impact && (
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <DollarSign className="h-3 w-3 text-primary" />
                  {spec.impact}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
