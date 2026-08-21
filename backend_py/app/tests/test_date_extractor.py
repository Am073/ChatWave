"""Unit tests for the date extraction service.

Pure-function tests — no DB / network / model dependencies. Run with:
    uv run pytest app/tests/test_date_extractor.py
"""
from __future__ import annotations

from datetime import date

import pytest

from app.services.date_extractor import (
    DetectedDate,
    extract_dates,
    merge_date_sources,
)


class TestExtractDates:
    def test_extracts_iso_date(self):
        results = extract_dates("The exam is on 2026-03-15.")
        assert len(results) == 1
        assert results[0].date == date(2026, 3, 15)
        assert results[0].raw == "2026-03-15"

    def test_extracts_us_slash(self):
        results = extract_dates("Deadline: 03/15/2026.")
        assert any(d.date == date(2026, 3, 15) for d in results)

    def test_extracts_eu_slash(self):
        # 15/03/2026 — dateutil may interpret as US (March 15) or EU
        # depending on settings. We just assert the result is a real date.
        results = extract_dates("Submit by 15/03/2026 please.")
        assert len(results) == 1
        assert results[0].date.year == 2026
        assert results[0].date.month in (3, 15 % 12 or 12)

    def test_extracts_month_name(self):
        results = extract_dates("The conference starts March 15, 2026.")
        assert any(d.date == date(2026, 3, 15) for d in results)

    def test_extracts_day_month_year(self):
        results = extract_dates("Registration closes 15 March 2026.")
        assert any(d.date == date(2026, 3, 15) for d in results)

    def test_extracts_dd_mon_yyyy(self):
        results = extract_dates("Holiday on 15-Mar-2026.")
        assert any(d.date == date(2026, 3, 15) for d in results)

    def test_extracts_multiple_dates(self):
        text = (
            "The mid-term exam is on 2026-03-15 and the final exam "
            "is on 2026-05-20. The semester break starts on 2026-06-01."
        )
        results = extract_dates(text)
        assert len(results) == 3
        dates = {d.date for d in results}
        assert date(2026, 3, 15) in dates
        assert date(2026, 5, 20) in dates
        assert date(2026, 6, 1) in dates

    def test_returns_empty_for_no_dates(self):
        assert extract_dates("There is no date in this text at all.") == []

    def test_returns_empty_for_empty_string(self):
        assert extract_dates("") == []

    def test_skips_today_tomorrow(self):
        # These should never be surfaced as concrete events.
        results = extract_dates("The exam is today or tomorrow.")
        assert results == []

    def test_returns_detected_date_with_label(self):
        results = extract_dates("The exam is on 2026-03-15.")
        assert "Exam" in results[0].label

    def test_infers_deadline_label(self):
        results = extract_dates("The submission deadline is 2026-04-01.")
        assert "Deadline" in results[0].label

    def test_infers_holiday_label(self):
        results = extract_dates("College holiday on 2026-12-25.")
        assert "Holiday" in results[0].label

    def test_default_label_when_no_hint(self):
        results = extract_dates("Something happens on 2026-03-15.")
        assert results[0].label == "Event date"

    def test_context_window_includes_surrounding_text(self):
        text = "The mid-term examination in Physics is scheduled for 2026-03-15."
        results = extract_dates(text)
        assert "mid-term" in results[0].context.lower() or "examination" in results[0].context.lower()

    def test_confidence_high_for_iso(self):
        results = extract_dates("On 2026-03-15 we have a meeting.")
        assert results[0].confidence >= 0.9

    def test_dedupes_when_same_date_twice(self):
        text = "First mention 2026-03-15 and again 2026-03-15 later."
        results = extract_dates(text)
        assert len(results) == 1

    def test_keeps_higher_confidence_for_same_date(self):
        text = "The ISO date 2026-03-15 and the slash form 03/15/2026."
        results = extract_dates(text)
        # Both should resolve to March 15, 2026 — keep the higher confidence.
        assert len(results) == 1
        assert results[0].date == date(2026, 3, 15)

    def test_filters_far_future_year(self):
        results = extract_dates("Happens in 9999-01-01.")
        assert results == []


class TestMergeDateSources:
    def test_dedupes_across_sources(self):
        a = extract_dates("Exam on 2026-03-15.")
        b = extract_dates("Again 2026-03-15 in another doc.")
        merged = merge_date_sources(a[0].context, b[0].context)
        assert len(merged) == 1

    def test_preserves_unique_dates(self):
        merged = merge_date_sources(
            "Exam on 2026-03-15.",
            "Holiday on 2026-05-01.",
        )
        assert len(merged) == 2
        dates = {d.date for d in merged}
        assert date(2026, 3, 15) in dates
        assert date(2026, 5, 1) in dates

    def test_handles_empty_input(self):
        assert merge_date_sources() == []
        assert merge_date_sources("", None) == []
