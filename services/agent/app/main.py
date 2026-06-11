from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.chat import router as chat_router
from app.api.feedback import router as feedback_router
from app.db.pool import close_pool, get_pool
from app.tools.gateway import ToolGateway

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.gateway = ToolGateway()
    await get_pool()
    yield
    await app.state.gateway.close()
    await close_pool()


app = FastAPI(title="EdificIA Agent", lifespan=lifespan)
app.include_router(chat_router)
app.include_router(feedback_router)


@app.get("/healthz")
async def healthz() -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.fetchval("SELECT 1")
    return {"status": "ok", "service": "edificia-agent"}
