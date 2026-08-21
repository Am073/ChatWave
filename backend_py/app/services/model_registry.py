"""Runtime model registry: allows admins to switch the active chat model.

The override lives in Redis so it applies consistently across API workers.
If Redis is unavailable, we fail soft to a per-process mirror (and then the
settings default), so an outage can never break chat.

Consulted by `chat_service.resolve_model()` on every request, so admins can
roll out a new model without a deploy.
"""
from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

_OVERRIDE_KEY = "chatwave:model_override"
# Per-process mirror used only when Redis is unreachable.
_memory_override: str | None = None


async def _read_override() -> str | None:
    from app.core.db import get_redis

    try:
        return await get_redis().get(_OVERRIDE_KEY)
    except Exception as exc:  # noqa: BLE001 - Redis down must not break chat
        log.warning("model_registry_redis_unavailable", error=str(exc))
        return _memory_override


async def _write_override(model: str | None) -> None:
    global _memory_override
    _memory_override = model
    from app.core.db import get_redis

    try:
        redis = get_redis()
        if model is None:
            await redis.delete(_OVERRIDE_KEY)
        else:
            await redis.set(_OVERRIDE_KEY, model)
    except Exception as exc:  # noqa: BLE001
        log.warning("model_registry_redis_unavailable", error=str(exc))


async def get_active_chat_model() -> str | None:
    """Return the currently active chat model, or None if no override is set."""
    return await _read_override()


async def set_active_chat_model(model: str | None) -> None:
    """Set (or clear) the active chat model override."""
    clean = None if model is None or not model.strip() else model.strip()
    await _write_override(clean)
    log.info("active_chat_model_changed", model=clean)


async def get_model_status() -> dict:
    """Return the current default + override + supported model catalog."""
    settings = get_settings()
    override = await _read_override()
    return {
        "default_model": settings.chat_model,
        "active_model": override or settings.chat_model,
        "available_models": settings.available_chat_models,
        "available_providers": settings.available_providers,
        "allow_runtime_switch": settings.enable_runtime_model_switch,
    }


async def set_model_override(model: str) -> dict:
    """Validate and set a new chat model override. Returns the new status."""
    settings = get_settings()
    if not settings.enable_runtime_model_switch:
        raise ValueError("Runtime model switching is disabled by configuration")
    available = settings.available_chat_models
    if available and model not in available:
        raise ValueError(
            f"Model {model!r} is not in the available catalog. "
            f"Available: {available}"
        )
    await set_active_chat_model(model)
    return await get_model_status()


async def clear_model_override() -> dict:
    """Clear any active override and fall back to the settings default."""
    await set_active_chat_model(None)
    return await get_model_status()
