import { getInsForgeAdminClient } from "@/lib/insforge/server";
import type { ProcessedFile } from "@/lib/file-processor/types";
import { calcularCostoDirecto } from "@/lib/math-engine/calculator";

export interface ContextFinding {
  type: "budget_total_mismatch" | "document_amount_mismatch" | "plan_area_mismatch";
  severity: "warning" | "error";
  message: string;
  relatedFileId: string | null;
  relatedFileName: string;
  evidence: {
    currentValue: number;
    relatedValue: number;
    deltaPct: number;
  };
}

export interface ContextScanResult {
  hasFindings: boolean;
  totalCount: number;
  findings: ContextFinding[];
}

const EMPTY: ContextScanResult = { hasFindings: false, totalCount: 0, findings: [] };

interface ChunkRow {
  file_id: string | null;
  file_name: string;
  document_type: string;
  chunk_text: string;
  metadata: Record<string, unknown> | null;
}

interface ScanOptions {
  organizationId: string;
  projectId: string | null;
  fileId: string | null;
}

/**
 * Conservative document-context scan. It only emits warnings when a strong
 * numeric signal conflicts with prior documents in the same project/org.
 */
export async function scanDocumentContext(
  file: ProcessedFile,
  opts: ScanOptions,
): Promise<ContextScanResult> {
  const currentSignals = extractSignals(file);
  if (!currentSignals) return EMPTY;

  const rows = await loadRelatedChunks(opts);
  if (rows.length === 0) return EMPTY;

  const findings: ContextFinding[] = [];

  if (currentSignals.kind === "budget_total") {
    findings.push(...compareBudgetTotal(currentSignals.value, rows));
  } else if (currentSignals.kind === "plan_area") {
    findings.push(...comparePlanArea(currentSignals.value, rows));
  } else if (currentSignals.kind === "document_amount") {
    findings.push(...compareDocumentAmount(currentSignals.value, rows));
  }

  const deduped = dedupeFindings(findings).slice(0, 4);
  return { hasFindings: deduped.length > 0, totalCount: deduped.length, findings: deduped };
}

type CurrentSignal =
  | { kind: "budget_total"; value: number }
  | { kind: "plan_area"; value: number }
  | { kind: "document_amount"; value: number };

function extractSignals(file: ProcessedFile): CurrentSignal | null {
  switch (file.type) {
    case "excel": {
      const value = file.detectedTotal ?? calcularCostoDirecto(file.items);
      return value > 0 ? { kind: "budget_total", value } : null;
    }
    case "dxf": {
      const value = file.geometrySummary.totalAreaM2;
      return value > 0 ? { kind: "plan_area", value } : null;
    }
    case "pdf":
    case "docx": {
      const value = extractLabeledAmount(file.text);
      return value ? { kind: "document_amount", value } : null;
    }
    default:
      return null;
  }
}

async function loadRelatedChunks(opts: ScanOptions): Promise<ChunkRow[]> {
  const client = getInsForgeAdminClient();
  let query = client.database
    .from("document_chunks")
    .select("file_id, file_name, document_type, chunk_text, metadata")
    .eq("organization_id", opts.organizationId)
    .limit(80);

  if (opts.projectId) query = query.eq("project_id", opts.projectId);
  if (opts.fileId) query = query.neq("file_id", opts.fileId);

  const result = await query;
  return (result.data ?? []) as ChunkRow[];
}

function compareBudgetTotal(currentValue: number, rows: ChunkRow[]): ContextFinding[] {
  const byFile = groupByFile(rows.filter((row) => row.document_type === "excel"));
  const findings: ContextFinding[] = [];

  for (const group of byFile.values()) {
    const relatedValue = sumBudgetLineTotals(group.rows);
    if (!relatedValue) continue;
    const deltaPct = pctDelta(currentValue, relatedValue);
    if (deltaPct < 2) continue;

    findings.push({
      type: "budget_total_mismatch",
      severity: deltaPct >= 10 ? "error" : "warning",
      message: `El total del presupuesto subido difiere ${formatPct(deltaPct)} de "${group.fileName}".`,
      relatedFileId: group.fileId,
      relatedFileName: group.fileName,
      evidence: { currentValue, relatedValue, deltaPct },
    });
  }

  return findings;
}

function comparePlanArea(currentValue: number, rows: ChunkRow[]): ContextFinding[] {
  const findings: ContextFinding[] = [];
  for (const row of rows) {
    const relatedValue =
      typeof row.metadata?.totalAreaM2 === "number"
        ? row.metadata.totalAreaM2
        : extractArea(row.chunk_text);
    if (!relatedValue) continue;
    const deltaPct = pctDelta(currentValue, relatedValue);
    if (deltaPct < 5) continue;

    findings.push({
      type: "plan_area_mismatch",
      severity: deltaPct >= 15 ? "error" : "warning",
      message: `El área total del plano difiere ${formatPct(deltaPct)} de "${row.file_name}".`,
      relatedFileId: row.file_id,
      relatedFileName: row.file_name,
      evidence: { currentValue, relatedValue, deltaPct },
    });
  }
  return findings;
}

function compareDocumentAmount(currentValue: number, rows: ChunkRow[]): ContextFinding[] {
  const findings: ContextFinding[] = [];
  for (const row of rows) {
    const relatedValue = extractLabeledAmount(row.chunk_text);
    if (!relatedValue) continue;
    const deltaPct = pctDelta(currentValue, relatedValue);
    if (deltaPct < 2) continue;

    findings.push({
      type: "document_amount_mismatch",
      severity: deltaPct >= 10 ? "error" : "warning",
      message: `El monto principal detectado difiere ${formatPct(deltaPct)} de "${row.file_name}".`,
      relatedFileId: row.file_id,
      relatedFileName: row.file_name,
      evidence: { currentValue, relatedValue, deltaPct },
    });
  }
  return findings;
}

function groupByFile(rows: ChunkRow[]): Map<string, { fileId: string | null; fileName: string; rows: ChunkRow[] }> {
  const out = new Map<string, { fileId: string | null; fileName: string; rows: ChunkRow[] }>();
  for (const row of rows) {
    const key = row.file_id ?? row.file_name;
    const group = out.get(key) ?? { fileId: row.file_id, fileName: row.file_name, rows: [] };
    group.rows.push(row);
    out.set(key, group);
  }
  return out;
}

function sumBudgetLineTotals(rows: ChunkRow[]): number | null {
  let total = 0;
  for (const row of rows) {
    const matches = row.chunk_text.matchAll(/\btotal:\s*\$?\s*([\d.,]+)/gi);
    for (const match of matches) total += parseArgNumber(match[1]);
  }
  return total > 0 ? total : null;
}

function extractLabeledAmount(text: string): number | null {
  const patterns = [
    /(?:costo\s+directo|total\s+general|monto\s+contrato|monto\s+total|presupuesto\s+total|importe\s+total)\D{0,30}\$?\s*([\d.,]+)/i,
    /\$\s*([\d.]{4,}(?:,\d{1,2})?)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ? parseArgNumber(match[1]) : 0;
    if (value > 0) return value;
  }
  return null;
}

function extractArea(text: string): number | null {
  const match = text.match(/[áa]rea\s+total:\s*([\d.,]+)\s*m[²2]/i);
  const value = match?.[1] ? parseArgNumber(match[1]) : 0;
  return value > 0 ? value : null;
}

function parseArgNumber(value: string | undefined): number {
  if (!value) return 0;
  let str = value.trim();
  if (str.includes(",") && str.includes(".")) str = str.replace(/\./g, "").replace(",", ".");
  else if (str.includes(",")) str = str.replace(",", ".");
  else if (/\.\d{3}(?:\D|$)/.test(str)) str = str.replace(/\./g, "");
  const parsed = Number.parseFloat(str.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pctDelta(a: number, b: number): number {
  const base = Math.max(Math.abs(a), Math.abs(b));
  return base > 0 ? Math.round((Math.abs(a - b) / base) * 10_000) / 100 : 0;
}

function formatPct(value: number): string {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function dedupeFindings(findings: ContextFinding[]): ContextFinding[] {
  const seen = new Set<string>();
  return findings
    .sort((a, b) => b.evidence.deltaPct - a.evidence.deltaPct)
    .filter((finding) => {
      const key = `${finding.type}:${finding.relatedFileId ?? finding.relatedFileName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
