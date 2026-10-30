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
    # Comma-separated list or JSON array in env, e.g. IF_CORS_ORIGINS=* or IF_CORS_ORIGINS=http://localhost:3000
    cors_origins: list[str] | str = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://insight-forge-ai-orcin.vercel.app",
    ]

    # Auth
    secret_key: str = "super-secret-key-for-dev-only"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Database (PostgreSQL via psycopg 3). Override with IF_DATABASE_URL.
    database_url: str = "postgresql+psycopg://insightforge:insightforge@localhost:5432/insightforge"
    db_echo: bool = False
    db_pool_size: int = 5
    db_max_overflow: int = 10

    # Storage
    storage_backend: str = "local"  # local, s3
    storage_local_dir: str = "./data/raw"

    # Redis Cache & Background Queue
    redis_url: str = "redis://localhost:6379/0"

    # AI / LLM Integration
    llm_provider: str = "openai"  # openai, gemini, or mock/deterministic
    openai_api_key: str | None = None
    openai_api_base: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    gemini_api_key: str | None = None

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    import json
                    return json.loads(v)
                except Exception:
                    pass
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_database_url(cls, v):
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+psycopg://", 1)
            if v.startswith("postgresql://") and not v.startswith("postgresql+"):
                return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
