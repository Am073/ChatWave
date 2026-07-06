"""Unified application errors and FastAPI exception handlers."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from structlog import get_logger

log = get_logger(__name__)


class AppError(Exception):
    """Base application error with HTTP status + message."""

    status_code: int = 400
    message: str = "Bad request"

    def __init__(self, message: str | None = None, status_code: int | None = None):
        self.message = message or self.message
        self.status_code = status_code or self.status_code
        super().__init__(self.message)


class AuthError(AppError):
    status_code = 401
    message = "Authentication required"


class ForbiddenError(AppError):
    status_code = 403
    message = "Forbidden"


class NotFoundError(AppError):
    status_code = 404
    message = "Not found"


class ConflictError(AppError):
    status_code = 409
    message = "Conflict"


class TenantIsolationError(ForbiddenError):
    message = "Tenant isolation violation"


class UnsupportedAnswerError(AppError):
    """Raised when guardrails refuse an unsupported institutional claim."""
    status_code = 422
    message = "Unable to answer with sufficient grounded context"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code, content={"error": exc.message}
        )

    @app.exception_handler(Exception)
    async def _unhandled_handler(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled_error", error=str(exc))
        return JSONResponse(status_code=500, content={"error": "Internal server error"})