"""Database connection management: Beanie/Mongo, Qdrant, Redis lazy clients."""
from __future__ import annotations

from typing import Any

from beanie import Document, init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
# Patch Beanie compatibility with newer Motor versions
AsyncIOMotorClient.append_metadata = lambda *args, **kwargs: None

from qdrant_client import AsyncQdrantClient
from redis.asyncio import Redis

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

_settings = get_settings()

# Lazy singletons (created on startup, closed on shutdown).
_motor_client: AsyncIOMotorClient | None = None
_qdrant_client: AsyncQdrantClient | None = None
_redis: Redis | None = None


async def connect_mongodb(document_models: list[type[Document]]) -> None:
    """Initialize Motor + Beanie models.

    Connection loss at startup is logged but does NOT abort booting — the
    health endpoint will report `mongodb: false` so operators can see the
    outage. This keeps the API responsive for unrelated flows during a
    transient Mongo outage.
    """
    global _motor_client
    log.info("connecting_mongodb")
    _motor_client = AsyncIOMotorClient(
        _settings.mongo_uri, serverSelectionTimeoutMS=10000, connectTimeoutMS=10000
    )
    try:
        await _motor_client.admin.command("ping")
    except Exception as exc:  # noqa: BLE001
        log.warning("mongodb_unreachable_at_startup", error=str(exc))
        return
    db = _motor_client.get_default_database()
    if _settings.app_env == "test" and not db.name.endswith("_test"):
        db = _motor_client[db.name + "_test"]
    await init_beanie(database=db, document_models=document_models)
    log.info("mongodb_connected", db=db.name)


async def close_mongodb() -> None:
    global _motor_client
    if _motor_client is not None:
        log.info("closing_mongodb")
        _motor_client.close()
        _motor_client = None


def get_motor_client() -> AsyncIOMotorClient:
    if _motor_client is None:
        raise RuntimeError("MongoDB not initialized")
    return _motor_client


def get_qdrant_client() -> AsyncQdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = AsyncQdrantClient(
            url=_settings.qdrant_url,
            api_key=_settings.qdrant_api_key or None,
        )
    return _qdrant_client


async def close_qdrant() -> None:
    global _qdrant_client
    if _qdrant_client is not None:
        try:
            await _qdrant_client.close()
        except Exception:
            pass
        _qdrant_client = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(
            _settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2.0,
            socket_timeout=5.0,
            max_connections=50,
        )
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        log.info("closing_redis")
        try:
            await _redis.aclose()
        except Exception:
            pass
        _redis = None


async def ping_mongodb() -> bool:
    try:
        if _motor_client is None:
            return False
        # Reuse existing client but with a short selection timeout for the probe.
        await _motor_client.admin.command("ping")
        return True
    except Exception:
        return False


async def ping_qdrant() -> bool:
    try:
        client = get_qdrant_client()
        await client.get_collections()
        return True
    except Exception:
        return False


async def ping_redis() -> bool:
    try:
        await get_redis().ping()
        return True
    except Exception:
        return False


async def ping_llm() -> dict[str, Any]:
    """Lightweight model-gateway config check (offline)."""
    try:
        return {
            "ok": bool(_settings.chat_model and _settings.embedding_model),
            "chat_model": _settings.chat_model,
            "embedding_model": _settings.embedding_model,
            "gateway": "litellm",
        }
    except Exception:
        return {"ok": False}