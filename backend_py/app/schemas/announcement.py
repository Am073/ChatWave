"""Schemas for announcements."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AnnouncementCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    category: Literal["exam", "fee", "holiday", "event", "notice"] = "notice"
    scope: Literal["college_wide", "department"] = "college_wide"
    is_private: bool = False
    department: str | None = None