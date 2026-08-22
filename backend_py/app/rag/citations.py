"""Citation validation: source-grounding + refusal policy.

Spec non-negotiable constraint: AI responses for institutional policy must be
source-grounded or refuse/ask clarification. This module enforces that.
"""
from __future__ import annotations

from typing import Any


def has_grounded_sources(sources: list[dict[str, Any]], min_score: float = 0.55) -> bool:
    if not sources:
        return False
    for s in sources:
        try:
            # Fail closed: a malformed score (None, non-numeric) counts as
            # NOT grounded instead of crashing the grounding gate.
            if float(s.get("score") or 0.0) >= min_score:
                return True
        except (TypeError, ValueError):
            continue
    return False


def build_refusal_answer() -> str:
    return (
        "I don't have enough grounded information in the institutional knowledge "
        "base to answer confidently. Could you rephrase the question or specify "
        "the document or policy you're asking about?"
    )


def build_clarification_question() -> str:
    return (
        "Your question is a bit ambiguous. Could you clarify which policy, "
        "academic program, or time period you're asking about?"
    )