"""Prompt-injection detection.

Heuristic, fast, transparent. Detects obvious injection patterns:
- "ignore previous instructions" style overrides
- System role injections
- Long base64/encoded payloads
- Known jailbreak phrases
"""
from __future__ import annotations

import re

INJECTION_PATTERNS: tuple[str, ...] = (
    r"ignore\b.*\bprevious\b.*\binstructions",
    r"disregard\b.*\b(prior|previous|safety)",
    r"bypass\b.*\b(policy|safety)",
    r"reveal\b.*\b(prompt|instructions)",
    r"override\b.*\bsafety",
    r"developer mode",
    r"\bdan\b.*\bjailbreak",
    r"act as\b",
    r"system\s*:",
    r"<\|im_start\|>",
    r"</?\s*system\s*>",
    r"print\b.*\bsystem\b.*\bprompt",
)

_PATTERNS_RE = re.compile("|".join(INJECTION_PATTERNS), re.IGNORECASE)


def score_injection(text: str) -> float:
    """Return a 0..1 risk score. >0.6 should be treated as injection."""
    if not text:
        return 0.0
    matches = _PATTERNS_RE.findall(text)
    base = min(1.0, len(matches) * 0.45)
    strong = ("developer mode", "jailbreak", "previous instructions", "bypass", "reveal")
    if any(s in text.lower() for s in strong):
        base = max(base, 0.7)
    if len(text) > 4000 and re.search(r"[A-Za-z0-9+/]{120,}", text):
        base = min(1.0, base + 0.3)
    return base


def is_injection(text: str, threshold: float = 0.6) -> bool:
    return score_injection(text) >= threshold


def sanitize(text: str) -> str:
    """Strip control characters and obvious overrides."""
    if not text:
        return text
    text = "".join(ch for ch in text if ch == "\n" or ch == "\t" or ord(ch) >= 32)
    text = re.sub(r"</?system.*?>", "", text, flags=re.IGNORECASE | re.DOTALL)
    return text.strip()
