"""Admin request/response schemas."""
from __future__ import annotations

from datetime import datetime
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


class AdminUserOut(BaseModel):
    id: str
    name: str
    college_id: str
    college_name: str
    role: str
    department: str | None
    is_active: bool
    email: str | None = None
    created_at: datetime | None = None


class ActivityOut(BaseModel):
    type: str
    at: datetime
    payload: dict