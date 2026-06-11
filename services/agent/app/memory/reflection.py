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
        raw = (completion.choices[0].message.content or "").strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        items = json.loads(raw)
        if not isinstance(items, list):
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
