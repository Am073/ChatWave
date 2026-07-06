"""Auth service: registration, login, logout, refresh, password change.

Business logic lives here — routes stay thin. Preserves v1 cookie/token strategy
with refresh_token_hash (bcrypt) rotation.
"""
from __future__ import annotations

from fastapi import Request, Response
from structlog import get_logger

from app.api.deps import (
    REFRESH_COOKIE,
    _clear_auth_cookies,
    _set_auth_cookies,
    _set_csrf_cookie,
)
from app.core.errors import AppError, AuthError, ConflictError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_csrf_token,
    hash_password,
    verify_password,
    verify_refresh_token,
)
from app.models.user import User, user_out
from app.schemas.auth import AuthResponse, ChangePasswordIn, LoginIn, RegisterIn

log = get_logger(__name__)


async def register(payload: RegisterIn, response: Response) -> AuthResponse:
    existing = await User.find_one({"college_id": payload.college_id})
    if existing is not None:
        raise ConflictError("User with this College ID already exists")

    hashed = hash_password(payload.password)
    user = User(
        name=payload.name,
        college_id=payload.college_id,
        username=payload.college_id,
        email=f"{payload.college_id.lower()}@chatwave.edu",
        password=hashed,
        role=payload.role,
        college_name=payload.college_name,
        department=payload.department,
        is_active=True,
    )
    access, refresh = _issue_tokens(user)
    user.refresh_token_hash = hash_password(refresh)
    await user.insert()

    _set_auth_cookies(response, access, refresh)
    _set_csrf_cookie(response, generate_csrf_token())
    log.info("user_registered", user_id=str(user.id), college=user.college_name)
    return AuthResponse(message="Registration successful", user=user_out(user))


async def login(payload: LoginIn, response: Response) -> AuthResponse:
    user = await _find_user(payload)
    if user is None:
        raise AuthError("Invalid College ID or password")
    if not user.is_active:
        raise AuthError("Account is inactive")
    if user.role != payload.role:
        raise AuthError("Incorrect role selected for this account")
    if not verify_password(payload.password, user.password):
        raise AuthError("Invalid College ID or password")

    access, refresh = _issue_tokens(user)
    user.refresh_token_hash = hash_password(refresh)
    await user.save()
    _set_auth_cookies(response, access, refresh)
    _set_csrf_cookie(response, generate_csrf_token())
    log.info("user_login", user_id=str(user.id), role=user.role)
    return AuthResponse(message="Login successful", user=user_out(user))


async def logout(user: User, response: Response) -> dict:
    user.refresh_token_hash = None
    await user.save()
    _clear_auth_cookies(response)
    log.info("user_logout", user_id=str(user.id))
    return {"message": "Logout successful"}


async def refresh_access(request: Request, response: Response) -> dict:
    refresh = request.cookies.get(REFRESH_COOKIE)
    if not refresh:
        raise AuthError("Refresh token missing")
    payload = verify_refresh_token(refresh)
    if payload is None or payload.get("type") != "refresh":
        raise AuthError("Invalid or expired refresh token")
    user_id = payload.get("sub") or payload.get("userId")
    user = await User.get(user_id) if user_id else None
    if user is None or not user.is_active or not user.refresh_token_hash:
        raise AuthError("Invalid user session")
    if not verify_password(refresh, user.refresh_token_hash):
        raise AuthError("Invalid refresh token")

    access = create_access_token(
        str(user.id), user.role, user.college_name, user.department, user.college_id
    )
    _set_auth_cookies(response, access, refresh)  # keep refresh; rotate access only
    return {"message": "Token refreshed successfully"}


async def change_password(user: User, payload: ChangePasswordIn) -> dict:
    # Re-fetch fresh document (avoids stale object bug from v1 #1).
    db_user = await User.get(user.id)
    if db_user is None:
        raise AppError("User not found", status_code=404)
    if not verify_password(payload.oldPassword, db_user.password):
        raise AppError("Incorrect current password")
    db_user.password = hash_password(payload.newPassword)
    await db_user.save()
    log.info("password_changed", user_id=str(db_user.id))
    return {"message": "Password changed successfully"}


def _issue_tokens(user: User) -> tuple[str, str]:
    access = create_access_token(
        str(user.id), user.role, user.college_name, user.department, user.college_id
    )
    refresh = create_refresh_token(str(user.id))
    return access, refresh


async def _find_user(payload: LoginIn) -> User | None:
    clauses: list[dict] = []
    if payload.college_id:
        clauses.append({"college_id": payload.college_id})
    if payload.email:
        clauses.append({"email": payload.email.lower()})
    if not clauses:
        return None
    from beanie.operators import Or

    return await User.find_one(Or(*clauses))