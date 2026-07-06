"""Public + admin health endpoints."""
from __future__ import annotations

from fastapi import APIRouter
from structlog import get_logger

from app.core.config import get_settings
from app.core.db import ping_llm, ping_mongodb, ping_qdrant, ping_redis

router = APIRouter()
log = get_logger(__name__)
_settings = get_settings()


@router.get("/health")
async def health() -> dict:
    """Liveness/readiness: aggregates dependency health checks."""
    services = {
        "mongodb": await ping_mongodb(),
        "qdrant": await ping_qdrant(),
        "redis": await ping_redis(),
    }
    services["llm"] = await ping_llm()
    overall = all(
        v if isinstance(v, bool) else bool(v.get("ok")) for v in services.values()
    )
    return {
        "status": "ok" if overall else "degraded",
        "version": _settings.version,
        "services": services,
    }


@router.get("/health/live")
async def liveness() -> dict:
    return {"status": "alive"}