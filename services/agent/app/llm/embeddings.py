from __future__ import annotations

import logging

import httpx

from app.config import get_settings

log = logging.getLogger("agent.embeddings")

EMBEDDING_DIM = 1024

# Cliente compartido: cada turno puede embeber varias veces (retrieval + saves
# de reflexión); abrir una conexión TLS nueva por llamada suma latencia inútil.
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=15.0)
    return _client


async def embed_text(text: str) -> list[float] | None:
    """bge-m3 vía NVIDIA NIM (mismo modelo que el RAG TS). None si no hay key o falla."""
    settings = get_settings()
    if not settings.nvidia_api_key:
        return None
    try:
        res = await _get_client().post(
            "https://integrate.api.nvidia.com/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.nvidia_api_key}"},
            json={"model": "baai/bge-m3", "input": text[:8000], "encoding_format": "float"},
        )
        res.raise_for_status()
        return res.json()["data"][0]["embedding"]
    except Exception:  # noqa: BLE001
        log.warning("embed_text failed", exc_info=True)
        return None


def to_vector_literal(embedding: list[float]) -> str:
    return "[" + ",".join(str(x) for x in embedding) + "]"
