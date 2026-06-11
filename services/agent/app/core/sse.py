"""Encoder del Vercel AI SDK UI Message Stream v1.

Contrato observado del runtime TS (toUIMessageStreamResponse, ai v6):
eventos `data: {json}` con tipos start, start-step, reasoning-start/-delta/-end,
text-start/-delta/-end, tool-input-start, tool-input-available,
tool-output-available, tool-output-error, finish-step, finish, y cierre `data: [DONE]`.
El frontend (useChat) consume esto sin cambios.
"""
from __future__ import annotations

import json
from typing import Any


def event(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def done() -> str:
    return "data: [DONE]\n\n"


def start() -> str:
    return event({"type": "start"})


def start_step() -> str:
    return event({"type": "start-step"})


def finish_step() -> str:
    return event({"type": "finish-step"})


def finish(reason: str = "stop") -> str:
    return event({"type": "finish", "finishReason": reason})


def reasoning_start(block_id: str) -> str:
    return event({"type": "reasoning-start", "id": block_id})


def reasoning_delta(block_id: str, delta: str) -> str:
    return event({"type": "reasoning-delta", "id": block_id, "delta": delta})


def reasoning_end(block_id: str) -> str:
    return event({"type": "reasoning-end", "id": block_id})


def text_start(block_id: str) -> str:
    return event({"type": "text-start", "id": block_id})


def text_delta(block_id: str, delta: str) -> str:
    return event({"type": "text-delta", "id": block_id, "delta": delta})


def text_end(block_id: str) -> str:
    return event({"type": "text-end", "id": block_id})


def tool_input_start(tool_call_id: str, tool_name: str) -> str:
    return event({"type": "tool-input-start", "toolCallId": tool_call_id, "toolName": tool_name})


def tool_input_available(tool_call_id: str, tool_name: str, tool_input: Any) -> str:
    return event({
        "type": "tool-input-available",
        "toolCallId": tool_call_id,
        "toolName": tool_name,
        "input": tool_input,
    })


def tool_output_available(tool_call_id: str, output: Any) -> str:
    return event({"type": "tool-output-available", "toolCallId": tool_call_id, "output": output})


def tool_output_error(tool_call_id: str, error_text: str) -> str:
    return event({"type": "tool-output-error", "toolCallId": tool_call_id, "errorText": error_text})
