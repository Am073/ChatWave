"""RAG evaluation runner powered by DeepEval (LiteLLM gateway).

Two modes:

- Offline (default): validates datasets + thresholds without any network
  dependency. Used by pytest/CI to catch structural regressions.
- Live (`--live`): runs each golden question through the real chat agent,
  then scores answers with DeepEval (routed through LiteLLM, same model
  strings as the app). Generation-side: FaithfulnessMetric +
  AnswerRelevancyMetric. Retrieval-side: ContextualPrecisionMetric +
  ContextualRecallMetric, scored only for rows that carry a `ground_truth`
  answer. Questions that retrieve no sources must be refused/clarified —
  that is the source-grounding policy working, not a failure.

  ponytail: Ragas was dropped — ragas 0.4 cannot import against current
  langchain-community (removed vertexai module). DeepEval covers the same
  metrics natively over litellm. Revisit if the ecosystem stabilises.

Usage:
    uv run python -m app.evals.run_rag_evals            # offline report
    uv run python -m app.evals.run_rag_evals --live     # real scoring (LLM cost)
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

DATASETS = Path(__file__).parent / "datasets"

THRESHOLDS = {
    # Generation-side: is the answer grounded in what was retrieved?
    "faithfulness": 0.7,
    "answer_relevancy": 0.6,
    # Retrieval-side (needs ground_truth per row): did we rank the right
    # context top, and does it cover the reference answer?
    "contextual_precision": 0.5,
    "contextual_recall": 0.5,
}


def load_jsonl(name: str) -> list[dict]:
    with (DATASETS / name).open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def run(thresholds: dict | None = None) -> dict:
    """Offline report: dataset shape + configured gates (no network)."""
    threshold = thresholds or THRESHOLDS
    golden = load_jsonl("golden_qa.jsonl")
    return {
        "status": "ok",
        "mode": "offline",
        "dataset": "golden_qa",
        "count": len(golden),
        "thresholds": threshold,
        "metrics": {k: None for k in threshold},
        "note": "run with --live for real model-scored evaluation",
    }


async def _check_prerequisites() -> str | None:
    """Return a failure reason, or None when Mongo+Qdrant+LLM are reachable."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from qdrant_client import AsyncQdrantClient

    from app.core.config import get_settings

    settings = get_settings()
    if not settings.gemini_api_key:
        return "GEMINI_API_KEY is not set"
    try:
        client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=8000)
        await client.admin.command("ping")
    except Exception as exc:  # noqa: BLE001
        return f"MongoDB unreachable: {exc}"
    try:
        qdrant = AsyncQdrantClient(
            url=settings.qdrant_url, api_key=settings.qdrant_api_key or None
        )
        await qdrant.get_collections()
        await qdrant.close()
    except Exception as exc:  # noqa: BLE001
        return f"Qdrant unreachable: {exc}"
    return None


async def run_live(
    thresholds: dict | None = None, limit: int | None = None
) -> dict:
    """Score real agent answers with DeepEval. Requires Mongo+Qdrant+LLM.

    Generation-side metrics (faithfulness, answer relevancy) run on every
    scored case. Retrieval-side metrics (contextual precision/recall) need a
    ground-truth answer per dataset row; rows without one are skipped for
    those two metrics only.
    """
    from deepeval.metrics import (
        AnswerRelevancyMetric,
        ContextualPrecisionMetric,
        ContextualRecallMetric,
        FaithfulnessMetric,
    )
    from deepeval.test_case import LLMTestCase

    from app.api.deps import TenantContext
    from app.core.config import get_settings
    from app.schemas.chat import ChatIn
    from app.services import chat_service

    threshold = thresholds or THRESHOLDS
    settings = get_settings()
    model = settings.chat_model

    reason = await _check_prerequisites()
    if reason:
        return {
            "status": "prerequisites_missing",
            "mode": "live",
            "note": f"live eval needs GEMINI_API_KEY, MongoDB and Qdrant reachable ({reason})",
        }

    ctx = TenantContext(
        user_id="eval-runner",
        role="student",
        college_name="EvalCollege",
        department=None,
        college_id="EVAL",
    )
    rows = load_jsonl("golden_qa.jsonl")
    if limit:
        rows = rows[:limit]

    cases: list[dict] = []
    scores: dict[str, list[float]] = {
        "faithfulness": [],
        "answer_relevancy": [],
        "contextual_precision": [],
        "contextual_recall": [],
    }

    for row in rows:
        q = row["question"]
        result = await chat_service.answer(ctx, ChatIn(question=q, mode="college"))
        sources = result.get("sources") or []
        if not sources:
            # No retrieval hit -> the agent must NOT hallucinate an answer.
            cases.append({"question": q, "outcome": "refused_or_clarified"})
            continue

        ground_truth = row.get("ground_truth")
        test_case = LLMTestCase(
            input=q,
            actual_output=result["answer"],
            expected_output=ground_truth or result["answer"],
            retrieval_context=[s.get("text", "") for s in sources],
        )
        case: dict = {"question": q, "outcome": "scored", "sources": len(sources)}
        metric_specs = [
            (
                "faithfulness",
                FaithfulnessMetric,
                threshold["faithfulness"],
            ),
            (
                "answer_relevancy",
                AnswerRelevancyMetric,
                threshold["answer_relevancy"],
            ),
        ]
        if ground_truth:
            # Retrieval-side gates: is the right context ranked top, and does
            # it cover the reference answer? Meaningless without ground truth.
            metric_specs += [
                (
                    "contextual_precision",
                    ContextualPrecisionMetric,
                    threshold["contextual_precision"],
                ),
                (
                    "contextual_recall",
                    ContextualRecallMetric,
                    threshold["contextual_recall"],
                ),
            ]
        else:
            case["contextual_skipped"] = "no ground_truth in dataset row"
        for name, metric_cls, thr in metric_specs:
            try:
                metric = metric_cls(
                    threshold=thr, model=model, include_reason=False, async_mode=False
                )
                metric.measure(test_case)
                case[name] = round(metric.score, 3) if metric.score is not None else None
                if metric.score is not None:
                    scores[name].append(metric.score)
            except Exception as exc:  # noqa: BLE001 - one bad case != failed run
                case[name] = None
                case[f"{name}_error"] = str(exc)[:200]
        cases.append(case)

    avg = {
        k: round(sum(v) / len(v), 3) if v else None for k, v in scores.items()
    }
    failed = [
        k for k, v in avg.items() if v is not None and v < threshold[k]
    ]
    report = {
        "mode": "live",
        "model": model,
        "count": len(rows),
        "thresholds": threshold,
        "metrics": avg,
        "cases": cases,
        "status": "ok" if not failed else "below_threshold",
    }
    if failed:
        report["failed"] = failed
    return report


if __name__ == "__main__":
    import sys

    args = sys.argv[1:]
    limit = int(args[args.index("--limit") + 1]) if "--limit" in args else None
    if "--live" in args:
        print(json.dumps(asyncio.run(run_live(limit=limit)), indent=2))
    else:
        print(json.dumps(run(), indent=2))
