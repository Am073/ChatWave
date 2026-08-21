"""Startup environment validation: fail-fast on misconfiguration.

Runs at app boot to ensure the deployment has all required environment variables
and the values pass basic sanity checks (length, format, non-empty, valid URLs).
Production deployments must have:
- All JWT/CSRF secrets at least 32 chars
- Database URIs reachable (we only validate format)
- At least one LLM provider configured
"""
from __future__ import annotations

import re

from app.core.logging import get_logger

log = get_logger(__name__)


class StartupValidationError(RuntimeError):
    """Raised when critical environment configuration is missing or invalid."""


def validate_required_env(settings: object) -> None:
    """Validate critical env-var requirements; raise StartupValidationError on failure."""
    errors: list[str] = []

    is_prod = getattr(settings, "is_production", False)
    min_secret_len = 32 if is_prod else 16

    for secret_name in ("jwt_secret", "jwt_refresh_secret", "csrf_secret"):
        value = getattr(settings, secret_name, None) or ""
        if len(value) < min_secret_len:
            errors.append(
                f"{secret_name.upper()} must be at least {min_secret_len} characters "
                f"(current length: {len(value)})"
            )

    mongo_uri = getattr(settings, "mongo_uri", "") or ""
    if not re.match(r"^mongodb(\+srv)?://", mongo_uri):
        errors.append("MONGO_URI must start with 'mongodb://' or 'mongodb+srv://'")

    qdrant_url = getattr(settings, "qdrant_url", "") or ""
    if not re.match(r"^https?://", qdrant_url):
        errors.append("QDRANT_URL must start with 'http://' or 'https://'")

    redis_url = getattr(settings, "redis_url", "") or ""
    if not re.match(r"^rediss?://", redis_url):
        errors.append("REDIS_URL must start with 'redis://' or 'rediss://'")

    available_providers = getattr(settings, "available_providers", []) or []
    if is_prod and not available_providers:
        errors.append(
            "Production requires at least one LLM provider key "
            "(GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY)"
        )

    fe_url = str(getattr(settings, "frontend_url", "") or "")
    if not re.match(r"^https?://", fe_url):
        errors.append("FRONTEND_URL must start with 'http://' or 'https://'")

    if getattr(settings, "google_oauth_client_id", None) and not getattr(
        settings, "google_oauth_client_secret", None
    ):
        errors.append("GOOGLE_OAUTH_CLIENT_SECRET is required when GOOGLE_OAUTH_CLIENT_ID is set")

    if errors:
        message = "Environment validation failed:\n  - " + "\n  - ".join(errors)
        log.error("env_validation_failed", errors=errors)
        raise StartupValidationError(message)
