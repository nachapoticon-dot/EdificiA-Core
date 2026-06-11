from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuración del servicio del agente (env vars, ver .env.example)."""

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    database_url: str = "postgres://edificia:edificia_dev@localhost:5432/edificia"
    agent_gateway_secret: str = ""
    nextjs_internal_url: str = "http://localhost:3000"
    nvidia_api_key: str = ""
    ai_model: str = "deepseek-v4-flash"
    ai_model_fast: str = ""
    ai_model_deep: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def fast_model(self) -> str:
        return self.ai_model_fast or self.ai_model

    @property
    def deep_model(self) -> str:
        return self.ai_model_deep or self.fast_model


@lru_cache
def get_settings() -> Settings:
    return Settings()
