"""Auth routes: register, login, logout, refresh, change-password, csrf-token, me.

Preserves v1 paths/cookies for frontend compatibility.
"""
from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.api.deps import (
    CSRFDep,
    CurrentUser,
    issue_csrf_with_access,
)
from app.models.user import user_out
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordIn,
    LoginIn,
    MessageResponse,
    RegisterIn,
)
from app.services import auth_service

router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(payload: RegisterIn, response: Response) -> AuthResponse:
    return await auth_service.register(payload, response)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginIn, response: Response) -> AuthResponse:
    return await auth_service.login(payload, response)


@router.post("/logout", response_model=MessageResponse)
async def logout(user: CurrentUser, _: CSRFDep, response: Response) -> dict:
    return await auth_service.logout(user, response)


@router.post("/refresh", response_model=MessageResponse)
async def refresh(request: Request, response: Response) -> dict:
    return await auth_service.refresh_access(request, response)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    user: CurrentUser, _: CSRFDep, payload: ChangePasswordIn
) -> dict:
    return await auth_service.change_password(user, payload)


@router.get("/csrf-token")
async def csrf_token(response: Response, request: Request):
    return issue_csrf_with_access(response, request)


@router.get("/me")
async def me(user: CurrentUser) -> dict:
    return user_out(user).model_dump(by_alias=True)