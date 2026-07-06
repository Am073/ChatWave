"""CalendarEvent model."""
from __future__ import annotations

from datetime import UTC, date, datetime

from beanie import Document, Indexed
from pydantic import BaseModel, Field


class CalendarEvent(Document):
    user: Indexed(str)
    google_event_id: str | None = None
    title: str
    start_time: datetime
    end_time: datetime
    event_date: date | None = None
    event_description: str | None = None
    source_chat_log: str | None = None  # ChatLog id
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "calendarevents"
        indexes = ["user", "start_time"]


class CalendarEventOut(BaseModel):
    id: str = Field(alias="_id")
    user: str
    title: str
    start_time: datetime
    end_time: datetime
    google_event_id: str | None = None
    event_description: str | None = None
    source_chat_log: str | None = None

    model_config = {"populate_by_name": True}