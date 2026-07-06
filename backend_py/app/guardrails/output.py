"""Output guardrails: PII redaction, citation-grounding enforcement, refusals."""
from __future__ import annotations

import re
from typing import Any

from app.guardrails.injection import sanitize

_PII_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("email", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")),
    ("phone", re.compile(r"\+?\d[\d\s().-]{7,}\d")),
)


def redact_pii(text: str) -> tuple[str, list[str]]:
    found: list[str] = []
    redacted = text
    for name, pat in _PII_PATTERNS:
        matches = pat.findall(redacted)
        if matches:
            found.append(name)
            redacted = pat.sub(f"[REDACTED:{name}]", redacted)
    return redacted, found


def ensure_source_grounding(answer: str, sources: list[dict]) -> bool:
    """True if answer references at least one source identifier [n] or has grounded text.

    For institutional-policy questions the spec requires source citations.
    """
    if not sources:
        return False
    # If any citation marker [n] exists, accept it.
    if re.search(r"\[\d+\]", answer):
        return True
    # Heuristic: does the answer share any significant phrase with sources?
    if not answer or not sources:
        return False
    answer_tokens = set(re.findall(r"\b\w{6,}\b", answer.lower()))
    if not answer_tokens:
        return False
    for s in sources:
        s_tokens = set(re.findall(r"\b\w{6,}\b", (s.get("text") or "").lower()))
        if len(answer_tokens & s_tokens) >= 3:
            return True
    return False


def safe_output(text: str) -> dict[str, Any]:
    cleaned = sanitize(text)
    cleaned, pii = redact_pii(cleaned)
    return {"text": cleaned, "pii_redacted": pii}