"""Main FastAPI application factory."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import get_settings
from app.core.csrf_middleware import CSRFMiddleware
from app.core.db import close_mongodb, close_qdrant, close_redis, connect_mongodb
from app.core.env_validation import StartupValidationError, validate_required_env
from app.core.errors import register_exception_handlers
from app.core.logging import setup_logging
from app.core.rate_limiter import RateLimitMiddleware
from app.core.request_logging import RequestLoggingMiddleware
from app.models.announcement import Announcement
from app.models.audit_event import AuditEvent
from app.models.calendar_event import CalendarEvent
from app.models.chat_log import ChatLog
from app.models.document import DocumentRecord
from app.models.google_token import UserGoogleToken
from app.models.user import User
from app.observability.metrics import PrometheusMiddleware

_settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(debug=not _settings.is_production)
    # Validate env-var configuration. Fail fast on misconfig.
    try:
        validate_required_env(_settings)
    except StartupValidationError as exc:
        # In dev we log a warning so the server can still start with stub creds;
        # in production we abort startup.
        from app.core.logging import get_logger
        log = get_logger(__name__)
        if _settings.is_production:
            raise
        log.warning("env_validation_skipped_dev", reason=str(exc))

    await connect_mongodb(
        document_models=[
            User,
            DocumentRecord,
            Announcement,
            ChatLog,
            CalendarEvent,
            UserGoogleToken,
            AuditEvent,
        ]
    )
    yield
    # Flush Langfuse buffered events before tearing down connections.
    from app.observability.tracing import get_tracer
    tracer = get_tracer()
    tracer.flush()
    await close_mongodb()
    await close_qdrant()
    await close_redis()


class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """Force HTTPS in production behind any reverse proxy.

    Trusts the X-Forwarded-Proto header that most managed reverse proxies set.
    """

    def __init__(self, app, enabled: bool) -> None:
        super().__init__(app)
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        if proto == "https":
            return await call_next(request)
        url = request.url.replace(scheme="https")
        return RedirectResponse(url=str(url), status_code=301)


def create_app() -> FastAPI:
    app = FastAPI(
        title=_settings.app_name,
        version=_settings.version,
        docs_url="/docs" if not _settings.is_production else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    # Security headers (CSP, HSTS, X-Frame-Options, etc.) on every response.
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        if _settings.is_production:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
        )
        return response

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-CSRF-Token"],
    )
    # Trust hosts explicitly listed; in production the reverse proxy's hostname is added.
    if _settings.additional_cors_origins:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["*"] if not _settings.is_production else _settings.cors_origins,
        )
    if _settings.is_production:
        app.add_middleware(HTTPSRedirectMiddleware, enabled=True)

    # Rate limiting (Redis-backed sliding window). Applied last so it runs
    # first on the request side and observes final response headers.
    app.add_middleware(RateLimitMiddleware, enabled=_settings.rate_limit_enabled)

    # CSRF guard: defense-in-depth alongside the per-route CSRFDep marker.
    app.add_middleware(CSRFMiddleware)

    # Request/response structured logging.
    app.add_middleware(RequestLoggingMiddleware)

    # Prometheus request metrics. Applied before rate limit so even rejected
    # requests are counted in /metrics.
    app.add_middleware(PrometheusMiddleware)

    register_exception_handlers(app)

    # Register routers (imported lazily to avoid circular imports).
    from app.api.routes import (
        admin,
        announcements,
        auth,
        calendar,
        chat,
        health,
        upload,
    )

    prefix = _settings.api_prefix
    app.include_router(health.router, prefix=prefix, tags=["health"])
    app.include_router(auth.router, prefix=f"{prefix}/auth", tags=["auth"])
    app.include_router(chat.router, prefix=f"{prefix}/chat", tags=["chat"])
    app.include_router(upload.router, prefix=f"{prefix}/upload", tags=["upload"])
    app.include_router(
        announcements.router, prefix=f"{prefix}/announcements", tags=["announcements"]
    )
    app.include_router(admin.router, prefix=f"{prefix}/admin", tags=["admin"])
    app.include_router(calendar.router, prefix=f"{prefix}/calendar", tags=["calendar"])

    @app.get("/")
    async def root() -> dict:
        return {"name": _settings.app_name, "version": _settings.version}

    return app


app = create_app()