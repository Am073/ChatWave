"""Auth request/response schemas."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.models.user import UserOut


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    college_id: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    college_name: str = Field(min_length=1, max_length=200)
    department: str | None = Field(default=None, max_length=120)
    role: Literal["student", "faculty", "admin"] = "student"


class LoginIn(BaseModel):
    college_id: str | None = None
    email: str | None = None
    password: str
    role: Literal["student", "faculty", "admin"]


class ChangePasswordIn(BaseModel):
    oldPassword: str
    newPassword: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    message: str
    user: UserOut


class CsrfResponse(BaseModel):
    csrfToken: str
    accessToken: str = ""


class MessageResponse(BaseModel):
    message: str