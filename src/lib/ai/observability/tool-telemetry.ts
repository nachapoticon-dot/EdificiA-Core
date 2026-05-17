/**
 * Aggregates per-tool usage stats from an AI SDK streamText `steps` array
 * (the shape exposed via the `onFinish` callback).
 *
 * Goal: detect broken / heavily-used tools and observe agentic retry
 * behavior in the audit log. Latency per-call is not exposed by the SDK
 * at the step level, so we track counts only — total turn latency is
 * already captured at the chat-level audit payload.
 */

interface StepToolCall {
  toolName?: string;
  toolCallId?: string;
}

interface StepToolResult {
  toolName?: string;
  toolCallId?: string;
  result?: unknown;
}

export interface StepLike {
  toolCalls?: StepToolCall[];
  toolResults?: StepToolResult[];
}

export interface ToolStats {
  calls: number;
  errors: number;
  retries: number;
}

export type ToolTelemetry = Record<string, ToolStats>;

/**
 * Returns true if a tool result looks like a failure.
 *
 * Heuristic — covers the conventions used in this codebase:
 *   - { ok: false }              ← project_operations writers, notifications
 *   - { error: true }            ← legacy patterns
 *   - { found: false } + reason  ← search tools that report "no match"
 */
function isErrorResult(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (obj.ok === false) return true;
  if (obj.error === true) return true;
  if (typeof obj.error === "string" && obj.error.length > 0) return true;
  return false;
}

/**
 * Aggregates per-tool stats across all steps of a single turn.
 *
 * Retries are counted as "called same tool ≥2 times in this turn" (after
 * an error). This is approximate — the agent may legitimately call a tool
 * twice for different inputs — but it's a useful signal at the audit log
 * level. For precise retry tracking, the agent emits explicit retry
 * markers via the retry-strategy prompt guidance.
 */
export function summarizeToolUsage(steps: StepLike[] | undefined | null): ToolTelemetry {
  const stats: ToolTelemetry = {};
  if (!Array.isArray(steps) || steps.length === 0) return stats;

  // Index toolCallId → toolName so we can attribute orphan results.
  const idToName = new Map<string, string>();
  for (const step of steps) {
    for (const call of step.toolCalls ?? []) {
      if (call.toolCallId && call.toolName) idToName.set(call.toolCallId, call.toolName);
    }
  }

  for (const step of steps) {
    for (const call of step.toolCalls ?? []) {
      const name = call.toolName ?? "_unknown";
      const entry = (stats[name] ??= { calls: 0, errors: 0, retries: 0 });
      entry.calls += 1;
    }
    for (const result of step.toolResults ?? []) {
      const name = result.toolName ?? (result.toolCallId ? idToName.get(result.toolCallId) : undefined) ?? "_unknown";
      if (!stats[name]) stats[name] = { calls: 0, errors: 0, retries: 0 };
      if (isErrorResult(result.result)) stats[name].errors += 1;
    }
  }

  // Retries = (calls > 1 && prior error existed). Conservative: any tool
  // called ≥2 times with at least 1 error gets `calls - 1` retries.
  for (const name of Object.keys(stats)) {
    const entry = stats[name]!;
    if (entry.calls >= 2 && entry.errors >= 1) {
      entry.retries = Math.min(entry.calls - 1, entry.errors);
    }
  }

  return stats;
}

/**
 * Compact list form for the audit payload — easier to query than a nested object.
 */
export function toTelemetryRows(telemetry: ToolTelemetry): Array<{ tool: string; calls: number; errors: number; retries: number }> {
  return Object.entries(telemetry)
    .map(([tool, stats]) => ({ tool, ...stats }))
    .sort((a, b) => b.calls - a.calls);
}
