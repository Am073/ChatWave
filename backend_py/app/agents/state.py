"""LangGraph agent state: typed, bounded, traceable.

Decision #7: LangGraph state machine.
Initial graph nodes: intent_classifier, context_retriever, sufficiency_check,
answer_generator, citation_validator.
Tools: search_documents, get_announcements (read-only).
Loop limit: enforced via MAX_ITERATIONS in graph config.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Role = Literal["student", "faculty", "admin"]
Intent = Literal["policy_lookup", "announcement_lookup", "general", "refuse"]


class AgentState(BaseModel):
    """Typed state passed through the LangGraph nodes."""

    user_id: str
    role: Role
    college_name: str
    department: str | None
    question: str
    session_id: str
    prompt_version: str
    trace_id: str
    iteration: int = 0
    intent: Intent | None = None
    sources: list[dict[str, Any]] = Field(default_factory=list)
    agent_steps: list[dict[str, Any]] = Field(default_factory=list)
    confidence: str = "low"
    answer: str = ""
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    mode: str = "college"  # "college" = RAG retrieval, "general" = direct LLM
    refused: bool = False
    clarification: bool = False
    finished: bool = False
    # Optional per-run model override (e.g. admin wants to test Claude vs Gemini).
    model_override: str | None = None