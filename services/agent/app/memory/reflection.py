"""Reflexión post-turno: destilación de aprendizajes durables por LLM.

Al cierre de cada turno (async, best-effort) se le pide al modelo que extraiga
0-2 aprendizajes que valga la pena recordar sobre la empresa, sus obras o las
preferencias del usuario — no resúmenes del turno. Esto reemplaza la extracción
heurística de session-learner.ts: acá decide un modelo, no un regex.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from app.config import get_settings
from app.llm.deepseek import get_deepseek
from app.memory.store import save_memory

log = logging.getLogger("agent.reflection")


def _extract_json_array(raw: str) -> list | None:
    """Extrae el primer array JSON del texto del modelo.

    Los modelos thinking suelen envolver el JSON en preámbulo, razonamiento o
    fences; parsear el texto crudo directo falla casi siempre. Se busca el
    primer '[' y se intenta desde ahí hasta cada ']' candidato (de atrás hacia
    adelante) para tolerar texto posterior.
    """
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else None
    except json.JSONDecodeError:
        pass
    start = raw.find("[")
    if start == -1:
        return None
    end = raw.rfind("]")
    while end > start:
        try:
            parsed = json.loads(raw[start : end + 1])
            return parsed if isinstance(parsed, list) else None
        except json.JSONDecodeError:
            end = raw.rfind("]", start, end)
    return None

REFLECTION_PROMPT = """Sos el módulo de memoria de un agente de gestión de obras de construcción.
Analizá el intercambio y extraé SOLO aprendizajes durables que sirvan en futuras conversaciones
con esta misma constructora: preferencias del usuario, hechos de la empresa u obra, correcciones
que el usuario hizo al agente, o procedimientos que el usuario espera.

NO guardes: resúmenes del turno, datos que ya están en documentos, trivialidades, saludos.
Si no hay nada durable, devolvé una lista vacía.

Respondé SOLO un JSON array (sin markdown), cada item:
{"kind": "preference|correction|fact|procedure", "content": "texto autocontenido en español", "confidence": 0.0-1.0, "scope": "org|project"}"""


async def reflect_on_turn(
    *,
    org_id: str,
    project_id: str | None,
    work_case_id: str | None,
    agent_run_id: str | None,
    user_text: str,
    assistant_text: str,
    tool_telemetry: list[dict[str, Any]],
) -> int:
    """Devuelve cuántas memorias se guardaron. Nunca lanza."""
    if not user_text.strip() or not assistant_text.strip():
        return 0
    try:
        client = get_deepseek()
        tools_used = ", ".join(t["toolName"] for t in tool_telemetry) or "ninguna"
        completion = await client.chat.completions.create(
            model=get_settings().fast_model,
            messages=[
                {"role": "system", "content": REFLECTION_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Usuario dijo:\n{user_text[:4000]}\n\n"
                        f"Agente respondió:\n{assistant_text[:4000]}\n\n"
                        f"Tools usadas: {tools_used}"
                    ),
                },
            ],
            temperature=0.1,
            max_tokens=600,
        )
        message = completion.choices[0].message
        raw = (message.content or "").strip() or (getattr(message, "reasoning_content", None) or "").strip()
        items = _extract_json_array(raw)
        if items is None:
            log.warning("reflection output sin JSON array (primeros 200 chars): %r", raw[:200])
            return 0

        saved = 0
        for item in items[:2]:
            kind = item.get("kind")
            if kind not in ("preference", "correction", "fact", "procedure"):
                continue
            scope = "project" if (item.get("scope") == "project" and project_id) else "org"
            memory_id = await save_memory(
                org_id=org_id,
                scope=scope,
                kind=kind,
                content=str(item.get("content", "")),
                confidence=min(0.7, float(item.get("confidence", 0.5))),  # la reflexión no supera 0.7; el feedback humano sí
                source="reflection",
                project_id=project_id if scope == "project" else None,
                work_case_id=work_case_id,
                source_run_id=agent_run_id,
            )
            if memory_id:
                saved += 1
        return saved
    except Exception:  # noqa: BLE001
        log.warning("reflection failed", exc_info=True)
        return 0


CASE_REFLECTION_PROMPT = """Sos el módulo de memoria de un agente de gestión de obras. Se acaba de CERRAR un expediente operativo.
Analizá el caso completo (título, tipo, veredicto, resumen y eventos) y extraé 0-2 aprendizajes durables
para futuros expedientes de esta constructora: qué tipo de evidencia decidió el caso, qué procedimiento
siguió el equipo, qué criterio fijó el cierre. NO resumas el caso: extraé lo reutilizable.
Si no hay nada durable, devolvé lista vacía.
Respondé SOLO un JSON array: {"kind": "procedure|fact|preference", "content": "...", "confidence": 0.0-1.0}"""


async def reflect_on_case_closure(
    *,
    org_id: str,
    work_case_id: str,
    project_id: str | None,
    agent_run_id: str | None,
) -> int:
    """Destila un expediente cerrado a memoria de empresa. Nunca lanza."""
    from app.db.pool import get_pool

    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            case = await conn.fetchrow(
                """
                SELECT title, kind, status, verdict, summary
                FROM work_cases
                WHERE id = $1 AND organization_id = $2
                """,
                work_case_id, org_id,
            )
            if case is None:
                return 0
            events = await conn.fetch(
                """
                SELECT event_type, summary FROM work_case_events
                WHERE work_case_id = $1 AND organization_id = $2
                ORDER BY created_at DESC LIMIT 12
                """,
                work_case_id, org_id,
            )

        events_text = "\n".join(f"- {e['event_type']}: {e['summary'] or ''}" for e in events)
        case_text = (
            f"Expediente: {case['title']} (tipo {case['kind']})\n"
            f"Estado: {case['status']} · Veredicto: {case['verdict'] or 'sin veredicto'}\n"
            f"Resumen de cierre: {case['summary'] or 'sin resumen'}\n"
            f"Eventos recientes:\n{events_text}"
        )

        client = get_deepseek()
        completion = await client.chat.completions.create(
            model=get_settings().fast_model,
            messages=[
                {"role": "system", "content": CASE_REFLECTION_PROMPT},
                {"role": "user", "content": case_text[:6000]},
            ],
            temperature=0.1,
            max_tokens=500,
        )
        message = completion.choices[0].message
        raw = (message.content or "").strip() or (getattr(message, "reasoning_content", None) or "").strip()
        items = _extract_json_array(raw)
        if items is None:
            log.warning("case reflection output sin JSON array (primeros 200 chars): %r", raw[:200])
            return 0

        saved = 0
        for item in items[:2]:
            kind = item.get("kind")
            if kind not in ("procedure", "fact", "preference"):
                continue
            memory_id = await save_memory(
                org_id=org_id,
                scope="project" if project_id else "org",
                kind=kind,
                content=str(item.get("content", "")),
                confidence=min(0.7, float(item.get("confidence", 0.5))),
                source="reflection",
                project_id=project_id,
                work_case_id=work_case_id,
                source_run_id=agent_run_id,
            )
            if memory_id:
                saved += 1
        return saved
    except Exception:  # noqa: BLE001
        log.warning("case-closure reflection failed", exc_info=True)
        return 0


async def process_feedback(feedback_id: str) -> bool:
    """Convierte feedback explícito en memoria. Negativo con corrección → kind=correction (alta confianza)."""
    from app.db.pool import get_pool

    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT f.id, f.organization_id, f.rating, f.comment, f.correction, f.agent_run_id,
                       r.project_id, r.work_case_id
                FROM agent_feedback f
                LEFT JOIN agent_runs r ON r.id = f.agent_run_id
                WHERE f.id = $1 AND f.processed_at IS NULL
                """,
                feedback_id,
            )
            if row is None:
                return False

            if row["rating"] < 0 and (row["correction"] or row["comment"]):
                await save_memory(
                    org_id=str(row["organization_id"]),
                    scope="project" if row["project_id"] else "org",
                    kind="correction",
                    content=str(row["correction"] or row["comment"]),
                    confidence=0.9,  # corrección humana explícita
                    source="feedback",
                    project_id=str(row["project_id"]) if row["project_id"] else None,
                    work_case_id=str(row["work_case_id"]) if row["work_case_id"] else None,
                    source_run_id=str(row["agent_run_id"]) if row["agent_run_id"] else None,
                )
            await conn.execute("UPDATE agent_feedback SET processed_at = now() WHERE id = $1", feedback_id)
            return True
    except Exception:  # noqa: BLE001
        log.warning("process_feedback failed", exc_info=True)
        return False
