"""Pytest configuration.

Phase 1 acceptance: Tests can start the FastAPI app.
DB-touching tests are gated behind the `requires_db` marker. They auto-skip
when MongoDB is unreachable so the suite remains useful offline.
"""
from __future__ import annotations

import asyncio
import os

os.environ.setdefault("APP_ENV", "test")

import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from beanie import init_beanie  # noqa: E402
from httpx import ASGITransport  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.models.announcement import Announcement  # noqa: E402
from app.models.calendar_event import CalendarEvent  # noqa: E402
from app.models.chat_log import ChatLog  # noqa: E402
from app.models.document import DocumentRecord  # noqa: E402
from app.models.google_token import UserGoogleToken  # noqa: E402
from app.models.user import User  # noqa: E402

MODELS = [User, DocumentRecord, Announcement, ChatLog, CalendarEvent, UserGoogleToken]


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


async def _mongo_reachable(uri: str) -> bool:
    try:
        c = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=800, connectTimeoutMS=800)
        await c.admin.command("ping")
        c.close()
        return True
    except Exception:
        return False


_mongo_state: dict = {"available": None, "initialized": False}


def _is_mongo_available() -> bool:
    if _mongo_state["available"] is None:
        try:
            reachable = asyncio.get_event_loop().run_until_complete(
                _mongo_reachable(get_settings().mongo_uri)
            )
        except Exception:
            reachable = False
        _mongo_state["available"] = reachable
    return bool(_mongo_state["available"])


requires_db = pytest.mark.skipif(
    not _is_mongo_available(),
    reason="MongoDB unavailable; integration test requires a live database.",
)


@pytest_asyncio.fixture
async def db_session():
    """Per-test fixture that ensures Beanie is initialized against Mongo."""
    if not _is_mongo_available():
        pytest.skip("MongoDB unavailable; this test requires a live database.")
    if not _mongo_state["initialized"]:
        settings = get_settings()
        import app.core.db as db

        db._motor_client = AsyncIOMotorClient(
            settings.mongo_uri, serverSelectionTimeoutMS=2000, connectTimeoutMS=2000
        )
        await db._motor_client.admin.command("ping")
        await init_beanie(
            database=db._motor_client.get_default_database(), document_models=MODELS
        )
        _mongo_state["initialized"] = True
    yield
    # Note: we don't tear down between tests; Beanie models persist across
    # the session. Individual tests should create unique identifiers.


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c