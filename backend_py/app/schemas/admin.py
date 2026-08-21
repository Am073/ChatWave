"""Admin request schemas."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class AdminUserCreateIn(BaseModel):
    name: str
    college_id: str
    password: str = Field(min_length=6)
    college_name: str
    department: str | None = None
    role: Literal["student", "faculty", "admin"] = "student"
    email: EmailStr | None = None


class AdminUserUpdateIn(BaseModel):
    role: Literal["student", "faculty", "admin"] | None = None
    is_active: bool | None = None
    department: str | None = None
    name: str | None = None
