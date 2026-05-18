import type { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";

type AdminClient = ReturnType<typeof getInsForgeAdminClient>;
type DocumentVerdict = "consistent" | "inconsistent" | "needs_review" | "unsupported";

interface LatestReportRow {
  id: string;
  file_id: string;
  document_type: string;
  verdict: DocumentVerdict;
  confidence: number | string | null;
  summary: string | null;
}

export async function linkLatestDocumentReportToWorkCase(input: {
  client: AdminClient;
  organizationId: string;
  projectId: string;
  workCaseId: string;
  fileName: string;
}): Promise<void> {
  try {
    const fileResult = await input.client.database
      .from("uploaded_files")
      .select("id, file_name")
      .eq("organization_id", input.organizationId)
      .eq("project_id", input.projectId)
      .eq("file_name", input.fileName)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const file = fileResult.data as { id: string; file_name: string } | null;
    if (!file) return;

    const reportResult = await input.client.database
      .from("document_intelligence_reports")
      .select("id, file_id, document_type, verdict, confidence, summary")
      .eq("organization_id", input.organizationId)
      .eq("file_id", file.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const report = reportResult.data as LatestReportRow | null;
    if (!report) return;

    await input.client.database
      .from("document_intelligence_reports")
      .update({ work_case_id: input.workCaseId, updated_at: new Date().toISOString() })
      .eq("id", report.id)
      .eq("organization_id", input.organizationId);

    await linkDocumentReportEvidence({
      client: input.client,
      organizationId: input.organizationId,
      projectId: input.projectId,
      workCaseId: input.workCaseId,
      reportId: report.id,
      fileId: report.file_id,
      fileName: file.file_name,
      documentType: report.document_type,
      verdict: report.verdict,
      confidence: report.confidence == null ? null : Number(report.confidence),
      summary: report.summary,
    });
  } catch (err) {
    dbLogger.warn({ err, workCaseId: input.workCaseId }, "document intelligence report link failed");
  }
}

export async function linkDocumentReportEvidence(input: {
  client: AdminClient;
  organizationId: string;
  projectId: string | null;
  workCaseId: string;
  reportId: string;
  fileId: string;
  fileName: string;
  documentType: string;
  verdict: DocumentVerdict;
  confidence: number | string | null;
  summary: string | null;
}): Promise<void> {
  const existing = await input.client.database
    .from("work_case_evidence")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("work_case_id", input.workCaseId)
    .eq("entity_type", "document_intelligence_reports")
    .eq("entity_id", input.reportId)
    .limit(1)
    .maybeSingle();

  if (existing.data) return;

  await input.client.database.from("work_case_evidence").insert({
    organization_id: input.organizationId,
    work_case_id: input.workCaseId,
    project_id: input.projectId,
    evidence_type: "document_report",
    entity_type: "document_intelligence_reports",
    entity_id: input.reportId,
    label: `Reporte documental · ${input.fileName}`,
    confidence: input.confidence == null ? null : Number(input.confidence),
    metadata: {
      fileId: input.fileId,
      fileName: input.fileName,
      documentType: input.documentType,
      verdict: input.verdict,
      summary: input.summary,
    },
  });
}
