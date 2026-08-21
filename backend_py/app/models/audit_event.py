"""Audit log model — persistent record of agent tool calls and security events."""
from __future__ import annotations

from datetime import UTC, datetime

from beanie import Document, Indexed
from pydantic import BaseModel, Field


class AuditEvent(Document):
    """One audit record, indexed by tenant + ts for fast time-range queries.

    NOTE: Beanie's ``Indexed`` wrapper does not support ``str | None`` annotations
    directly (it fails at class construction with ``TypeError: Cannot subclass
    str | None``). We declare the index on the string type and keep the field
    itself optional via ``= None`` + ``default``.
    """

    ts: datetime = Field(default_factory=lambda: datetime.now(UTC))
    kind: Indexed(str)  # e.g. "tool_call", "auth", "rate_limit"
    tool: str | None = None
    # Indexed on str; field is optional (default empty string for index safety).
    user_id: str | None = Indexed(str, default_factory=lambda: "")
    role: str | None = None
    college_name: str | None = Indexed(str, default_factory=lambda: "")
    ok: bool = True
    trace_id: str | None = None
    inputs: dict | None = None
    outputs_summary: dict | None = None
    error: str | None = None
    ip: str | None = None
    path: str | None = None
    method: str | None = None

    class Settings:
        name = "audit_events"
        indexes = [
            "ts",
            ("college_name", "ts"),
            ("user_id", "ts"),
            ("kind", "ts"),
        ]


class AuditEventOut(BaseModel):
    id: str = Field(alias="_id")
    ts: datetime
    kind: str
    tool: str | None = None
    user_id: str | None = None
    role: str | None = None
    college_name: str | None = None
    ok: bool = True
    trace_id: str | None = None
    error: str | None = None
    ip: str | None = None
    path: str | None = None
    method: str | None = None

    model_config = {"populate_by_name": True}
