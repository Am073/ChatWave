"""Observability: Langfuse tracing + structured logging bridge.

Every AI request gets a trace id; Langfuse captures model calls, embeddings,
retrieval, reranking, tool calls, prompt version, latency, token usage,
and final answer.

Design:
- `get_tracer()` returns a no-op or Langfuse tracer depending on configuration.
- The tracer exposes a minimal API so we can swap in Arize Phoenix or another
  backend later without touching every call site.
"""
from __future__ import annotations

import contextlib
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from app.core.logging import get_logger

log = get_logger(__name__)


class _NoOpTracer:
    """Default no-op tracer used when Langfuse isn't configured."""

    def flush(self) -> None:
        return None

    def log_event(
        self,
        name: str,
        metadata: dict[str, Any] | None = None,
        level: str = "INFO",
    ) -> None:  # noqa: D401
        return None

    def span(self, name: str, **kwargs: Any) -> _NoOpSpan:
        return _NoOpSpan()

    def generation(
        self, name: str, model: str, input_data: Any = None, metadata: dict[str, Any] | None = None
    ) -> _NoOpSpan:
        return _NoOpSpan()

    def score(self, name: str, value: float, comment: str | None = None) -> None:
        return None


class _NoOpSpan:
    def __enter__(self) -> _NoOpSpan:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def update(self, **kwargs: Any) -> None:
        return None

    def end(self, **kwargs: Any) -> None:
        return None


class _LangfuseTracer:
    """Wraps the Langfuse client. Falls back to no-op on config/import errors."""

    def __init__(self) -> None:
        from langfuse import Langfuse

        from app.core.config import get_settings

        s = get_settings()
        self._client = Langfuse(
            public_key=s.langfuse_public_key or "pk-dummy",
            secret_key=s.langfuse_secret_key or "sk-dummy",
            host=str(s.langfuse_host) if s.langfuse_host else "https://cloud.langfuse.com",
        )

    def flush(self) -> None:
        """Flush buffered events to Langfuse. Call on shutdown."""
        with contextlib.suppress(Exception):
            self._client.flush()

    def log_event(
        self, name: str, metadata: dict[str, Any] | None = None, level: str = "INFO"
    ) -> None:
        try:
            self._client.create_event(name=name, metadata=metadata or {})
        except Exception:  # noqa: BLE001
            log.warning("langfuse_event_failed", event=name)

    @contextmanager
    def span(self, name: str, **kwargs: Any) -> Iterator[Any]:
        try:
            with self._client.start_as_current_observation(
                name=name, as_type="span", **kwargs
            ) as span:
                yield span
        except Exception:  # noqa: BLE001
            log.warning("langfuse_span_failed", span=name)
            yield _NoOpSpan()

    def generation(
        self,
        name: str,
        model: str,
        input_data: Any = None,
        metadata: dict[str, Any] | None = None,
    ) -> Any:
        try:
            return self._client.start_as_current_observation(
                name=name,
                as_type="generation",
                model=model,
                input=input_data,
                metadata=metadata,
            )
        except Exception:  # noqa: BLE001
            log.warning("langfuse_generation_failed", generation=name)
            return _NoOpSpan()

    def score(self, name: str, value: float, comment: str | None = None) -> None:
        try:
            self._client.create_score(name=name, value=value, comment=comment or "")
        except Exception:  # noqa: BLE001
            log.warning("langfuse_score_failed", score=name)


_cached_tracer: _NoOpTracer | _LangfuseTracer | None = None


def get_tracer() -> _NoOpTracer | _LangfuseTracer:
    global _cached_tracer
    if _cached_tracer is not None:
        return _cached_tracer
    from app.core.config import get_settings

    s = get_settings()
    if s.langfuse_public_key and s.langfuse_secret_key:
        try:
            _cached_tracer = _LangfuseTracer()
            return _cached_tracer
        except Exception:
            pass
    _cached_tracer = _NoOpTracer()
    return _cached_tracer


def new_trace_id() -> str:
    return uuid.uuid4().hex


@contextmanager
def timed(name: str) -> Iterator[dict[str, Any]]:
    """Simple latency timer usable as a context manager."""
    state: dict[str, Any] = {"name": name, "latency_ms": 0.0, "error": None}
    start = time.perf_counter()
    try:
        yield state
    except Exception as exc:  # noqa: BLE001
        state["error"] = str(exc)
        raise
    finally:
        state["latency_ms"] = (time.perf_counter() - start) * 1000