"""Port del router de modelos de src/lib/ai/model-router.ts.

Misma semántica de señales y scoring para que el tier/model/reason registrados
en agent_runs sean comparables entre el backend TS y el Python.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.config import get_settings

CROSS_DOC_KEYWORDS = [
    "cruzar", "cruz ", "cruza ",
    "varios documentos", "múltiples documentos", "multiples documentos",
    "todos los documentos", "varias versiones", "varias obras",
    "transversal", "consolidado", "consolidad",
]

CONTRADICTION_KEYWORDS = [
    "contradicci", "contradict", "inconsistenci", "incongruenc",
    "discrepanci", "no coincide", "no coinciden", "no cierra", "no cuadra",
]

A_VS_B_PATTERN = re.compile(r"\bA\s*(vs|versus|contra|frente a)\s*B\b", re.IGNORECASE)

DEEP_HINT_KEYWORDS = [
    "razonamiento profundo", "modelo profundo", "modelo avanzado",
    "analizar a fondo", "auditoría profunda", "auditoria profunda",
    "auditar a fondo",
]

LONG_TURN_THRESHOLD_CHARS = 8000


@dataclass
class RouteDecision:
    tier: str  # "fast" | "deep"
    model: str
    reason: str
    step_budget: int


def text_from_ui_message(message: dict) -> str:
    parts = message.get("parts") or []
    return " ".join(p.get("text") or "" for p in parts if p.get("type") == "text")


def route_model(messages: list[dict]) -> RouteDecision:
    settings = get_settings()
    last_text = text_from_ui_message(messages[-1]) if messages else ""
    lower = last_text.lower()

    score = 0
    reasons: list[str] = []

    if A_VS_B_PATTERN.search(last_text) or "comparar_presupuestos" in lower:
        score += 3
        reasons.append("comparativa A vs B")
    if any(kw in lower for kw in CONTRADICTION_KEYWORDS):
        score += 2
        reasons.append("intención de contradicción")
    if any(kw in lower for kw in CROSS_DOC_KEYWORDS):
        score += 2
        reasons.append("cross-doc explícito")
    if any(kw in lower for kw in DEEP_HINT_KEYWORDS):
        score += 2
        reasons.append("usuario pidió razonamiento profundo")
    if len(last_text) > LONG_TURN_THRESHOLD_CHARS:
        score += 1
        reasons.append("turno > 8k caracteres")
    if "__file_meta__" in last_text:
        score += 1
        reasons.append("archivo adjunto")

    tier = "deep" if score >= 3 else "fast"
    model = settings.deep_model if tier == "deep" else settings.fast_model
    reason = ", ".join(reasons) if reasons else "baseline (chitchat / tarea simple)"
    step_budget = 35 if tier == "deep" else 20
    return RouteDecision(tier=tier, model=model, reason=reason, step_budget=step_budget)
