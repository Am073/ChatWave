"""Audit log + tool-call RBAC tests."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.guardrails import audit


@pytest.fixture
def clean_audit_log():
    """Ensure a clean audit log per test."""
    audit.clear_audit_log()
    yield
    audit.clear_audit_log()


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
    records = audit.read_audit_log(limit=10)
    assert len(records) == 1
    r = records[0]
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
    records = audit.read_audit_log()
    assert records[0]["inputs"]["password"] == "[REDACTED]"
    assert records[0]["inputs"]["username"] == "alice"


def test_audit_records_failures(clean_audit_log):
    audit.audit_tool_call(
        tool="search_documents",
        user_id="u2",
        role="faculty",
        college_name="A",
        ok=False,
        error="timeout",
    )
    records = audit.read_audit_log()
    assert records[0]["ok"] is False
    assert records[0]["error"] == "timeout"


def test_audit_log_persists_to_disk(clean_audit_log, tmp_path):
    # Write a record and confirm the JSONL file exists with the right content.
    audit.audit_tool_call(
        tool="get_announcements",
        user_id="u3",
        role="admin",
        college_name="A",
        ok=True,
    )
    # The audit log lives at backend_py/audit.log
    log_path = Path(audit._AUDIT_LOG)
    assert log_path.exists()
    content = log_path.read_text(encoding="utf-8")
    assert "get_announcements" in content
    last_line = content.strip().splitlines()[-1]
    record = json.loads(last_line)
    assert record["tool"] == "get_announcements"