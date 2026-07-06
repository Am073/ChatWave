"""Chat request/response schemas."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ChatIn(BaseModel):
    question: str = Field(min_length=1)
    sessionId: str | None = None
    mode: str = "college"


class SourceOut(BaseModel):
    documentId: str
    chunkIndex: int = 0
    title: str | None = None
    page: int | None = None
    score: float = 0.0
    text: str = ""


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceOut] = Field(default_factory=list)
    sessionId: str
    traceId: str | None = None
    model: str | None = None
    confidence: str = "high"