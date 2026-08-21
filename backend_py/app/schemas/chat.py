"""Chat request schema."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    sessionId: str | None = None
    mode: str = "college"
    model: str | None = None
