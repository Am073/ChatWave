"""Date extraction from unstructured text.

Parses natural-language responses from the chat agent and pulls out
concrete dates that the user might want to add to their calendar.

The strategy is intentionally conservative:
  1. Regex sweeps for the most common explicit formats (ISO, US, EU, dd-Mon-yyyy).
  2. dateutil.parse() in fuzzy mode for natural-language dates like
     "March 15, 2026" or "next Monday".
  3. A small blocklist of "system" / "today" / "now" terms that should
     never be surfaced as calendar events.
  4. Deduplicate by date, but keep the strongest surrounding context.

The output is a list of DetectedDate records with:
  - date: the parsed calendar date
  - label: a short human label inferred from the surrounding sentence
  - context: a 120-char window around the date for UI display
  - confidence: 0.0 - 1.0 (we only surface >= 0.6 in the UI)
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime

try:
    from dateutil import parser as date_parser  # type: ignore[import-not-found]

    DATEUTIL_AVAILABLE = True
except ImportError:  # pragma: no cover
    DATEUTIL_AVAILABLE = False


# Words we should never treat as dates.
_NOISE_WORDS = frozenset(
    {
        "today", "yesterday", "tomorrow", "now", "soon", "later", "monday",
        "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    }
)

# Heuristics for "event-like" sentences. If a date sits inside a sentence
# matching one of these patterns, we boost its label.
_EVENT_HINTS = [
    r"\b(exam|examination|test|quiz)\b",
    r"\b(holiday|vacation|break)\b",
    # Order matters: put the most-specific keywords first so the label
    # reflects the dominant intent ("submission deadline" → "Deadline date"
    # not "Submission date").
    r"\b(deadline|due date|last date)\b",
    r"\b(submission|due)\b",
    r"\b(event|workshop|seminar|webinar|lecture|class|orientation)\b",
    r"\b(meeting|interview|appointment)\b",
    r"\b(registration|enrollment|admission|convocation|graduation)\b",
    r"\b(fee|payment|installment)\b",
    r"\b(celebration|festival|ceremony)\b",
]

# Regex patterns for explicit date strings. Order matters — first match wins.
_DATE_PATTERNS: tuple[re.Pattern[str], ...] = (
    # ISO: 2026-03-15 or 2026/03/15
    re.compile(r"\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b"),
    # dd-MMM-yyyy or dd-MMM-yy: 15-Mar-2026
    re.compile(
        r"\b(\d{1,2}[-\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s,]\s*\d{2,4})\b",
        re.IGNORECASE,
    ),
    # US: 03/15/2026 — month/day/year. 4-digit year required: without it,
    # scores/ratios like "24/12/26" match as dates.
    re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4})\b"),
    # Written: March 15, 2026 / Mar 15 2026 / 15 March 2026
    re.compile(
        r"\b((?:\d{1,2}\s+)?(?:January|February|March|April|May|June|July|"
        r"August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|"
        r"Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+\d{1,2})?(?:,)?\s+\d{2,4})\b",
        re.IGNORECASE,
    ),
    # Written day-first: 15 March 2026
    re.compile(
        r"\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|"
        r"August|September|October|November|December)[a-z]*\s+\d{2,4})\b",
        re.IGNORECASE,
    ),
)


@dataclass
class DetectedDate:
    date: date
    label: str
    context: str
    confidence: float
    # Original raw substring from the text (for debugging / UI tooltip).
    raw: str
    # The 0-indexed start position of the raw substring in the source text.
    position: int

    def to_dict(self) -> dict:
        return {
            "date": self.date.isoformat(),
            "label": self.label,
            "context": self.context,
            "confidence": round(self.confidence, 2),
            "raw": self.raw,
            "position": self.position,
        }


def _build_event_label(text: str) -> str:
    """Inspect a 1-sentence context window and build a short event label."""
    lowered = text.lower()
    for pattern in _EVENT_HINTS:
        match = re.search(pattern, lowered)
        if match:
            # Capitalize the matched word.
            word = match.group(0).strip().title()
            return f"{word} date"
    return "Event date"


def _extract_context(text: str, position: int, raw: str) -> str:
    """Return a ~120-char window around the matched date for UI display."""
    start = max(0, position - 60)
    end = min(len(text), position + len(raw) + 60)
    snippet = text[start:end].strip()
    # Trim to the nearest sentence boundary when possible.
    for sep in (".", "!", "?"):
        idx = snippet.find(sep)
        if 0 < idx < len(snippet) - 1:
            snippet = snippet[: idx + 1]
            break
    snippet = re.sub(r"\s+", " ", snippet)
    return snippet


def _parse_date(raw: str) -> date | None:
    """Try a series of parsing strategies, return the first valid date."""
    raw = raw.strip().rstrip(".,;:")
    if not raw:
        return None
    if DATEUTIL_AVAILABLE:
        try:
            # Anchor missing fields to the CURRENT year: "March 15" means this
            # year's March 15, not 2099. The old 2099 default sailed straight
            # through the junk-year filter below as a fake far-future date.
            current_year = datetime.now().year
            parsed = date_parser.parse(
                raw, fuzzy=True, default=datetime(current_year, 1, 1)
            )
            return parsed.date()
        except (ValueError, OverflowError, TypeError):
            pass
    # Final fallback: ISO only.
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None


def _confidence_for(raw: str, parsed: date | None) -> float:
    if parsed is None:
        return 0.0
    # Reject year-zero / far-future junk from fuzzy parsing.
    if parsed.year < 2000 or parsed.year > 2100:
        return 0.0
    # ISO and dd-MMM-yyyy are highly specific — high confidence.
    if re.fullmatch(r"\d{4}-\d{1,2}-\d{1,2}", raw):
        return 0.95
    if re.search(r"[A-Za-z]{3,}", raw):  # has month name
        return 0.9
    # Slash format is ambiguous (US vs EU); drop confidence.
    if "/" in raw:
        return 0.7
    return 0.6


def extract_dates(text: str, *, min_confidence: float = 0.6) -> list[DetectedDate]:
    """Extract all date-like substrings from `text`.

    Returns a deduplicated list sorted by position. If two matches collapse
    to the same calendar date, we keep the one with the higher confidence
    (and the earlier position as a tiebreaker).
    """
    if not text:
        return []
    found: list[DetectedDate] = []
    seen_positions: set[int] = set()
    for pattern in _DATE_PATTERNS:
        for match in pattern.finditer(text):
            if match.start() in seen_positions:
                continue
            raw = match.group(1) if match.lastindex else match.group(0)
            # Skip noise words.
            if raw.strip().lower() in _NOISE_WORDS:
                continue
            parsed = _parse_date(raw)
            conf = _confidence_for(raw, parsed)
            if parsed is None or conf < min_confidence:
                continue
            label = _build_event_label(_extract_context(text, match.start(), raw))
            found.append(
                DetectedDate(
                    date=parsed,
                    label=label,
                    context=_extract_context(text, match.start(), raw),
                    confidence=conf,
                    raw=raw,
                    position=match.start(),
                )
            )
            seen_positions.add(match.start())
    # Deduplicate by date — keep highest confidence (earliest position as tiebreaker).
    by_date: dict[date, DetectedDate] = {}
    for d in found:
        if d.date not in by_date or d.confidence > by_date[d.date].confidence:
            by_date[d.date] = d
    return sorted(by_date.values(), key=lambda d: d.position)


def merge_date_sources(*sources: str) -> list[DetectedDate]:
    """Run extraction on multiple text blobs and merge results.

    Used to combine the chat answer + the source snippets so we don't miss
    a date that only appears in the cited document chunk.
    """
    seen_dates: set[date] = set()
    merged: list[DetectedDate] = []
    for blob in sources:
        if not blob:
            continue
        for d in extract_dates(blob):
            if d.date in seen_dates:
                continue
            seen_dates.add(d.date)
            merged.append(d)
    return merged
