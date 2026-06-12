"""Helpers puros del loop de turnos: conversión de historial y detección de errores."""
from app.core.loop import _looks_like_error, ui_messages_to_openai


def test_system_prompt_va_primero():
    out = ui_messages_to_openai([], "SOS EL PM")
    assert out == [{"role": "system", "content": "SOS EL PM"}]


def test_descarta_roles_y_mensajes_vacios():
    out = ui_messages_to_openai(
        [
            {"role": "user", "parts": [{"type": "text", "text": "hola"}]},
            {"role": "system", "parts": [{"type": "text", "text": "ignorado"}]},
            {"role": "assistant", "parts": [{"type": "text", "text": "   "}]},
        ],
        "S",
    )
    assert [m["role"] for m in out] == ["system", "user"]


def test_reinyecta_evidencia_de_tools_previas():
    messages = [
        {"role": "user", "parts": [{"type": "text", "text": "¿cómo viene la curva?"}]},
        {
            "role": "assistant",
            "parts": [
                {
                    "type": "tool-auditar_curva_inversion",
                    "state": "output-available",
                    "output": {"desvio_pct": -12.5},
                },
                {"type": "text", "text": "La curva tiene un desvío del 12,5%."},
            ],
        },
        {"role": "user", "parts": [{"type": "text", "text": "¿y contra el mes pasado?"}]},
    ]
    out = ui_messages_to_openai(messages, "S")
    assistant = out[2]["content"]
    assert "auditar_curva_inversion" in assistant
    assert "-12.5" in assistant
    assert "La curva tiene un desvío" in assistant


def test_ignora_tools_sin_output():
    messages = [
        {
            "role": "assistant",
            "parts": [
                {"type": "tool-buscar", "state": "input-available", "input": {}},
                {"type": "text", "text": "buscando..."},
            ],
        },
    ]
    out = ui_messages_to_openai(messages, "S")
    assert out[1]["content"] == "buscando..."


def test_trunca_outputs_largos():
    messages = [
        {
            "role": "assistant",
            "parts": [
                {"type": "tool-buscar", "state": "output-available", "output": {"x": "a" * 5000}},
            ],
        },
    ]
    out = ui_messages_to_openai(messages, "S")
    assert len(out[1]["content"]) < 1000
    assert out[1]["content"].endswith("…")


def test_looks_like_error():
    assert _looks_like_error({"ok": False})
    assert _looks_like_error({"error": "boom"})
    assert not _looks_like_error({"ok": True, "data": []})
    assert not _looks_like_error("texto plano")
