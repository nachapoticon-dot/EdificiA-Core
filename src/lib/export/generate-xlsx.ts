import * as XLSX from "xlsx";
import type { UIMessage } from "ai";
import type { BudgetItem } from "@/lib/math-engine/validators";

// ── Internal types for tool result extraction ─────────────────────────────────

interface ToolPart {
  type: "tool-invocation";
  toolInvocation: {
    toolName: string;
    input: Record<string, unknown>;
    state: "call" | "result" | "partial-call";
    output?: unknown;
  };
}

interface TotalesOutput {
  computedTotal: number;
  declaredTotal: number | null;
  difference: number | null;
  lineTotals: number[];
  itemCount: number;
}

interface Issue {
  severity: "error" | "warning" | "info";
  code: string;
  itemCode?: string;
  message: string;
  value?: number;
}

interface ExclusionesOutput {
  totalIssues: number;
  byseverity: { error: Issue[]; warning: Issue[]; info: Issue[] };
  ok: boolean;
  resumen: string;
}

function extractToolCalls(messages: UIMessage[]): Map<string, { input: Record<string, unknown>; output: unknown }[]> {
  const calls = new Map<string, { input: Record<string, unknown>; output: unknown }[]>();
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const p = part as unknown as ToolPart;
      if (p.type === "tool-invocation" && p.toolInvocation.state === "result") {
        const name = p.toolInvocation.toolName;
        if (!calls.has(name)) calls.set(name, []);
        calls.get(name)!.push({ input: p.toolInvocation.input, output: p.toolInvocation.output });
      }
    }
  }
  return calls;
}

function getTextFromMessage(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => (p as { type: string }).type === "text")
    .map((p) => p.text)
    .join("\n");
}

/**
 * Generates and downloads a real .xlsx audit report.
 * Sheet 1 — Resumen: metadata + KPIs
 * Sheet 2 — Ítems del Presupuesto: full budget table with calculated totals
 * Sheet 3 — Hallazgos: audit findings sorted by severity
 * Falls back to a Conversación sheet if no structured audit data is available.
 */
export function exportAuditXlsx(title: string, messages: UIMessage[]): void {
  const toolCalls = extractToolCalls(messages);
  const wb = XLSX.utils.book_new();
  const now = new Date().toLocaleString("es-AR");
  const safeTitle = title.replace(/[/\\?%*:|"<>]/g, "-");

  const totalsCalls = toolCalls.get("calcular_totales") ?? [];
  const exclusionCalls = toolCalls.get("detectar_exclusiones_logicas") ?? [];
  const lastTotal = totalsCalls[totalsCalls.length - 1];
  const lastExclusion = exclusionCalls[exclusionCalls.length - 1];

  const totalesOutput = lastTotal?.output as TotalesOutput | undefined;
  const exclusionesOutput = lastExclusion?.output as ExclusionesOutput | undefined;

  // ── Sheet 1: Resumen ──────────────────────────────────────────────────────
  const estado =
    exclusionesOutput?.ok === true ? "✓ Aprobado"
    : exclusionesOutput?.ok === false ? "✗ Requiere revisión"
    : "Sin datos de auditoría";

  const resumenRows: (string | number)[][] = [
    ["INFORME DE AUDITORÍA — EdificIA", ""],
    ["", ""],
    ["Archivo auditado", title],
    ["Fecha de generación", now],
    ["", ""],
    ["RESULTADOS DE LA AUDITORÍA", ""],
    ["Costo directo calculado ($)", totalesOutput?.computedTotal ?? "No calculado"],
    ["Total declarado ($)", totalesOutput?.declaredTotal ?? "No declarado"],
    ["Brecha detectada ($)", totalesOutput?.difference != null ? Math.abs(totalesOutput.difference) : 0],
    ["", ""],
    ["HALLAZGOS", ""],
    ["Errores críticos", exclusionesOutput?.byseverity.error.length ?? 0],
    ["Advertencias", exclusionesOutput?.byseverity.warning.length ?? 0],
    ["Observaciones", exclusionesOutput?.byseverity.info.length ?? 0],
    ["Total de hallazgos", exclusionesOutput?.totalIssues ?? 0],
    ["", ""],
    ["VEREDICTO", estado],
  ];

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  wsResumen["!cols"] = [{ wch: 35 }, { wch: 45 }];
  // Bold the title cell
  if (wsResumen["A1"]) wsResumen["A1"].s = { font: { bold: true, sz: 14 } };
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  // ── Sheet 2: Ítems del presupuesto ────────────────────────────────────────
  if (lastTotal) {
    const items = (lastTotal.input.items as BudgetItem[]) ?? [];
    const lineTotals = totalesOutput?.lineTotals ?? [];

    const headers = ["Código", "Descripción", "Cantidad", "Unidad", "Precio Unitario ($)", "Total Calculado ($)", "Subcontrato"];
    const rows = items.map((item, i) => [
      item.code,
      item.description,
      item.quantity,
      item.unit,
      item.unitPrice,
      lineTotals[i] ?? item.quantity * item.unitPrice,
      item.isSubcontracted ? "Sí" : "No",
    ]);

    // Totals row
    const computedSum = lineTotals.length > 0
      ? lineTotals.reduce((s, v) => s + v, 0)
      : items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    rows.push(["", "COSTO DIRECTO TOTAL", "", "", "", computedSum, ""]);

    const wsItems = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    wsItems["!cols"] = [
      { wch: 12 }, { wch: 50 }, { wch: 12 }, { wch: 10 },
      { wch: 22 }, { wch: 22 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsItems, "Ítems del Presupuesto");
  }

  // ── Sheet 3: Hallazgos ────────────────────────────────────────────────────
  if (lastExclusion && exclusionesOutput) {
    const allIssues: Issue[] = [
      ...exclusionesOutput.byseverity.error,
      ...exclusionesOutput.byseverity.warning,
      ...exclusionesOutput.byseverity.info,
    ];

    const severityLabel = (s: string) =>
      s === "error" ? "ERROR CRÍTICO" : s === "warning" ? "ADVERTENCIA" : "OBSERVACIÓN";

    const headers = ["Severidad", "Código de Regla", "Ítem Afectado", "Descripción del Hallazgo", "Valor"];
    const rows = allIssues.map((issue) => [
      severityLabel(issue.severity),
      issue.code,
      issue.itemCode ?? "-",
      issue.message,
      issue.value != null ? issue.value : "-",
    ]);

    const wsHallazgos = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    wsHallazgos["!cols"] = [
      { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 65 }, { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, wsHallazgos, "Hallazgos");
  }

  // ── Fallback: plain conversation ──────────────────────────────────────────
  if (!lastTotal && !lastExclusion) {
    const convRows = messages
      .map((m) => {
        const text = getTextFromMessage(m).trim();
        if (!text) return null;
        return [m.role === "user" ? "Usuario" : "EdificIA", text.slice(0, 1000)];
      })
      .filter((r): r is string[] => r !== null);

    const wsConv = XLSX.utils.aoa_to_sheet([["Rol", "Mensaje"], ...convRows]);
    wsConv["!cols"] = [{ wch: 12 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsConv, "Conversación");
  }

  XLSX.writeFile(wb, `Auditoria EdificIA — ${safeTitle}.xlsx`);
}
