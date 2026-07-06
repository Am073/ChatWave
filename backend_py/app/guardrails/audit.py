"""Audit log for agent tool calls.

Spec Phase 10 (guardrails): "Add audit logs for tool calls."
Every tool invocation is recorded to a structured append-only store (the
Langfuse tracer in production, plus a dedicated audit log file in dev).

We keep the API minimal so individual tools don't need to know about
Langfuse or storage: they call `audit_tool_call` and the call site records
the trace.
"""
from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any

from app.observability.tracing import get_tracer

_AUDIT_LOG = Path(__file__).resolve().parents[2] / "audit.log"
_LOCK = threading.Lock()


def _append_to_file(record: dict[str, Any]) -> None:
    """Append a single audit record to the on-disk audit log (JSON lines)."""
    try:
        with _LOCK, _AUDIT_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")
    except Exception:
        # Audit logging must never break the calling code path.
        pass


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
    2. Append-only `audit.log` in repo root
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
    tracer = get_tracer()
    if tracer is not None:
        import contextlib

        with contextlib.suppress(Exception):
            tracer.log_event(
                "tool_call",
                metadata=record,
                level="ERROR" if not ok else "INFO",
            )
    _append_to_file(record)


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


def read_audit_log(limit: int = 100) -> list[dict]:
    """Read the most recent audit records (admin use)."""
    if not _AUDIT_LOG.exists():
        return []
    try:
        with _AUDIT_LOG.open("r", encoding="utf-8") as f:
            lines = f.readlines()[-limit:]
        return [json.loads(line) for line in lines if line.strip()]
    except Exception:
        return []


def clear_audit_log() -> None:
    if _AUDIT_LOG.exists():
        import contextlib

        with contextlib.suppress(Exception):
            os.remove(_AUDIT_LOG)