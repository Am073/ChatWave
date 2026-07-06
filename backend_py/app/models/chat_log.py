"""ChatLog stores one chat turn with full AI metadata + trace id."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from beanie import Document, Indexed
from pydantic import BaseModel, Field


class SourceRef(BaseModel):
    documentId: str
    chunkIndex: int = 0
    title: str | None = None
    page: int | None = None
    score: float = 0.0
    text: str = ""


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


class ChatLogOut(BaseModel):
    id: str = Field(alias="_id")
    question: str
    answer: str
    sources: list[dict[str, Any]]
    session_id: str
    model: str | None = None
    confidence: str | None = None
    trace_id: str | None = None
    created_at: datetime

    model_config = {"populate_by_name": True}


def chat_log_out(log: ChatLog) -> ChatLogOut:
    return ChatLogOut(
        _id=str(log.id),
        question=log.question,
        answer=log.answer,
        sources=log.sources,
        session_id=log.session_id,
        model=log.model,
        confidence=log.confidence,
        trace_id=log.trace_id,
        created_at=log.created_at,
    )