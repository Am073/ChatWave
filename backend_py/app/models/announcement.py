"""Announcement model (department + college-wide visibility)."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from beanie import Document, Indexed
from pydantic import BaseModel, Field

AnnouncementCategory = Literal["exam", "fee", "holiday", "event", "notice"]
AnnouncementScope = Literal["college_wide", "department"]


class Announcement(Document):
    author: Indexed(str)  # User id
    author_name: str = ""
    college_name: Indexed(str)  # tenant key
    department: str | None = None  # None => college_wide
    title: str
    content: str
    category: AnnouncementCategory = "notice"
    scope: AnnouncementScope = "college_wide"
    is_private: bool = False
    read_by: list[str] = Field(default_factory=list)  # User ids
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "announcements"
        indexes = ["college_name", "department", "author"]


class AnnouncementOut(BaseModel):
    id: str = Field(alias="_id")
    author: str
    author_name: str
    college_name: str
    department: str | None
    title: str
    content: str
    category: AnnouncementCategory
    scope: AnnouncementScope
    is_private: bool
    read_by: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"populate_by_name": True}


def announcement_out(a: Announcement) -> AnnouncementOut:
    return AnnouncementOut(
        _id=str(a.id),
        author=a.author,
        author_name=a.author_name,
        college_name=a.college_name,
        department=a.department,
        title=a.title,
        content=a.content,
        category=a.category,
        scope=a.scope,
        is_private=a.is_private,
        read_by=a.read_by,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )