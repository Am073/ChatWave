"""Redis-backed sliding-window rate limiter + FastAPI middleware.

Algorithm: classic sliding-window counter approximation using a sorted set.
For each request:
  1. Trim all entries older than the window.
  2. Add a unique member with the current timestamp as the score.
  3. Count the remaining entries; if above the limit, reject.
  4. Set an expiry on the key so unused slots fall off.

All four operations run inside a single Lua script so the window
trim, the add, the count, and the expire are atomic on the server
side — two concurrent requests from the same key can no longer
sneak past the limit.

A graceful fallback (allow the request) is used if Redis is unavailable — this
prevents a Redis outage from cascading into a full API outage.
"""
from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.db import get_redis
from app.core.logging import get_logger

log = get_logger(__name__)

# Route buckets: prefix -> per-minute limit
_ROUTE_LIMITS: dict[str, int] = {}


def _get_limit_for_path(path: str, settings: Any) -> int:
    """Return the per-minute limit for the given path."""
    if not _ROUTE_LIMITS:
        _ROUTE_LIMITS.update(
            {
                "/api/auth": settings.rate_limit_auth_per_minute,
                "/api/chat": settings.rate_limit_chat_per_minute,
                "/api/upload": settings.rate_limit_upload_per_minute,
            }
        )
    for prefix, limit in _ROUTE_LIMITS.items():
        if path.startswith(prefix):
            return limit
    return settings.rate_limit_default_per_minute


def _client_key(request: Request) -> tuple[str, str]:
    """Return (identifier, tenant_prefix) for the requester.

    Authed users: token sub + college_name. Anonymous: IP under "public" tenant.
    """
    token = request.cookies.get("access_token")
    if token:
        from app.core.security import verify_access_token

        payload = verify_access_token(token)
        if payload:
            sub = payload.get("sub") or payload.get("userId")
            if sub:
                tenant = payload.get("college_name") or "public"
                return f"u:{sub}", tenant
    xff = request.headers.get("x-forwarded-for")
    ip = (
        xff.split(",")[0].strip()
        if xff
        else request.client.host if request.client else "unknown"
    )
    return f"ip:{ip}", "public"


async def consume(
    tenant: str, key: str, route: str, limit: int, window_seconds: int = 60
) -> tuple[bool, int, int]:
    """Atomically register a hit; return (allowed, remaining, reset_in_seconds)."""
    now = time.time()
    window_start = now - window_seconds
    redis = get_redis()
    zset_key = f"rl:{tenant}:{route}:{key}"
    member = f"{now}-{uuid.uuid4().hex[:8]}"
    # Single Lua call: trim, add, count, expire — all atomic on the server.
    count = int(
        await redis.eval(
            _SLIDING_WINDOW_LUA,
            1,
            zset_key,
            window_start,
            now,
            member,
            window_seconds + 5,
        )
    )
    remaining = max(0, limit - count)
    allowed = count <= limit
    return allowed, remaining, window_seconds


# KEYS[1] = zset key
# ARGV[1] = window_start (cutoff timestamp)
# ARGV[2] = now
# ARGV[3] = unique member to add
# ARGV[4] = expire seconds
# Returns the cardinality AFTER the add, atomically.
_SLIDING_WINDOW_LUA = """
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return redis.call('ZCARD', KEYS[1])
"""


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window per-IP+route rate limiter, Redis-backed."""

    def __init__(self, app, enabled: bool) -> None:
        super().__init__(app)
        self.enabled = enabled

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if not self.enabled:
            return await call_next(request)

        # Skip rate limiting for health, docs, metrics, and websocket upgrade
        path = request.url.path
        if (
            path.endswith("/health")
            or path.endswith("/health/live")
            or path.endswith("/metrics")  # matches both /metrics and /api/metrics
            or path.startswith("/docs")
        ):
            return await call_next(request)

        settings = get_settings()
        limit = _get_limit_for_path(path, settings)
        if limit <= 0:
            return await call_next(request)

        identifier, tenant = _client_key(request)
        route = path.split("/")[1:4]  # first 3 path segments as bucket
        bucket = "/".join(route) or "root"

        try:
            allowed, remaining, reset_in = await consume(tenant, identifier, bucket, limit)
        except Exception as exc:  # noqa: BLE001
            # Fail-open: if Redis is down, don't 5xx the whole API.
            log.warning("rate_limit_check_failed", error=str(exc))
            return await call_next(request)

        if not allowed:
            response = JSONResponse(
                status_code=429,
                content={"error": "Too many requests. Please slow down."},
            )
            response.headers["Retry-After"] = str(reset_in)
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = "0"
            return response

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
