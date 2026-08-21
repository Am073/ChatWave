"""Centralized settings for ChatWave v2 backend.

Validates environment variables at startup using pydantic-settings. The server
hard-fails on misconfiguration rather than silently falling back to defaults.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- Runtime ----
    app_name: str = "ChatWave v2"
    version: str = "2.0.0"
    app_env: Literal["development", "production", "test"] = "development"
    api_prefix: str = "/api"
    backend_port: int = 8000

    # ---- Security ----
    jwt_secret: str = Field(min_length=16)
    jwt_refresh_secret: str = Field(min_length=16)
    csrf_secret: str = Field(min_length=16)
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # ---- Mongo ----
    mongo_uri: str

    # ---- Qdrant ----
    qdrant_url: str
    qdrant_api_key: str | None = None
    qdrant_collection_prefix: str = "cw_"
    embedding_dim: int = 768

    # ---- Redis / Celery ----
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str | None = None
    celery_result_backend: str | None = None

    # ---- LiteLLM / models ----
    # LLM provider keys (at least one is required in production)
    gemini_api_key: str | None = None
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    # Default chat / embedding model (Gemini is the free-tier default)
    chat_model: str = "gemini/gemini-2.0-flash"
    embedding_model: str = "gemini/embedding-001"
    # Allow admins to switch the default model at runtime (stored in-memory)
    enable_runtime_model_switch: bool = True
    # Cost guard: max tokens allowed in a single LLM completion
    max_completion_tokens: int = 2048

    # ---- Langfuse (optional) ----
    langfuse_secret_key: str | None = None
    langfuse_public_key: str | None = None
    langfuse_host: AnyHttpUrl | str | None = "https://cloud.langfuse.com"

    # ---- CORS ----
    frontend_url: AnyHttpUrl = "http://localhost:5173"  # type: ignore[assignment]
    additional_cors_origins: list[str] = Field(default_factory=list)

    # ---- Upload limits ----
    max_upload_mb: int = 50
    # Local directory where uploaded files are kept so failed ingestions can
    # be retried without a re-upload. ponytail: single-node local disk; swap
    # for S3/GCS object storage when the API and workers run on many hosts.
    upload_dir: str = "uploads"
    allowed_mime_types: tuple[str, ...] = (
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/png",
        "image/jpeg",
        "image/webp",
    )

    # ---- Agent loop control ----
    agent_max_iterations: int = 5
    retrieval_top_k: int = 5
    use_hybrid_filter: bool = True

    prompt_version: str = "v2.0"

    # ---- Rate limiting (Redis-backed sliding window) ----
    rate_limit_enabled: bool = True
    rate_limit_default_per_minute: int = 120
    rate_limit_auth_per_minute: int = 10
    rate_limit_chat_per_minute: int = 30
    rate_limit_upload_per_minute: int = 20

    # ---- Google Calendar OAuth ----
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    google_oauth_redirect_uri: str = "http://localhost:8000/api/calendar/oauth/callback"

    @computed_field  # type: ignore[misc]
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @computed_field  # type: ignore[misc]
    @property
    def cors_origins(self) -> list[str]:
        origins = [str(self.frontend_url).rstrip("/")]
        origins.extend(self.additional_cors_origins)
        return origins

    @computed_field  # type: ignore[misc]
    @property
    def effective_broker_url(self) -> str:
        return self.celery_broker_url or self.redis_url

    @computed_field  # type: ignore[misc]
    @property
    def effective_result_backend(self) -> str:
        return self.celery_result_backend or self.redis_url

    @computed_field  # type: ignore[misc]
    @property
    def available_providers(self) -> list[str]:
        """List of LLM providers with a configured API key."""
        providers: list[str] = []
        if self.gemini_api_key:
            providers.append("gemini")
        if self.anthropic_api_key:
            providers.append("anthropic")
        if self.openai_api_key:
            providers.append("openai")
        return providers

    @computed_field  # type: ignore[misc]
    @property
    def available_chat_models(self) -> list[str]:
        """Curated catalog of supported chat models per available provider."""
        catalog: list[str] = []
        if self.gemini_api_key:
            catalog.extend(
                [
                    "gemini/gemini-2.0-flash",
                    "gemini/gemini-2.5-pro",
                    "gemini/gemini-1.5-flash",
                ]
            )
        if self.anthropic_api_key:
            catalog.extend(
                [
                    "anthropic/claude-3-5-sonnet-latest",
                    "anthropic/claude-3-5-haiku-latest",
                    "anthropic/claude-3-opus-20240229",
                ]
            )
        if self.openai_api_key:
            catalog.extend(
                [
                    "openai/gpt-4o",
                    "openai/gpt-4o-mini",
                    "openai/gpt-4-turbo",
                ]
            )
        return catalog


# Test fallback default overrides allow config to load in unit tests.
_TEST_OVERRIDES = {
    "mongo_uri": "mongodb://127.0.0.1:27017/chatwave_test",
    "jwt_secret": "test_jwt_secret_32_chars_minimum",
    "jwt_refresh_secret": "test_refresh_secret_32_chars_min",
    "csrf_secret": "test_csrf_secret_32_chars_minimum",
    "qdrant_url": "http://localhost:6333",
}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor."""
    import os

    if os.getenv("APP_ENV") == "test":
        # Merge test overrides for any unset critical settings.
        for key, value in _TEST_OVERRIDES.items():
            os.environ.setdefault(key.upper(), value)
    return Settings()  # type: ignore[call-arg]