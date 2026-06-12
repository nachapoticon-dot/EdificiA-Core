from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import get_settings
from app.core import sse
from app.core.loop import TurnContext, TurnResult, run_turn
from app.core.proactive import fetch_operational_signals, render_signals_block
from app.core.router import route_model, text_from_ui_message
from app.db.writers import write_turn_accounting
from app.memory.reflection import reflect_on_case_closure, reflect_on_turn
from app.memory.store import render_memories_block, retrieve_memories

log = logging.getLogger("agent.chat")
router = APIRouter()

# Referencias fuertes a las tareas post-turno (contabilidad + reflexión): sin
# esto asyncio puede recolectarlas a mitad de ejecución y se pierde trazabilidad.
_background_tasks: set[asyncio.Task] = set()


def _spawn_background(coro) -> None:
    task = asyncio.get_running_loop().create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


class ChatRequest(BaseModel):
    messages: list[dict[str, Any]]
    orgId: str
    userId: str
    projectName: str | None = None
    projectId: str | None = None
    chatSessionId: str | None = None
    requestId: str | None = None


def _check_secret(secret: str | None) -> None:
    expected = get_settings().agent_gateway_secret
    if not expected or secret != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/v1/chat/stream")
async def chat_stream(
    body: ChatRequest,
    request: Request,
    x_agent_secret: str | None = Header(default=None),
) -> StreamingResponse:
    _check_secret(x_agent_secret)
    gateway = request.app.state.gateway

    # Señales del turno: el contexto de Next.js decide modos (prompt + tools)
    recent_text = "\n".join(text_from_ui_message(m) for m in body.messages[-6:])
    has_file = "__file_meta__" in recent_text or "cacheId" in recent_text

    # Contexto efectivo (prompt modular, scope validado, tools del turno) desde
    # Next.js: mismo runtime context que el backend TS, cero divergencia.
    runtime_ctx = await gateway.context(
        org_id=body.orgId,
        user_id=body.userId,
        project_name=body.projectName,
        project_id=body.projectId,
        chat_session_id=body.chatSessionId,
        recent_text=recent_text,
        has_file=has_file,
    )
    route = route_model(body.messages)
    scope = runtime_ctx.get("agentScope") or {}

    # Memoria episódica (aprendizaje real) + señales operativas vivas (PM continuo).
    # En paralelo: la memoria embebe el texto vía NVIDIA (~cientos de ms) y las
    # señales solo leen Postgres — secuenciarlas suma latencia al primer token.
    user_text = text_from_ui_message(body.messages[-1]) if body.messages else ""
    memories, signals = await asyncio.gather(
        retrieve_memories(
            org_id=body.orgId,
            query_text=user_text,
            project_id=runtime_ctx.get("auditProjectId"),
            work_case_id=scope.get("workCaseId"),
        ),
        fetch_operational_signals(body.orgId, runtime_ctx.get("auditProjectId")),
    )
    system_prompt = runtime_ctx["systemPrompt"] + render_signals_block(signals) + render_memories_block(memories)

    ctx = TurnContext(
        org_id=body.orgId,
        user_id=body.userId,
        project_id=runtime_ctx.get("auditProjectId"),
        work_case_id=scope.get("workCaseId"),
        chat_session_id=body.chatSessionId,
        request_id=body.requestId,
        system_prompt=system_prompt,
        agent_scope={
            "level": scope.get("scopeLevel"),
            "organizationId": scope.get("organizationId"),
            "projectId": scope.get("projectId"),
            "workCaseId": scope.get("workCaseId"),
            "workCaseKind": scope.get("workCaseKind"),
        },
        capability_ids=runtime_ctx.get("capabilityIds") or [],
        route=route,
        allowed_tool_names=set(runtime_ctx["toolNames"]) if runtime_ctx.get("toolNames") else None,
    )
    result = TurnResult()
    log.info(
        "turn start org=%s tier=%s model=%s budget=%d reason=%s",
        ctx.org_id, route.tier, route.model, route.step_budget, route.reason,
    )

    async def stream() -> AsyncIterator[str]:
        try:
            async for event in run_turn(ctx, body.messages, gateway, result):
                yield event
        except Exception:  # noqa: BLE001 — el stream jamás muere mudo: el frontend necesita error+[DONE]
            log.exception("turn crashed mid-stream org=%s session=%s", ctx.org_id, ctx.chat_session_id)
            yield sse.error("El agente tuvo un problema procesando este turno. Reintentá en unos segundos.")
            yield sse.finish("error")
            yield sse.done()
        finally:
            # Contabilidad + reflexión fuera del stream para no demorar el [DONE]
            _spawn_background(_account_and_reflect(ctx, result, user_text))

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "x-vercel-ai-ui-message-stream": "v1",
        },
    )


async def _account_and_reflect(ctx: TurnContext, result: TurnResult, user_text: str) -> None:
    from datetime import datetime, timezone

    agent_run_id = await write_turn_accounting(
        org_id=ctx.org_id,
        user_id=ctx.user_id,
        project_id=ctx.project_id,
        work_case_id=ctx.work_case_id,
        chat_session_id=ctx.chat_session_id,
        request_id=ctx.request_id,
        model=ctx.route.model,
        tier=ctx.route.tier,
        route_reason=ctx.route.reason,
        capability_ids=ctx.capability_ids,
        agent_scope=ctx.agent_scope,
        step_budget=ctx.route.step_budget,
        steps=result.steps,
        usage=result.usage,
        tool_telemetry=result.telemetry_rows(),
        started_at=result.started_at,
        finished_at=result.finished_at or datetime.now(timezone.utc),
    )

    # Reflexión: destilar aprendizajes durables del turno (best-effort)
    saved = await reflect_on_turn(
        org_id=ctx.org_id,
        project_id=ctx.project_id,
        work_case_id=ctx.work_case_id,
        agent_run_id=agent_run_id,
        user_text=user_text,
        assistant_text=result.final_text,
        tool_telemetry=result.telemetry_rows(),
    )
    if saved:
        log.info("reflection saved %d memories org=%s", saved, ctx.org_id)

    # Si el agente cerró un expediente, destilar el caso completo
    if ctx.work_case_id and any(t["toolName"] == "proponer_cierre_expediente" for t in result.telemetry_rows()):
        closed = await reflect_on_case_closure(
            org_id=ctx.org_id,
            work_case_id=ctx.work_case_id,
            project_id=ctx.project_id,
            agent_run_id=agent_run_id,
        )
        if closed:
            log.info("case-closure reflection saved %d memories org=%s", closed, ctx.org_id)
