"""Contabilidad del turno: agent_runs + audit_log_events + work_case_events.

Mismo shape que el onFinish del runtime TS (src/app/api/chat/route.ts,
agent-run-writer.ts) para que el replay de auditoría y la vista de expediente
funcionen igual con cualquiera de los dos backends. Todo best-effort: una
falla acá nunca rompe el turno.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from app.db.pool import get_pool

log = logging.getLogger("agent.writers")


async def write_turn_accounting(
    *,
    org_id: str,
    user_id: str,
    project_id: str | None,
    work_case_id: str | None,
    chat_session_id: str | None,
    request_id: str | None,
    model: str,
    tier: str,
    route_reason: str,
    capability_ids: list[str],
    agent_scope: dict[str, Any],
    step_budget: int,
    steps: int,
    usage: dict[str, Any],
    tool_telemetry: list[dict[str, Any]],
    started_at: datetime,
    finished_at: datetime,
) -> str | None:
    latency_ms = int((finished_at - started_at).total_seconds() * 1000)
    tool_calls_total = sum(t["calls"] for t in tool_telemetry)
    tool_errors_total = sum(t["errors"] for t in tool_telemetry)
    tool_retries_total = sum(t["retries"] for t in tool_telemetry)
    agent_run_id: str | None = None

    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO agent_runs (
                  organization_id, project_id, work_case_id, chat_session_id, actor_user_id,
                  status, model_provider, model, tier, route_reason, capability_ids,
                  step_budget, steps, usage, tool_telemetry,
                  tool_calls_total, tool_errors_total, tool_retries_total,
                  latency_ms, request_id, started_at, finished_at
                ) VALUES ($1,$2,$3,$4,$5,'completed','deepseek',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
                RETURNING id
                """,
                org_id, project_id, work_case_id, chat_session_id, user_id,
                model, tier, route_reason, capability_ids,
                step_budget, steps, usage, tool_telemetry,
                tool_calls_total, tool_errors_total, tool_retries_total,
                latency_ms, request_id, started_at, finished_at,
            )
            agent_run_id = str(row["id"]) if row else None

            audit_payload = {
                "agentRunId": agent_run_id,
                "model": model,
                "tier": tier,
                "routeReason": route_reason,
                "agentCore": {"scope": agent_scope, "capabilityIds": capability_ids},
                "stepBudget": step_budget,
                "steps": steps,
                "usage": usage,
                "latencyMs": latency_ms,
                "toolTelemetry": tool_telemetry,
                "toolCallsTotal": tool_calls_total,
                "toolErrorsTotal": tool_errors_total,
                "toolRetriesTotal": tool_retries_total,
                "agentBackend": "python",
            }
            await conn.execute(
                """
                INSERT INTO audit_log_events (
                  organization_id, project_id, actor_user_id, event_type, entity_type,
                  entity_id, severity, source, request_id, payload
                ) VALUES ($1,$2,$3,'chat.completed','chat_turn',$4,$5,'app',$6,$7)
                """,
                org_id, project_id, user_id, agent_run_id,
                "warning" if tool_errors_total > 0 else "info",
                request_id, audit_payload,
            )

            if work_case_id:
                await conn.execute(
                    """
                    INSERT INTO work_case_events (
                      organization_id, work_case_id, project_id, actor_user_id,
                      event_type, summary, payload
                    ) VALUES ($1,$2,$3,$4,'chat.turn_completed',NULL,$5)
                    """,
                    org_id, work_case_id, project_id, user_id,
                    {
                        "tier": tier,
                        "model": model,
                        "stepBudget": step_budget,
                        "steps": steps,
                        "toolCallsTotal": tool_calls_total,
                        "toolErrorsTotal": tool_errors_total,
                        "toolRetriesTotal": tool_retries_total,
                        "latencyMs": latency_ms,
                        "agentRunId": agent_run_id,
                    },
                )
    except Exception:  # noqa: BLE001
        log.warning("turn accounting failed", exc_info=True)

    return agent_run_id
