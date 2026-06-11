from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import get_settings
from app.core.loop import TurnContext, TurnResult, run_turn
from app.core.router import route_model
from app.db.writers import write_turn_accounting

log = logging.getLogger("agent.chat")
router = APIRouter()


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

    # Contexto efectivo (prompt, scope validado, capabilities) desde Next.js:
    # mismo runtime context que el backend TS, cero divergencia de prompt.
    runtime_ctx = await gateway.context(
        org_id=body.orgId,
        user_id=body.userId,
        project_name=body.projectName,
        project_id=body.projectId,
        chat_session_id=body.chatSessionId,
    )
    route = route_model(body.messages)
    scope = runtime_ctx.get("agentScope") or {}

    ctx = TurnContext(
        org_id=body.orgId,
        user_id=body.userId,
        project_id=runtime_ctx.get("auditProjectId"),
        work_case_id=scope.get("workCaseId"),
        chat_session_id=body.chatSessionId,
        request_id=body.requestId,
        system_prompt=runtime_ctx["systemPrompt"],
        agent_scope={
            "level": scope.get("scopeLevel"),
            "organizationId": scope.get("organizationId"),
            "projectId": scope.get("projectId"),
            "workCaseId": scope.get("workCaseId"),
            "workCaseKind": scope.get("workCaseKind"),
        },
        capability_ids=runtime_ctx.get("capabilityIds") or [],
        route=route,
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
        finally:
            # Contabilidad fuera del stream para no demorar el [DONE]
            asyncio.get_running_loop().create_task(_account(ctx, result))

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "x-vercel-ai-ui-message-stream": "v1",
        },
    )


async def _account(ctx: TurnContext, result: TurnResult) -> None:
    from datetime import datetime, timezone

    await write_turn_accounting(
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
