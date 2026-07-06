"""FastAPI dependencies: auth, RBAC, tenant context, CSRF.

Pure security boundary code — no business logic. All tenant data queries in
services must use the resolved TenantContext. This is the single enforcement
point for tenant isolation per spec non-negotiable constraint.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request, Response
from fastapi.security import HTTPBearer

from app.core.config import get_settings
from app.core.errors import AuthError, ForbiddenError, TenantIsolationError
from app.core.security import verify_access_token, verify_csrf_token
from app.models.user import User
from app.schemas.auth import CsrfResponse

_settings = get_settings()

# Cookie names (kept compatible with v1 frontend).
ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class TenantContext:
    """Tenant + user context that every service and agent tool receives."""

    user_id: str
    role: str
    college_name: str
    department: str | None
    college_id: str


def _set_auth_cookies(
    response: Response, access_token: str, refresh_token: str
) -> None:
    secure = _settings.is_production
    response.set_cookie(
        ACCESS_COOKIE,
        access_token,
        max_age=_settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=_settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )


def _set_csrf_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        CSRF_COOKIE,
        token,
        max_age=_settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=False,  # JS-readable for double-submit
        secure=_settings.is_production,
        samesite="lax",
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    for name in (ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE):
        response.delete_cookie(name, path="/")


def _cookie_access_token(request: Request) -> str | None:
    return request.cookies.get(ACCESS_COOKIE)


def _bearer_access_token(request: Request, bearer=None) -> str | None:
    token = request.cookies.get(ACCESS_COOKIE)
    if token:
        return token
    if bearer is not None and bearer.credentials:
        return bearer.credentials
    return None


async def get_current_user(
    request: Request,
    bearer: Annotated[object | None, Depends(_bearer)],
) -> User:
    """Resolve the authenticated user from access-token cookie or Bearer header."""
    token = _bearer_access_token(request, bearer)
    if not token:
        raise AuthError("Not authenticated")
    payload = verify_access_token(token)
    if payload is None or payload.get("type") != "access":
        raise AuthError("Invalid or expired access token")
    user_id = payload.get("sub") or payload.get("userId")
    if not user_id:
        raise AuthError("Invalid token payload")
    user = await User.get(user_id)
    if user is None or not user.is_active:
        raise AuthError("User not found or inactive")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: str):
    """Dependency factory enforcing one of the allowed roles."""

    async def _dep(user: CurrentUser) -> User:
        if user.role not in roles:
            raise ForbiddenError("Insufficient role privileges")
        return user

    return _dep


def require_student(user: CurrentUser) -> User:
    return user


def require_faculty_or_admin(user: CurrentUser) -> User:
    if user.role not in ("faculty", "admin"):
        raise ForbiddenError("Faculty or admin role required")
    return user


def require_admin(user: CurrentUser) -> User:
    if user.role != "admin":
        raise ForbiddenError("Admin role required")
    return user


def get_tenant_context(user: CurrentUser) -> TenantContext:
    """Build the TenantContext that services and tools MUST use for filtering."""
    return TenantContext(
        user_id=str(user.id),
        role=user.role,
        college_name=user.college_name,
        department=user.department,
        college_id=user.college_id,
    )


TenantContextDep = Annotated[TenantContext, Depends(get_tenant_context)]


def enforce_tenant_filter(
    ctx: TenantContextDep, college_name: str | None
) -> None:
    """Assert a requested resource belongs to the caller's tenant."""
    if college_name is not None and college_name != ctx.college_name:
        raise TenantIsolationError(
            "Attempted cross-tenant access was blocked"
        )


# ---- CSRF dependency for mutating requests ----

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def verify_csrf(request: Request) -> None:
    if request.method in SAFE_METHODS:
        return
    cookie_token = request.cookies.get(CSRF_COOKIE)
    header_token = request.headers.get("X-CSRF-Token") or request.headers.get(
        "x-csrf-token"
    )
    if not verify_csrf_token(cookie_token or "", header_token or ""):
        raise ForbiddenError("CSRF token invalid or missing")


CSRFDep = Annotated[None, Depends(verify_csrf)]


def issue_csrf(response: Response) -> CsrfResponse:
    """Issue a fresh double-submit CSRF cookie + echoed token in body/header."""
    from app.core.security import generate_csrf_token

    token = generate_csrf_token()
    _set_csrf_cookie(response, token)
    response.headers["X-CSRF-Token"] = token
    return CsrfResponse(csrfToken=token, accessToken="")


def issue_csrf_with_access(response: Response, request: Request) -> CsrfResponse:
    from app.core.security import generate_csrf_token

    token = generate_csrf_token()
    _set_csrf_cookie(response, token)
    response.headers["X-CSRF-Token"] = token
    return CsrfResponse(csrfToken=token, accessToken=request.cookies.get(ACCESS_COOKIE, ""))