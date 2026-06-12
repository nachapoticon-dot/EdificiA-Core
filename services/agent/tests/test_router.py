"""Tests del router de modelos: misma semántica que src/lib/ai/model-router.ts."""
from app.core.router import route_model, text_from_ui_message


def msg(text: str) -> dict:
    return {"role": "user", "parts": [{"type": "text", "text": text}]}


def test_baseline_es_fast():
    decision = route_model([msg("hola, ¿cómo viene el día?")])
    assert decision.tier == "fast"
    assert decision.step_budget == 20
    assert "baseline" in decision.reason


def test_contradiccion_mas_crossdoc_es_deep():
    decision = route_model([msg("cruzá todos los documentos y buscá contradicciones en los presupuestos")])
    assert decision.tier == "deep"
    assert decision.step_budget == 35


def test_comparativa_a_vs_b_es_deep():
    decision = route_model([msg("compará el presupuesto A vs B de la torre")])
    assert decision.tier == "deep"
    assert "comparativa" in decision.reason


def test_pedido_explicito_profundo_suma_pero_no_alcanza_solo():
    decision = route_model([msg("quiero un análisis con razonamiento profundo")])
    # score 2 < 3 → fast: una sola señal débil no escala el modelo
    assert decision.tier == "fast"


def test_mensajes_vacios_no_rompen():
    decision = route_model([])
    assert decision.tier == "fast"


def test_text_from_ui_message_ignora_parts_no_texto():
    m = {"role": "user", "parts": [{"type": "file", "url": "x"}, {"type": "text", "text": "hola"}]}
    assert text_from_ui_message(m) == "hola"
