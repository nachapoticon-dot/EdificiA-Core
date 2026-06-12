"""Extracción robusta del JSON de reflexión (los modelos thinking lo envuelven en texto)."""
from app.memory.reflection import _extract_json_array


def test_array_limpio():
    assert _extract_json_array('[{"kind": "fact", "content": "x"}]') == [{"kind": "fact", "content": "x"}]


def test_con_fences_markdown():
    assert _extract_json_array('```json\n[{"a": 1}]\n```') == [{"a": 1}]


def test_con_preambulo_y_texto_posterior():
    raw = 'Analizando el turno, extraigo:\n[{"kind": "preference", "content": "usa ARS"}]\nEso es todo.'
    assert _extract_json_array(raw) == [{"kind": "preference", "content": "usa ARS"}]


def test_array_vacio():
    assert _extract_json_array("No hay nada durable.\n[]") == []


def test_corchetes_dentro_de_strings():
    raw = 'resultado: [{"content": "la curva [S] del proyecto"}] fin'
    assert _extract_json_array(raw) == [{"content": "la curva [S] del proyecto"}]


def test_sin_json_devuelve_none():
    assert _extract_json_array("No se encontraron aprendizajes durables en este turno.") is None
    assert _extract_json_array("") is None


def test_objeto_no_array_devuelve_none():
    assert _extract_json_array('{"kind": "fact"}') is None
