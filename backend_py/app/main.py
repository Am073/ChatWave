"""Main FastAPI application factory."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import get_settings
from app.core.db import close_mongodb, close_qdrant, close_redis, connect_mongodb
from app.core.errors import register_exception_handlers
from app.core.logging import setup_logging
from app.models.announcement import Announcement
from app.models.calendar_event import CalendarEvent
from app.models.chat_log import ChatLog
from app.models.document import DocumentRecord
from app.models.google_token import UserGoogleToken
from app.models.user import User

_settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(debug=not _settings.is_production)
    await connect_mongodb(
        document_models=[
            User,
            DocumentRecord,
            Announcement,
            ChatLog,
            CalendarEvent,
            UserGoogleToken,
        ]
    )
    yield
    await close_mongodb()
    await close_qdrant()
    await close_redis()


def create_app() -> FastAPI:
    app = FastAPI(
        title=_settings.app_name,
        version=_settings.version,
        docs_url="/docs",
        redoc_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-CSRF-Token"],
    )

    register_exception_handlers(app)

    # Register routers (imported lazily to avoid circular imports).
    from app.api.routes import admin, announcements, auth, calendar, chat, health, upload

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