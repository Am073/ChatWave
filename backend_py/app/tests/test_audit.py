"""Audit log tests for tool calls."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.guardrails import audit


@pytest.fixture
def clean_audit_log():
    """Ensure a clean audit log per test."""
    if audit._AUDIT_LOG.exists():
        audit._AUDIT_LOG.unlink()
    yield
    if audit._AUDIT_LOG.exists():
        audit._AUDIT_LOG.unlink()


def _last_record() -> dict:
    content = audit._AUDIT_LOG.read_text(encoding="utf-8")
    return json.loads(content.strip().splitlines()[-1])


def test_audit_tool_call_writes_record(clean_audit_log):
    audit.audit_tool_call(
        tool="search_documents",
        user_id="u1",
        role="student",
        college_name="ChatWave College",
        ok=True,
        inputs={"query": "What is the policy?", "top_k": 5},
        outputs_summary={"count": 3},
        trace_id="trace-xyz",
    )
    r = _last_record()
    assert r["tool"] == "search_documents"
    assert r["user_id"] == "u1"
    assert r["ok"] is True
    assert r["inputs"]["query"] == "What is the policy?"


def test_audit_scrubs_sensitive_inputs(clean_audit_log):
    audit.audit_tool_call(
        tool="login",
        user_id="u1",
        role="student",
        college_name="A",
        ok=True,
        inputs={"username": "alice", "password": "secret123"},
    )
    r = _last_record()
    assert r["inputs"]["password"] == "[REDACTED]"
    assert r["inputs"]["username"] == "alice"


def test_audit_records_failures(clean_audit_log):
    audit.audit_tool_call(
        tool="search_documents",
        user_id="u2",
        role="faculty",
        college_name="A",
        ok=False,
        error="timeout",
    )
    r = _last_record()
    assert r["ok"] is False
    assert r["error"] == "timeout"


def test_audit_log_persists_to_disk(clean_audit_log):
    audit.audit_tool_call(
        tool="get_announcements",
        user_id="u3",
        role="admin",
        college_name="A",
        ok=True,
    )
    log_path = Path(audit._AUDIT_LOG)
    assert log_path.exists()
    content = log_path.read_text(encoding="utf-8")
    assert "get_announcements" in content
    last_line = content.strip().splitlines()[-1]
    record = json.loads(last_line)
    assert record["tool"] == "get_announcements"
