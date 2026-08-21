"""Audit log for agent tool calls.

Every tool invocation is recorded to a structured append-only store. In
production we write to MongoDB (the AuditEvent collection) so audit data
is queryable, indexed, and survives restarts. We also keep a JSONL file
mirror as a defense-in-depth fallback.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from app.observability.tracing import get_tracer

_AUDIT_LOG = Path(__file__).resolve().parents[2] / "audit.log"


def _append_to_file(record: dict[str, Any]) -> None:
    """Append a single audit record to the on-disk audit log (JSON lines)."""
    try:
        with _AUDIT_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")
    except Exception:
        # Audit logging must never break the calling code path.
        pass


async def _append_to_mongo(record: dict[str, Any]) -> None:
    """Append a single audit record to the MongoDB AuditEvent collection.

    Best-effort: if MongoDB is unavailable, the on-disk file still has
    the record, and we never raise.
    """
    try:
        from app.models.audit_event import AuditEvent

        doc = AuditEvent(
            ts=_iso_now(),
            kind=record.get("kind", "tool_call"),
            tool=record.get("tool"),
            user_id=record.get("user_id"),
            role=record.get("role"),
            college_name=record.get("college_name"),
            ok=bool(record.get("ok", True)),
            trace_id=record.get("trace_id"),
            inputs=record.get("inputs"),
            outputs_summary=record.get("outputs_summary"),
            error=record.get("error"),
            ip=record.get("ip"),
            path=record.get("path"),
            method=record.get("method"),
        )
        await doc.insert()
    except Exception:
        # The on-disk file is the source of truth for the dev path; do not raise.
        pass


def _iso_now() -> Any:
    from datetime import UTC, datetime

    return datetime.now(UTC)


def audit_tool_call(
    *,
    tool: str,
    user_id: str,
    role: str,
    college_name: str,
    ok: bool,
    inputs: dict[str, Any] | None = None,
    outputs_summary: dict[str, Any] | None = None,
    error: str | None = None,
    trace_id: str | None = None,
) -> None:
    """Record a single tool invocation for compliance + debugging.

    Persists to:
    1. Langfuse (if configured) as a structured event
    2. MongoDB AuditEvent collection (best-effort, async)
    3. Append-only `audit.log` in repo root
    """
    record: dict[str, Any] = {
        "ts": time.time(),
        "kind": "tool_call",
        "tool": tool,
        "user_id": user_id,
        "role": role,
        "college_name": college_name,
        "ok": ok,
        "trace_id": trace_id,
        "inputs": _scrub(inputs) if inputs else None,
        "outputs_summary": outputs_summary,
        "error": error,
    }
    _log_to_langfuse(record)
    _append_to_file(record)
    # Schedule the async Mongo write without blocking the call site.
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(_append_to_mongo(record))
        else:
            loop.run_until_complete(_append_to_mongo(record))
    except RuntimeError:
        # No running loop; just skip the async write.
        pass


def _log_to_langfuse(record: dict[str, Any]) -> None:
    tracer = get_tracer()
    if tracer is None:
        return
    try:
        tracer.log_event(
            record.get("kind", "event"),
            metadata=record,
            level="ERROR" if record.get("ok") is False else "INFO",
        )
    except Exception:
        pass


def _scrub(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    """Remove obviously sensitive fields from inputs before logging."""
    if not payload:
        return payload
    blocked = {"password", "token", "access_token", "refresh_token", "secret"}
    scrubbed = {}
    for k, v in payload.items():
        if k.lower() in blocked:
            scrubbed[k] = "[REDACTED]"
        else:
            scrubbed[k] = v
    return scrubbed
