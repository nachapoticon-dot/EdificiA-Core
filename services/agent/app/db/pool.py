from __future__ import annotations

import json

import asyncpg

from app.config import get_settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        async def _init(conn: asyncpg.Connection) -> None:
            # jsonb <-> dict transparente
            await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")

        _pool = await asyncpg.create_pool(get_settings().database_url, min_size=1, max_size=5, init=_init)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
