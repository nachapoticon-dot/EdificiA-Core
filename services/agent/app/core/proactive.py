"""Señales operativas proactivas inyectadas al turno.

El corazón del "PM continuo": el agente conoce los hallazgos abiertos y los
vencimientos próximos de su scope SIN que se los pregunten, y los menciona
cuando son relevantes. Lecturas best-effort: si fallan, el turno sigue.
"""
from __future__ import annotations

import logging
from typing import Any

from app.db.pool import get_pool

log = logging.getLogger("agent.proactive")

MAX_FINDINGS = 6
MAX_EXPIRING = 5


async def fetch_operational_signals(org_id: str, project_id: str | None) -> dict[str, list[dict[str, Any]]]:
    signals: dict[str, list[dict[str, Any]]] = {"findings": [], "expiring_hse": []}
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            project_filter = "AND project_id = $2" if project_id else ""
            params = [org_id] + ([project_id] if project_id else [])

            rows = await conn.fetch(
                f"""
                SELECT title, severity, type
                FROM operational_findings
                WHERE organization_id = $1 AND status = 'open' AND deleted_at IS NULL {project_filter}
                ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
                         created_at DESC
                LIMIT {MAX_FINDINGS}
                """,
                *params,
            )
            signals["findings"] = [dict(r) for r in rows]

            rows = await conn.fetch(
                f"""
                SELECT subject_name, record_type, expires_at::date::text AS expires_on
                FROM project_hse_records
                WHERE organization_id = $1 AND deleted_at IS NULL {project_filter}
                  AND expires_at IS NOT NULL
                  AND expires_at BETWEEN now() AND now() + interval '14 days'
                ORDER BY expires_at ASC
                LIMIT {MAX_EXPIRING}
                """,
                *params,
            )
            signals["expiring_hse"] = [dict(r) for r in rows]
    except Exception:  # noqa: BLE001
        log.warning("fetch_operational_signals failed", exc_info=True)
    return signals


def render_signals_block(signals: dict[str, list[dict[str, Any]]]) -> str:
    findings = signals.get("findings") or []
    expiring = signals.get("expiring_hse") or []
    if not findings and not expiring:
        return ""
    lines = [
        "\n## Señales operativas vivas (conocelas sin que te las pregunten)",
        "Mencionalas cuando sean relevantes para la consulta o la apertura del día:",
    ]
    for f in findings:
        lines.append(f"- [hallazgo {f.get('severity', '?')}] {f.get('title', '')}")
    for e in expiring:
        lines.append(f"- [vence {e.get('expires_on', '?')}] {e.get('record_type', 'registro')} de {e.get('subject_name', '?')}")
    return "\n".join(lines)
