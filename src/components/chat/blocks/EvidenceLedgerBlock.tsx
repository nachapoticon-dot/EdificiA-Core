"use client";

import { ClipboardList, FileText, SearchCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { EvidenceItem, EvidenceLedgerSpec } from "@/lib/validators/blocks";
import { BlockShell, MonoLabel } from "./BlockShell";

const STATUS_LABEL: Record<EvidenceItem["status"], string> = {
  confirmed: "confirmada",
  observed: "observada",
  missing: "faltante",
  conflict: "conflicto",
};

const TYPE_LABEL: Record<EvidenceItem["type"], string> = {
  document: "doc",
  tool: "tool",
  finding: "hallazgo",
  event: "evento",
  external: "externa",
};

export function EvidenceLedgerBlock({
  spec,
  accentVar,
}: {
  spec: EvidenceLedgerSpec;
  accentVar?: string;
}) {
  const conflictItems = spec.items.filter((item) => item.status === "conflict" || item.status === "missing");
  const confirmedItems = spec.items.filter((item) => item.status === "confirmed");

  return (
    <BlockShell
      icon={ClipboardList}
      fig="FIG. 07 · EVIDENCE LEDGER"
      title={spec.title}
      meta={`${spec.items.length} registros`}
      accentVar={accentVar ?? "var(--cyan)"}
      footer={spec.summary ? <MonoLabel>{spec.summary}</MonoLabel> : null}
    >
      <Tabs defaultValue="all" className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="h-8 rounded-[8px]">
            <TabsTrigger value="all" className="text-[11px]">
              Todo
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="text-[11px]">
              Confirmado
              <Badge variant="secondary" className="ml-1 h-4 rounded-[5px] px-1 text-[9px]">
                {confirmedItems.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-[11px]">
              Alertas
              <Badge variant={conflictItems.length ? "destructive" : "secondary"} className="ml-1 h-4 rounded-[5px] px-1 text-[9px]">
                {conflictItems.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <MonoLabel>{confidenceSummary(spec.items)}</MonoLabel>
        </div>

        <TabsContent value="all">
          <EvidenceTable items={spec.items} />
        </TabsContent>
        <TabsContent value="confirmed">
          <EvidenceTable items={confirmedItems} empty="Sin evidencias confirmadas." />
        </TabsContent>
        <TabsContent value="alerts">
          <EvidenceTable items={conflictItems} empty="Sin faltantes ni conflictos." />
        </TabsContent>
      </Tabs>
    </BlockShell>
  );
}

function EvidenceTable({ items, empty }: { items: EvidenceItem[]; empty?: string }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
        {empty ?? "Sin registros."}
      </div>
    );
  }

  return (
    <Table className="text-[12px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-8 px-0 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Evidencia
          </TableHead>
          <TableHead className="h-8 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Fuente
          </TableHead>
          <TableHead className="h-8 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Conf.
          </TableHead>
          <TableHead className="h-8 text-right text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Estado
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={`${item.label}-${item.source}`} className="align-top">
            <TableCell className="max-w-[260px] whitespace-normal px-0 py-2 pr-3">
              <div className="flex items-start gap-2">
                <EvidenceIcon item={item} />
                <div className="min-w-0">
                  <div className="font-medium leading-snug text-foreground">{item.label}</div>
                  {item.note && <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{item.note}</div>}
                </div>
              </div>
            </TableCell>
            <TableCell className="max-w-[150px] whitespace-normal py-2">
              <div className="flex flex-col gap-1">
                <Badge variant="outline" className="h-5 w-fit rounded-[6px] px-1.5 font-mono text-[10px] uppercase tracking-[0.06em]">
                  {TYPE_LABEL[item.type]}
                </Badge>
                <span className="text-[11px] text-muted-foreground">{item.source}</span>
                {item.timestamp && <span className="font-mono text-[10px] text-muted-foreground">{item.timestamp}</span>}
              </div>
            </TableCell>
            <TableCell className="py-2">
              {item.confidence != null ? (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-14 overflow-hidden rounded-[3px] bg-muted">
                    <div className="h-full rounded-[3px] bg-primary" style={{ width: `${item.confidence}%` }} />
                  </div>
                  <span className="font-mono text-[11px] tabular-nums">{Math.round(item.confidence)}%</span>
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="py-2 text-right">
              <StatusBadge status={item.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EvidenceIcon({ item }: { item: EvidenceItem }) {
  const Icon = item.status === "conflict" || item.status === "missing" ? TriangleAlert : item.type === "document" ? FileText : SearchCheck;
  return (
    <span
      className={cn(
        "mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-[6px] bg-muted text-muted-foreground",
        (item.status === "conflict" || item.status === "missing") && "text-[var(--warn)]"
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
    </span>
  );
}

function StatusBadge({ status }: { status: EvidenceItem["status"] }) {
  const alert = status === "conflict" || status === "missing";
  return (
    <Badge
      variant={alert ? "destructive" : status === "confirmed" ? "secondary" : "outline"}
      className="h-5 rounded-[6px] px-1.5 font-mono text-[10px] uppercase tracking-[0.06em]"
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function confidenceSummary(items: EvidenceItem[]) {
  const values = items
    .map((item) => item.confidence)
    .filter((confidence): confidence is number => typeof confidence === "number");
  if (!values.length) return "sin score de confianza";
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return `confianza media · ${Math.round(avg)}%`;
}
