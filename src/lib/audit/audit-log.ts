import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import type { PiiScanResult } from "@/lib/security/pii-detector";

type AuditSeverity = "info" | "warning" | "error" | "security";

interface AuditLogEventInput {
  organizationId: string;
  projectId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  severity?: AuditSeverity;
  requestId?: string | null;
  payload?: Record<string, unknown>;
  piiScan?: PiiScanResult | null;
}

/**
 * Append-only audit event writer. Best-effort until every environment has
 * migration 016 applied; callers must not fail user workflows if logging fails.
 */
export async function writeAuditLogEvent(input: AuditLogEventInput): Promise<void> {
  try {
    const client = getInsForgeAdminClient();
    const result = await client.database
      .from("audit_log_events")
      .insert({
        organization_id: input.organizationId,
        project_id: input.projectId ?? null,
        actor_user_id: input.actorUserId ?? null,
        event_type: input.eventType,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        severity: input.severity ?? "info",
        source: "app",
        request_id: input.requestId ?? null,
        payload: input.payload ?? {},
        pii_scan: input.piiScan ?? null,
      });

    if (result.error) {
      dbLogger.warn({ err: result.error, eventType: input.eventType }, "audit log insert failed");
    }
  } catch (err) {
    dbLogger.warn({ err, eventType: input.eventType }, "audit log insert failed");
  }
}
