import { getInsForgeAdminClient } from "@/lib/insforge/server";

interface AuditStep {
  toolResults?: {
    toolName: string;
    result: unknown;
  }[];
}

interface ExclusionesResult {
  byseverity?: {
    error:   { code: string }[];
    warning: { code: string }[];
  };
  ok?: boolean;
}

interface BatchResult {
  hallazgos?: { severity: string; code: string }[];
}

/**
 * Called via streamText's onFinish callback.
 * Extracts audit findings from the session and persists them in
 * company_learned_patterns so future sessions benefit from accumulated context.
 * Non-fatal — never throws.
 */
export async function learnFromSession(
  steps: AuditStep[],
  orgId: string,
): Promise<void> {
  try {
    const allResults = steps.flatMap((s) => s.toolResults ?? []);

    const exclusiones = allResults.find(
      (r) => r.toolName === "detectar_exclusiones_logicas",
    )?.result as ExclusionesResult | undefined;

    const batch = allResults.find(
      (r) => r.toolName === "reportar_hallazgos_batch",
    )?.result as BatchResult | undefined;

    // Only learn when an audit was actually performed
    if (!exclusiones && !batch) return;

    const errorCodes   = exclusiones?.byseverity?.error.map((e) => e.code)   ?? [];
    const warningCodes = exclusiones?.byseverity?.warning.map((e) => e.code) ?? [];
    const batchCodes   = batch?.hallazgos
      ?.filter((h) => h.severity === "error" || h.severity === "warning")
      .map((h) => h.code) ?? [];

    const newCodes = [...new Set([...errorCodes, ...warningCodes, ...batchCodes])];
    if (newCodes.length === 0) return;

    const client = getInsForgeAdminClient();

    const { data: existing } = await client.database
      .from("company_learned_patterns")
      .select("id, pattern_value, sample_count")
      .eq("organization_id", orgId)
      .eq("document_type", "audit_history")
      .eq("pattern_key", "recent_error_codes")
      .maybeSingle();

    const prevCodes = (existing?.pattern_value as string[] | undefined) ?? [];
    // Keep union, cap at 30 most recent unique codes
    const merged = Array.from(new Set([...newCodes, ...prevCodes])).slice(0, 30);

    if (existing) {
      await client.database
        .from("company_learned_patterns")
        .update({
          pattern_value: merged,
          sample_count:  (existing.sample_count as number ?? 0) + 1,
          updated_at:    new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await client.database
        .from("company_learned_patterns")
        .insert({
          organization_id: orgId,
          document_type:   "audit_history",
          pattern_key:     "recent_error_codes",
          pattern_value:   merged,
        });
    }
  } catch {
    // Non-fatal — learning is best-effort
  }
}
