"""Memoria episódica del agente sobre Postgres + pgvector.

- save_memory: inserta con embedding; si existe una memoria casi idéntica
  (coseno > 0.92, mismo scope) la refuerza en vez de duplicar.
- retrieve_memories: top-k semántico filtrado por org/obra/expediente, con
  confianza efectiva (decay) y refuerzo de las recuperadas.
- render_memories_block: sección de prompt con los aprendizajes.
"""
from __future__ import annotations

import logging
from typing import Any

from app.db.pool import get_pool
from app.llm.embeddings import embed_text, to_vector_literal
from app.memory import decay

log = logging.getLogger("agent.memory")

DEDUPE_SIMILARITY = 0.92
RETRIEVE_TOP_K = 5


async def save_memory(
    *,
    org_id: str,
    scope: str,
    kind: str,
    content: str,
    confidence: float,
    source: str,
    project_id: str | None = None,
    work_case_id: str | None = None,
    source_run_id: str | None = None,
) -> str | None:
    content = content.strip()
    if len(content) < 10:
        return None
    embedding = await embed_text(content)
    vector = to_vector_literal(embedding) if embedding else None

    pool = await get_pool()
    async with pool.acquire() as conn:
        if vector:
            # ¿Ya sabemos esto? Reforzar en vez de duplicar.
            existing = await conn.fetchrow(
                """
                SELECT id, confidence, 1 - (embedding <=> $2::vector) AS similarity
                FROM agent_memories
                WHERE organization_id = $1 AND deleted_at IS NULL AND embedding IS NOT NULL
                  AND scope = $3 AND coalesce(project_id::text,'') = coalesce($4,'')
                ORDER BY embedding <=> $2::vector
                LIMIT 1
                """,
                org_id, vector, scope, project_id or "",
            )
            if existing and existing["similarity"] is not None and float(existing["similarity"]) > DEDUPE_SIMILARITY:
                await conn.execute(
                    "UPDATE agent_memories SET confidence = $2, use_count = use_count + 1, last_used_at = now() WHERE id = $1",
                    existing["id"], max(decay.reinforced(float(existing["confidence"])), confidence),
                )
                return str(existing["id"])

        row = await conn.fetchrow(
            """
            INSERT INTO agent_memories (
              organization_id, project_id, work_case_id, scope, kind, content,
              embedding, confidence, source, source_run_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7::vector,$8,$9,$10)
            RETURNING id
            """,
            org_id, project_id, work_case_id, scope, kind, content,
            vector, confidence, source, source_run_id,
        )
        log.info("memory saved org=%s kind=%s scope=%s", org_id, kind, scope)
        return str(row["id"]) if row else None


async def retrieve_memories(
    *,
    org_id: str,
    query_text: str,
    project_id: str | None = None,
    work_case_id: str | None = None,
    top_k: int = RETRIEVE_TOP_K,
) -> list[dict[str, Any]]:
    pool = await get_pool()
    embedding = await embed_text(query_text) if query_text.strip() else None

    scope_filter = """
      AND (scope = 'org'
           OR (scope = 'project' AND project_id = $2)
           OR (scope = 'work_case' AND work_case_id = $3))
    """

    async with pool.acquire() as conn:
        if embedding:
            rows = await conn.fetch(
                f"""
                SELECT id, kind, scope, content, confidence, use_count, last_used_at, created_at,
                       1 - (embedding <=> $4::vector) AS similarity
                FROM agent_memories
                WHERE organization_id = $1 AND deleted_at IS NULL AND embedding IS NOT NULL
                {scope_filter}
                ORDER BY embedding <=> $4::vector
                LIMIT $5
                """,
                org_id, project_id, work_case_id, to_vector_literal(embedding), top_k * 3,
            )
        else:
            rows = await conn.fetch(
                f"""
                SELECT id, kind, scope, content, confidence, use_count, last_used_at, created_at,
                       NULL::float AS similarity
                FROM agent_memories
                WHERE organization_id = $1 AND deleted_at IS NULL
                {scope_filter}
                ORDER BY last_used_at DESC NULLS LAST, created_at DESC
                LIMIT $4
                """,
                org_id, project_id, work_case_id, top_k,
            )

        selected: list[dict[str, Any]] = []
        for r in rows:
            eff = decay.effective_confidence(float(r["confidence"]), r["last_used_at"], r["created_at"])
            if eff < decay.MIN_EFFECTIVE_CONFIDENCE:
                continue
            if r["similarity"] is not None and float(r["similarity"]) < 0.35:
                continue
            selected.append({
                "id": str(r["id"]),
                "kind": r["kind"],
                "scope": r["scope"],
                "content": r["content"],
                "confidence": round(eff, 2),
            })
            if len(selected) >= top_k:
                break

        if selected:
            await conn.execute(
                "UPDATE agent_memories SET use_count = use_count + 1, last_used_at = now() WHERE id = ANY($1::uuid[])",
                [m["id"] for m in selected],
            )
        return selected


KIND_LABELS = {
    "correction": "corrección del usuario",
    "preference": "preferencia",
    "fact": "hecho verificado",
    "procedure": "procedimiento",
}


def render_memories_block(memories: list[dict[str, Any]]) -> str:
    if not memories:
        return ""
    lines = [
        "\n## Memoria del agente (aprendizajes previos de esta empresa)",
        "Aplicá estos aprendizajes cuando correspondan. Provienen de correcciones y reflexiones verificadas:",
    ]
    for m in memories:
        label = KIND_LABELS.get(m["kind"], m["kind"])
        lines.append(f"- [{label} · confianza {m['confidence']}] {m['content']}")
    return "\n".join(lines)
