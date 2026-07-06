"""User Beanie model.

Preserves v1 fields: college_id, name, username, email, password, role,
college_name (tenant key), department, is_active, refresh_token_hash.
"""
from __future__ import annotations

from typing import Literal

from beanie import Document, Indexed
from pydantic import BaseModel, EmailStr, Field


class User(Document):
    college_id: Indexed(str, unique=True)
    name: str
    username: str | None = Field(default=None)
    email: EmailStr | None = Field(default=None)
    password: str
    role: Literal["student", "faculty", "admin"] = "student"
    college_name: Indexed(str)
    department: str | None = None
    is_active: bool = True
    refresh_token_hash: str | None = None

    class Settings:
        name = "users"
        indexes = ["college_id", "college_name", "email"]


class UserOut(BaseModel):
    """Public-facing representation of a user (no secrets)."""
    id: str = Field(alias="_id")
    name: str
    college_id: str
    role: str
    college_name: str
    department: str | None = None

    model_config = {"populate_by_name": True}


def user_out(user: User) -> UserOut:
    return UserOut(
        _id=str(user.id),
        name=user.name,
        college_id=user.college_id,
        role=user.role,
        college_name=user.college_name,
        department=user.department,
    )