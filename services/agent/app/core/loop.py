"""Loop de turnos del agente: LLM → tool_calls → gateway → repeat.

Emite UI Message Stream v1 (ver sse.py) para que el frontend useChat no cambie.
Maneja reasoning_content de DeepSeek (thinking mode): se streamea como bloque
reasoning y se reinyecta en el historial del paso siguiente, como exige la API.
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.config import get_settings
from app.core import sse
from app.core.router import RouteDecision
from app.llm.deepseek import get_deepseek
from app.tools.gateway import ToolGateway, manifest_to_openai_tools

log = logging.getLogger("agent.loop")


@dataclass
class TurnContext:
    org_id: str
    user_id: str
    project_id: str | None
    work_case_id: str | None
    chat_session_id: str | None
    request_id: str | None
    system_prompt: str
    agent_scope: dict[str, Any]
    capability_ids: list[str]
    route: RouteDecision


@dataclass
class TurnResult:
    steps: int = 0
    usage: dict[str, Any] = field(default_factory=dict)
    tool_telemetry: dict[str, dict[str, int]] = field(default_factory=dict)
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: datetime | None = None
    final_text: str = ""

    def telemetry_rows(self) -> list[dict[str, Any]]:
        rows = [
            {"toolName": name, **counts}
            for name, counts in self.tool_telemetry.items()
        ]
        rows.sort(key=lambda r: r["calls"], reverse=True)
        return rows


def ui_messages_to_openai(messages: list[dict], system_prompt: str) -> list[dict]:
    """Convierte UI messages (parts) al formato chat de OpenAI/DeepSeek."""
    out: list[dict] = [{"role": "system", "content": system_prompt}]
    for m in messages:
        role = m.get("role")
        if role not in ("user", "assistant"):
            continue
        text = "".join(p.get("text") or "" for p in (m.get("parts") or []) if p.get("type") == "text")
        if text.strip():
            out.append({"role": role, "content": text})
    return out


def _looks_like_error(output: Any) -> bool:
    if isinstance(output, dict):
        if output.get("ok") is False or output.get("error"):
            return True
    return False


async def run_turn(
    ctx: TurnContext,
    ui_messages: list[dict],
    gateway: ToolGateway,
    result: TurnResult,
) -> AsyncIterator[str]:
    """Generador SSE del turno completo."""
    settings = get_settings()
    client = get_deepseek()

    manifest = await gateway.manifest()
    openai_tools = manifest_to_openai_tools(manifest)
    messages = ui_messages_to_openai(ui_messages, ctx.system_prompt)

    yield sse.start()

    finish_reason = "stop"
    for step_index in range(ctx.route.step_budget):
        result.steps = step_index + 1
        yield sse.start_step()

        stream = await client.chat.completions.create(
            model=ctx.route.model,
            messages=messages,
            tools=openai_tools,
            stream=True,
            stream_options={"include_usage": True},
        )

        reasoning_text = ""
        content_text = ""
        reasoning_open = False
        text_open = False
        rid = f"reasoning-{step_index}"
        tid = f"txt-{step_index}"
        # index → {id, name, arguments}
        tool_calls: dict[int, dict[str, str]] = {}
        step_finish: str | None = None

        async for chunk in stream:
            if chunk.usage is not None:
                result.usage = _map_usage(chunk.usage)
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta

            r_delta = getattr(delta, "reasoning_content", None)
            if r_delta:
                if not reasoning_open:
                    reasoning_open = True
                    yield sse.reasoning_start(rid)
                reasoning_text += r_delta
                yield sse.reasoning_delta(rid, r_delta)

            if delta.content:
                if reasoning_open:
                    reasoning_open = False
                    yield sse.reasoning_end(rid)
                if not text_open:
                    text_open = True
                    yield sse.text_start(tid)
                content_text += delta.content
                yield sse.text_delta(tid, delta.content)

            for tc in delta.tool_calls or []:
                entry = tool_calls.setdefault(tc.index, {"id": "", "name": "", "arguments": ""})
                if tc.id:
                    entry["id"] = tc.id
                if tc.function and tc.function.name:
                    if not entry["name"]:
                        yield sse.tool_input_start(tc.id or f"call_{step_index}_{tc.index}", tc.function.name)
                    entry["name"] = tc.function.name
                if tc.function and tc.function.arguments:
                    entry["arguments"] += tc.function.arguments

            if choice.finish_reason:
                step_finish = choice.finish_reason

        if reasoning_open:
            yield sse.reasoning_end(rid)
        if text_open:
            yield sse.text_end(tid)
        if content_text.strip():
            result.final_text = content_text

        if not tool_calls:
            yield sse.finish_step()
            finish_reason = step_finish or "stop"
            break

        # Hubo tool calls: ejecutarlas vía gateway y continuar el loop
        assistant_msg: dict[str, Any] = {
            "role": "assistant",
            "content": content_text or None,
            "tool_calls": [
                {
                    "id": call["id"] or f"call_{step_index}_{idx}",
                    "type": "function",
                    "function": {"name": call["name"], "arguments": call["arguments"] or "{}"},
                }
                for idx, call in sorted(tool_calls.items())
            ],
        }
        # DeepSeek thinking mode exige devolver reasoning_content del assistant
        if reasoning_text:
            assistant_msg["reasoning_content"] = reasoning_text
        messages.append(assistant_msg)

        for idx, call in sorted(tool_calls.items()):
            call_id = call["id"] or f"call_{step_index}_{idx}"
            name = call["name"]
            try:
                parsed_input = json.loads(call["arguments"]) if call["arguments"] else {}
            except json.JSONDecodeError:
                parsed_input = {}
            yield sse.tool_input_available(call_id, name, parsed_input)

            gw = await gateway.execute(
                tool_name=name,
                tool_input=parsed_input,
                org_id=ctx.org_id,
                user_id=ctx.user_id,
                project_id=ctx.project_id,
                work_case_id=ctx.work_case_id,
            )
            output = gw.get("output") if gw.get("ok") else {"error": gw.get("error", "tool failed")}

            counters = result.tool_telemetry.setdefault(name, {"calls": 0, "errors": 0, "retries": 0})
            counters["calls"] += 1
            if not gw.get("ok") or _looks_like_error(output):
                counters["errors"] += 1

            if gw.get("ok"):
                yield sse.tool_output_available(call_id, output)
            else:
                yield sse.tool_output_error(call_id, str(gw.get("error", "tool failed")))

            messages.append({
                "role": "tool",
                "tool_call_id": call_id,
                "content": json.dumps(output, ensure_ascii=False, default=str),
            })

        yield sse.finish_step()
    else:
        finish_reason = "length"  # se agotó el step budget

    result.finished_at = datetime.now(timezone.utc)
    yield sse.finish(finish_reason if finish_reason in ("stop", "length", "tool-calls") else "stop")
    yield sse.done()


def _map_usage(usage: Any) -> dict[str, Any]:
    raw = usage.model_dump() if hasattr(usage, "model_dump") else dict(usage)
    return {
        "inputTokens": raw.get("prompt_tokens"),
        "outputTokens": raw.get("completion_tokens"),
        "totalTokens": raw.get("total_tokens"),
        "raw": raw,
    }
