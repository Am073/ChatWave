"""Runtime model registry: allows admins to switch the active chat model.

State is held in process memory (single backend instance). For multi-worker
deployments, back this with Redis.

The override is consulted by `chat_service.resolve_model()` on every request,
so admins can roll out a new model without a deploy.
"""
from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

_active_chat_model: str | None = None


def get_active_chat_model() -> str | None:
    """Return the currently active chat model, or None if no override is set."""
    return _active_chat_model


def set_active_chat_model(model: str | None) -> None:
    """Set (or clear) the active chat model override."""
    global _active_chat_model
    _active_chat_model = None if model is None or not model.strip() else model.strip()
    log.info("active_chat_model_changed", model=_active_chat_model)


def get_model_status() -> dict:
    """Return the current default + override + supported model catalog."""
    settings = get_settings()
    return {
        "default_model": settings.chat_model,
        "active_model": _active_chat_model or settings.chat_model,
        "available_models": settings.available_chat_models,
        "available_providers": settings.available_providers,
        "allow_runtime_switch": settings.enable_runtime_model_switch,
    }


def set_model_override(model: str) -> dict:
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
    set_active_chat_model(model)
    return get_model_status()


def clear_model_override() -> dict:
    """Clear any active override and fall back to the settings default."""
    set_active_chat_model(None)
    return get_model_status()
