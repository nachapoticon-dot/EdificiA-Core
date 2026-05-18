import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import type { ProactivityFinding, ProjectProactivitySummary } from "./daily-scan";

type AdminClient = ReturnType<typeof getInsForgeAdminClient>;

interface ExistingFindingRow {
  id: string;
  finding_key: string;
}

export async function replaceProjectOperationalFindings(
  client: AdminClient,
  summary: ProjectProactivitySummary,
  scannedAt: Date,
): Promise<void> {
  const scannedAtIso = scannedAt.toISOString();
  const rows = summary.findings.map((finding) => toOperationalFindingRow(finding, scannedAtIso));

  try {
    if (rows.length > 0) {
      const upsertResult = await client.database
        .from("operational_findings")
        .upsert(rows, { onConflict: "organization_id,project_id,finding_key" });

      if (upsertResult.error) {
        dbLogger.warn(
          { err: upsertResult.error, projectId: summary.projectId },
          "operational findings upsert failed",
        );
        return;
      }
    }

    const existingResult = await client.database
      .from("operational_findings")
      .select("id, finding_key")
      .eq("organization_id", summary.organizationId)
      .eq("project_id", summary.projectId)
      .eq("source", "proactivity_scan")
      .eq("status", "open")
      .is("deleted_at", null)
      .limit(500);

    if (existingResult.error) {
      dbLogger.warn(
        { err: existingResult.error, projectId: summary.projectId },
        "operational findings stale query failed",
      );
      return;
    }

    const currentKeys = new Set(summary.findings.map((finding) => finding.id));
    const staleRows = ((existingResult.data ?? []) as ExistingFindingRow[])
      .filter((row) => !currentKeys.has(row.finding_key));

    await Promise.all(staleRows.map((row) => client.database
      .from("operational_findings")
      .update({
        status: "resolved",
        resolved_at: scannedAtIso,
        updated_at: scannedAtIso,
        scanned_at: scannedAtIso,
      })
      .eq("id", row.id)
      .eq("organization_id", summary.organizationId)));
  } catch (err) {
    dbLogger.warn({ err, projectId: summary.projectId }, "operational findings replace failed");
  }
}

function toOperationalFindingRow(finding: ProactivityFinding, scannedAtIso: string) {
  return {
    organization_id: finding.organizationId,
    project_id: finding.projectId,
    project_name: finding.projectName,
    finding_key: finding.id,
    type: finding.type,
    severity: finding.severity,
    status: "open",
    title: finding.title,
    detail: finding.detail,
    entity_type: finding.entityType,
    entity_id: finding.entityId ?? null,
    due_date: toDateOnly(finding.dueDate),
    source: "proactivity_scan",
    metadata: finding.metadata ?? {},
    last_detected_at: scannedAtIso,
    resolved_at: null,
    scanned_at: scannedAtIso,
    updated_at: scannedAtIso,
  };
}

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
