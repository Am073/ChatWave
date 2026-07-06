"""Agent evaluation runner using DeepEval.

Usage:
    uv run python -m app.evals.run_agent_evals
"""
from __future__ import annotations

import json
from pathlib import Path

DATASETS = Path(__file__).parent / "datasets"


def load_jsonl(name: str) -> list[dict]:
    with (DATASETS / name).open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def evaluate_injection(dataset: list[dict]) -> dict:
    """Quick offline check using the in-house injection detector."""
    from app.guardrails.injection import is_injection

    tp = fn = 0
    for row in dataset:
        if row.get("expected_behavior") != "refuse":
            continue
        flagged = is_injection(row["question"])
        if flagged:
            tp += 1
        else:
            fn += 1
    return {"injection_cases": len(dataset), "true_positives": tp, "false_negatives": fn}


def evaluate_tenant_isolation(dataset: list[dict]) -> dict:
    """Sanity test: ensure TenantContext rejects cross-tenant data."""
    from app.api.deps import TenantContext, enforce_tenant_filter
    from app.core.errors import TenantIsolationError

    cases = 0
    blocked = 0
    for row in dataset:
        cases += 1
        a = TenantContext(
            user_id="u",
            role="admin",
            college_name=row["tenant_a"],
            department=None,
            college_id="A",
        )
        try:
            enforce_tenant_filter(a, row["tenant_b"])
        except TenantIsolationError:
            blocked += 1
    return {"isolation_cases": cases, "blocked": blocked}


def run() -> dict:
    injection = load_jsonl("prompt_injection.jsonl")
    isolation = load_jsonl("tenant_isolation.jsonl")
    return {
        "status": "ok",
        "injection": evaluate_injection(injection),
        "tenant_isolation": evaluate_tenant_isolation(isolation),
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))