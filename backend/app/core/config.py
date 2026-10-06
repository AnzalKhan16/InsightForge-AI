"""Centralised, typed application settings loaded from environment variables."""
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="IF_", extra="ignore")

    app_name: str = "InsightForge AI API"
    app_version: str = "0.1.0"
    environment: str = "development"  # development | test | production
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    # Comma-separated list in env, e.g. IF_CORS_ORIGINS=http://localhost:3000
    cors_origins: list[str] = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
