"use client";

import { AlertTriangle, CircleAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RiskItem, RiskRegisterSpec } from "@/lib/validators/blocks";
import { BlockShell, MonoLabel } from "./BlockShell";

const SEVERITY_LABEL: Record<RiskItem["severity"], string> = {
  low: "bajo",
  medium: "medio",
  high: "alto",
  critical: "critico",
};

const STATUS_LABEL: Record<RiskItem["status"], string> = {
  open: "abierto",
  monitoring: "monitoreo",
  blocked: "bloqueado",
  resolved: "resuelto",
};

export function RiskRegisterBlock({
  spec,
  accentVar,
}: {
  spec: RiskRegisterSpec;
  accentVar?: string;
}) {
  const criticalCount = spec.risks.filter((risk) => risk.severity === "critical").length;
  const openCount = spec.risks.filter((risk) => risk.status !== "resolved").length;

  return (
    <BlockShell
      icon={AlertTriangle}
      fig="FIG. 06 · RISK REGISTER"
      title={spec.title}
      meta={`${openCount} activos`}
      accentVar={accentVar ?? "var(--warn)"}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MonoLabel>{spec.scope ?? "expediente operativo"}</MonoLabel>
          {spec.updatedAt && <MonoLabel>actualizado · {spec.updatedAt}</MonoLabel>}
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[8px] border border-border bg-border">
        <MetricCell label="riesgos" value={String(spec.risks.length)} />
        <MetricCell label="activos" value={String(openCount)} />
        <MetricCell label="criticos" value={String(criticalCount)} warn={criticalCount > 0} />
      </div>

      <Table className="text-[12px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 w-[44%] px-0 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Riesgo
            </TableHead>
            <TableHead className="h-8 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Severidad
            </TableHead>
            <TableHead className="h-8 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Responsable
            </TableHead>
            <TableHead className="h-8 text-right text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Estado
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {spec.risks.map((risk) => (
            <TableRow key={`${risk.title}-${risk.category}`} className="align-top">
              <TableCell className="max-w-[260px] whitespace-normal px-0 py-2 pr-3">
                <div className="flex flex-col gap-1">
                  <div className="font-medium leading-snug text-foreground">{risk.title}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{risk.category}</span>
                    {risk.due && <span>vence {risk.due}</span>}
                    {risk.probability != null && <span>{Math.round(risk.probability)}% prob.</span>}
                  </div>
                  {(risk.impact || risk.mitigation || risk.evidence) && (
                    <div className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {risk.impact ?? risk.mitigation ?? risk.evidence}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-2">
                <SeverityBadge severity={risk.severity} />
              </TableCell>
              <TableCell className="max-w-[120px] whitespace-normal py-2 text-[11px] text-muted-foreground">
                {risk.owner ?? "sin asignar"}
              </TableCell>
              <TableCell className="py-2 text-right">
                <StatusBadge status={risk.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </BlockShell>
  );
}

function MetricCell({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-card px-3 py-2">
      <MonoLabel className="text-[9px] tracking-[0.1em]">{label}</MonoLabel>
      <div className={cn("mt-1 text-[20px] font-semibold leading-none tabular-nums", warn && "text-[var(--warn)]")}>
        {value}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: RiskItem["severity"] }) {
  const isCritical = severity === "critical";
  const isHigh = severity === "high";

  return (
    <Badge
      variant={isCritical || isHigh ? "destructive" : "outline"}
      className={cn(
        "h-5 rounded-[6px] px-1.5 font-mono text-[10px] uppercase tracking-[0.06em]",
        severity === "medium" && "border-[var(--warn)]/40 text-[var(--warn)]",
        severity === "low" && "text-muted-foreground"
      )}
    >
      {isCritical ? <CircleAlert className="h-3 w-3" /> : null}
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}

function StatusBadge({ status }: { status: RiskItem["status"] }) {
  const resolved = status === "resolved";
  return (
    <Badge
      variant={resolved ? "secondary" : "outline"}
      className={cn(
        "h-5 rounded-[6px] px-1.5 font-mono text-[10px] uppercase tracking-[0.06em]",
        status === "blocked" && "border-[var(--warn)]/50 text-[var(--warn)]"
      )}
    >
      {resolved ? <ShieldCheck className="h-3 w-3" /> : null}
      {STATUS_LABEL[status]}
    </Badge>
  );
}
