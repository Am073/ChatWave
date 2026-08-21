"""Global CSRF guard middleware.

Defense-in-depth: every mutating request under /api/* must carry a valid
double-submit CSRF token. Routes that already declare the per-route
`CSRFDep` will be checked twice, but the second check is a constant-time
HMAC compare and the cost is negligible.

Allow-list: endpoints that *issue* tokens or are otherwise exempt from
the double-submit pattern.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.security import verify_csrf_token

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

# Paths that are exempt from the global CSRF check.
# Anything auth-related that issues or refreshes tokens must be here,
# because the user has no CSRF cookie before they have a session.
_EXEMPT_PATHS: frozenset[str] = frozenset(
    {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
        "/api/auth/csrf-token",
    }
)

CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "X-CSRF-Token"


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.method in SAFE_METHODS or request.url.path in _EXEMPT_PATHS:
            return await call_next(request)

        cookie_token = request.cookies.get(CSRF_COOKIE, "")
        header_token = request.headers.get(CSRF_HEADER) or request.headers.get(
            CSRF_HEADER.lower()
        )
        if not verify_csrf_token(cookie_token, header_token or ""):
            return JSONResponse(
                status_code=403,
                content={"error": "CSRF token invalid or missing"},
            )
        return await call_next(request)
