import { createHash } from "node:crypto";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger, REQUEST_ID_HEADER } from "@/lib/logger";

export interface CaptureAppErrorInput {
  err: unknown;
  req?: Request;
  organizationId?: string | null;
  projectId?: string | null;
  actorUserId?: string | null;
  route: string;
  severity?: "warning" | "error" | "critical";
  context?: Record<string, unknown>;
}

export async function captureAppError(input: CaptureAppErrorInput): Promise<void> {
  try {
    const serialized = serializeError(input.err);
    const requestId = input.req?.headers.get(REQUEST_ID_HEADER) ?? null;
    const method = input.req?.method ?? null;
    const fingerprint = createFingerprint(input.route, serialized.message);

    const client = getInsForgeAdminClient();
    const result = await client.database.from("app_error_events").insert({
      organization_id: input.organizationId ?? null,
      project_id: input.projectId ?? null,
      actor_user_id: input.actorUserId ?? null,
      request_id: requestId,
      route: input.route,
      method,
      severity: input.severity ?? "error",
      fingerprint,
      message: serialized.message,
      stack: serialized.stack,
      context: input.context ?? {},
    });

    if (result.error) {
      dbLogger.warn({ err: result.error, route: input.route }, "app error event insert failed");
    }
  } catch (err) {
    dbLogger.warn({ err, route: input.route }, "app error event capture failed");
  }
}

function serializeError(err: unknown): { message: string; stack: string | null } {
  if (err instanceof Error) {
    return {
      message: err.message || err.name,
      stack: err.stack?.slice(0, 8000) ?? null,
    };
  }
  if (typeof err === "string") return { message: err, stack: null };
  return { message: safeStringifyUnknown(err).slice(0, 1000), stack: null };
}

function createFingerprint(route: string, message: string): string {
  return createHash("sha256").update(`${route}:${message}`).digest("hex").slice(0, 32);
}

function safeStringifyUnknown(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    return serialized ?? String(value);
  } catch {
    return String(value);
  }
}
