import { getInsForgeAdminClient as getDefaultClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import type { ProcessedFile } from "@/lib/file-processor/types";
import type { ContextScanResult } from "@/lib/document-intelligence/context-scan";
import type { PiiScanResult } from "@/lib/security/pii-detector";
import { linkDocumentReportEvidence } from "@/lib/document-intelligence/report-linker";

type DocumentVerdict = "consistent" | "inconsistent" | "needs_review" | "unsupported";
type DocumentReportStatus = "ready" | "needs_review" | "failed";

export interface WriteDocumentIntelligenceReportInput {
  organizationId: string;
  projectId?: string | null;
  workCaseId?: string | null;
  fileId: string | null;
  actorUserId: string;
  processed: ProcessedFile;
  piiScan: PiiScanResult;
  contextScan: ContextScanResult;
}

export async function writeDocumentIntelligenceReport(
  input: WriteDocumentIntelligenceReportInput,
): Promise<string | null> {
  if (!input.fileId || input.processed.type === "dwg_unsupported") return null;

  const report = buildUploadReport(input.processed, input.piiScan, input.contextScan);

  try {
    const client = getDefaultClient();
    const result = await client.database
      .from("document_intelligence_reports")
      .insert({
        organization_id: input.organizationId,
        project_id: input.projectId ?? null,
        work_case_id: input.workCaseId ?? null,
        file_id: input.fileId,
        report_type: "upload_scan",
        status: report.status,
        source: "system",
        document_type: report.documentType,
        classification: report.classification,
        extraction: report.extraction,
        risks: report.risks,
        findings: report.findings,
        verdict: report.verdict,
        confidence: report.confidence,
        summary: report.summary,
        created_by: input.actorUserId,
        metadata: {
          fileName: input.processed.fileName,
          fileType: input.processed.type,
          contextFindings: input.contextScan.totalCount,
          piiTotal: input.piiScan.totalCount,
        },
      })
      .select("id")
      .single();

    if (result.error) {
      dbLogger.warn({ err: result.error, fileId: input.fileId }, "document intelligence report insert failed");
      return null;
    }

    const reportId = (result.data as { id: string } | null)?.id ?? null;
    if (reportId && input.workCaseId) {
      await linkDocumentReportEvidence({
        client,
        organizationId: input.organizationId,
        projectId: input.projectId ?? null,
        workCaseId: input.workCaseId,
        reportId,
        fileId: input.fileId,
        fileName: input.processed.fileName,
        documentType: report.documentType,
        verdict: report.verdict,
        confidence: report.confidence,
        summary: report.summary,
      });
    }

    return reportId;
  } catch (err) {
    dbLogger.warn({ err, fileId: input.fileId }, "document intelligence report insert failed");
    return null;
  }
}

function buildUploadReport(file: ProcessedFile, piiScan: PiiScanResult, contextScan: ContextScanResult) {
  const documentType = classifyDocument(file);
  const confidence = estimateConfidence(file, contextScan);
  const verdict = pickVerdict(file, piiScan, contextScan);
  const status: DocumentReportStatus = verdict === "consistent" ? "ready" : "needs_review";
  const findings = contextScan.findings.map((finding) => ({
    type: finding.type,
    severity: finding.severity,
    message: finding.message,
    relatedFileId: finding.relatedFileId,
    relatedFileName: finding.relatedFileName,
    evidence: finding.evidence,
  }));
  const risks = [
    ...findings.map((finding) => ({
      type: finding.type,
      severity: finding.severity,
      message: finding.message,
    })),
    ...piiScan.matches.map((match) => ({
      type: `pii.${match.type}`,
      severity: "warning",
      message: `Se detectaron ${match.count} coincidencias de PII (${match.type}).`,
    })),
    ...(file.type === "pdf" && file.isScanned
      ? [{ type: "document.scanned_pdf", severity: "warning", message: "PDF escaneado: requiere revisión visual/multimodal." }]
      : []),
  ];

  return {
    status,
    documentType,
    confidence,
    verdict,
    classification: {
      documentType,
      fileType: file.type,
      confidence,
      rationale: classificationRationale(file, documentType),
    },
    extraction: extractStructuredSignals(file),
    risks,
    findings,
    summary: buildSummary(file, documentType, verdict, contextScan.totalCount, piiScan.totalCount),
  };
}

function classifyDocument(file: ProcessedFile): string {
  if (file.type === "excel") return "budget";
  if (file.type === "dxf") return "plan";
  if (file.type === "image") return "image";
  if (file.type === "dwg_unsupported") return "unsupported";

  const text = `${file.fileName}\n${"text" in file ? file.text : ""}`.toLowerCase();
  if (/\b(contrato|subcontrato|orden\s+de\s+compra|oc)\b/.test(text)) return "contract";
  if (/\b(acta|parte\s+diario|avance\s+de\s+obra|certificado)\b/.test(text)) return "field_report";
  if (/\b(art|epp|seguridad|higiene|hse|capacitaci[oó]n)\b/.test(text)) return "hse";
  if (/\b(presupuesto|c[oó]mputo|item|rubro|precio\s+unitario)\b/.test(text)) return "budget";
  if (/\b(plano|corte|vista|escala|superficie)\b/.test(text)) return "plan";
  return "document";
}

function estimateConfidence(file: ProcessedFile, contextScan: ContextScanResult): number {
  if (file.type === "excel") return contextScan.hasFindings ? 0.78 : 0.9;
  if (file.type === "dxf") return contextScan.hasFindings ? 0.72 : 0.86;
  if (file.type === "pdf") return file.isScanned ? 0.45 : 0.68;
  if (file.type === "docx") return 0.7;
  if (file.type === "image") return 0.35;
  return 0.2;
}

function pickVerdict(file: ProcessedFile, piiScan: PiiScanResult, contextScan: ContextScanResult): DocumentVerdict {
  if (file.type === "dwg_unsupported" || file.type === "image") return "unsupported";
  if (contextScan.findings.some((finding) => finding.severity === "error")) return "inconsistent";
  if (contextScan.hasFindings || piiScan.hasMatches || (file.type === "pdf" && file.isScanned)) return "needs_review";
  return "consistent";
}

function classificationRationale(file: ProcessedFile, documentType: string): string {
  if (file.type === "excel") return "Archivo tabular con ítems presupuestarios procesables.";
  if (file.type === "dxf") return "Plano DXF con geometría y capas extraídas.";
  if (file.type === "pdf" && file.isScanned) return "PDF sin texto confiable; requiere revisión visual.";
  return `Clasificado como ${documentType} por tipo de archivo, nombre y señales textuales.`;
}

function extractStructuredSignals(file: ProcessedFile): Record<string, unknown> {
  if (file.type === "excel") {
    return {
      sheetName: file.sheetName,
      itemCount: file.itemCount,
      detectedTotal: file.detectedTotal,
    };
  }
  if (file.type === "pdf") {
    return {
      pageCount: file.pageCount,
      isScanned: file.isScanned,
      textLength: file.text.length,
    };
  }
  if (file.type === "docx") {
    return {
      wordCount: file.wordCount,
      textLength: file.text.length,
    };
  }
  if (file.type === "dxf") {
    return {
      layers: file.layers,
      totalAreaM2: file.geometrySummary.totalAreaM2,
      totalLinearM: file.geometrySummary.totalLinearM,
      entitySummary: file.entitySummary,
    };
  }
  if (file.type === "image") {
    return {
      mimeType: file.mimeType,
      widthHint: file.widthHint ?? null,
      heightHint: file.heightHint ?? null,
    };
  }
  return {};
}

function buildSummary(
  file: ProcessedFile,
  documentType: string,
  verdict: DocumentVerdict,
  contextFindings: number,
  piiTotal: number,
): string {
  const flags = [
    contextFindings > 0 ? `${contextFindings} hallazgo(s) contextual(es)` : null,
    piiTotal > 0 ? `${piiTotal} coincidencia(s) PII` : null,
  ].filter(Boolean);
  const suffix = flags.length > 0 ? ` Señales: ${flags.join(", ")}.` : "";
  return `Reporte ${documentType} para "${file.fileName}" con veredicto ${verdict}.${suffix}`;
}
