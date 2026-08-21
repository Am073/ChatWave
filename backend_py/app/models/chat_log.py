"""ChatLog stores one chat turn with full AI metadata + trace id."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from beanie import Document, Indexed
from pydantic import Field


class ChatLog(Document):
    user: Indexed(str)  # User id
    college_name: Indexed(str)  # tenant key
    question: str
    answer: str
    sources: list[dict[str, Any]] = Field(default_factory=list)
    session_id: Indexed(str)
    mode: str = "college"
    model: str | None = None
    prompt_version: str | None = None
    trace_id: str | None = None
    confidence: str | None = None
    quality_scores: dict[str, Any] = Field(default_factory=dict)
    agent_steps: list[dict[str, Any]] = Field(default_factory=list)
    tokens_used: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "chatlogs"
        indexes = ["user", "college_name", "session_id"]
