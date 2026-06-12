"""El encoder SSE debe respetar el contrato UI Message Stream v1 del AI SDK."""
import json

from app.core import sse


def parse(line: str) -> dict:
    assert line.startswith("data: ") and line.endswith("\n\n")
    return json.loads(line[len("data: "):])


def test_done_es_literal():
    assert sse.done() == "data: [DONE]\n\n"


def test_finish_lleva_reason():
    assert parse(sse.finish("length")) == {"type": "finish", "finishReason": "length"}


def test_error_lleva_error_text():
    payload = parse(sse.error("falló"))
    assert payload["type"] == "error"
    assert payload["errorText"] == "falló"


def test_tool_events_llevan_call_id_consistente():
    start = parse(sse.tool_input_start("call_1", "auditar_subcontratos"))
    available = parse(sse.tool_input_available("call_1", "auditar_subcontratos", {"a": 1}))
    output = parse(sse.tool_output_available("call_1", {"ok": True}))
    assert start["toolCallId"] == available["toolCallId"] == output["toolCallId"] == "call_1"
    assert available["input"] == {"a": 1}


def test_unicode_sin_escapar():
    # ensure_ascii=False: el frontend recibe texto legible, no \uXXXX
    assert "obra terminada ✓" in sse.text_delta("t1", "obra terminada ✓")
