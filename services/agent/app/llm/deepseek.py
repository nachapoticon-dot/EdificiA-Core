from __future__ import annotations

from functools import lru_cache

import httpx
from openai import AsyncOpenAI

from app.config import get_settings


@lru_cache
def get_deepseek() -> AsyncOpenAI:
    settings = get_settings()
    # read=90: si el stream queda mudo 90 segundos (provider colgado), abortamos
    # y el loop emite error limpio — sin esto un turno puede colgar hasta 10 min.
    timeout = httpx.Timeout(connect=10.0, read=90.0, write=30.0, pool=10.0)
    return AsyncOpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url, timeout=timeout)
