"""Encrypted Google OAuth tokens for a user."""
from __future__ import annotations

from datetime import datetime

from beanie import Document, Indexed
from pydantic import BaseModel, Field


class UserGoogleToken(Document):
    user: Indexed(str, unique=True)
    access_token: str  # AES-256-CBC encrypted hex:iv:ciphertext
    refresh_token: str | None = None  # encrypted
    expires_at: datetime | None = None

    class Settings:
        name = "usergoogletokens"


class UserGoogleTokenOut(BaseModel):
    id: str = Field(alias="_id")
    user: str
    expires_at: datetime | None = None

    model_config = {"populate_by_name": True}