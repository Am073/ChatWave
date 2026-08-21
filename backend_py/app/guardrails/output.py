"""Output guardrails: PII redaction."""
from __future__ import annotations

import re

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
