"""Request/response logging middleware.

Logs every request with method, path, status, duration, and (when present)
the authed user id. The output is structured via structlog so it can be
ingested by log aggregators.
"""
from __future__ import annotations

import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import get_logger
from app.core.security import verify_access_token

log = get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Emit one log line per request with status, latency, and user context."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        user_id = _user_id_from_request(request)
        # Skip noisy paths in the log output to keep it focused.
        if request.url.path in ("/api/health/live", "/metrics"):
            return response
        log.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round(elapsed_ms, 2),
            user_id=user_id,
            client=request.client.host if request.client else None,
        )
        return response


def _user_id_from_request(request: Request) -> str | None:
    token = request.cookies.get("access_token")
    if not token:
        return None
    payload = verify_access_token(token)
    if not payload:
        return None
    return payload.get("sub") or payload.get("userId")
