from __future__ import annotations

from functools import lru_cache

from openai import AsyncOpenAI

from app.config import get_settings


@lru_cache
def get_deepseek() -> AsyncOpenAI:
    settings = get_settings()
    return AsyncOpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
