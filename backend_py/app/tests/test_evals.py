"""Smoke tests for the eval runners (no live DB / live model required)."""
from __future__ import annotations

import json
from pathlib import Path

from app.evals.run_agent_evals import run as run_agent
from app.evals.run_rag_evals import THRESHOLDS
from app.evals.run_rag_evals import run as run_rag


def test_agent_eval_runner_smoke():
    report = run_agent()
    assert report["status"] == "ok"
    assert report["tenant_isolation"]["blocked"] >= 1
    assert report["injection"]["true_positives"] >= 1


def test_rag_eval_offline_report():
    report = run_rag()
    assert report["status"] == "ok"
    assert report["mode"] == "offline"
    assert report["count"] >= 1
    assert report["thresholds"] == THRESHOLDS


def test_datasets_are_valid_jsonl():
    base = Path(__file__).resolve().parent.parent / "evals" / "datasets"
    for name in (
        "golden_qa.jsonl",
        "expected_sources.jsonl",
        "prompt_injection.jsonl",
        "tenant_isolation.jsonl",
        "refusal.jsonl",
        "tool_calls.jsonl",
    ):
        path = base / name
        assert path.exists(), f"missing dataset: {name}"
        rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
        assert rows, f"empty dataset: {name}"