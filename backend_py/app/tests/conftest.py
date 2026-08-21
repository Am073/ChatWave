"""Pytest configuration.

DB-touching tests are gated behind the `requires_db` marker. They auto-skip
when MongoDB is unreachable so the suite remains useful offline.
"""
from __future__ import annotations

import asyncio
import os

# Hard-override (not setdefault): `uv run` auto-loads .env, which ships
# APP_ENV=development. Without this, the TestClient lifespan binds Beanie to
# the production database while fixtures bind to *_test — splitting state.
os.environ["APP_ENV"] = "test"

import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from beanie import init_beanie  # noqa: E402
from httpx import ASGITransport  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

# Patch Beanie compatibility with newer Motor versions
AsyncIOMotorClient.append_metadata = lambda *args, **kwargs: None

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
        c = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
        await c.admin.command("ping")
        c.close()
        return True
    except Exception:
        return False


_mongo_state: dict = {"available": None, "initialized": False}


def _is_mongo_available() -> bool:
    if _mongo_state["available"] is None:
        try:
            loop = asyncio.new_event_loop()
            reachable = loop.run_until_complete(
                _mongo_reachable(get_settings().mongo_uri)
            )
            loop.close()
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
    
    settings = get_settings()
    import app.core.db as db

    db._motor_client = AsyncIOMotorClient(
        settings.mongo_uri, serverSelectionTimeoutMS=10000, connectTimeoutMS=10000
    )
    await db._motor_client.admin.command("ping")
    db_name = db._motor_client.get_default_database().name
    if not db_name.endswith("_test"):
        db_name += "_test"
    await init_beanie(
        database=db._motor_client[db_name], document_models=MODELS
    )
    
    # Clear collections to ensure a clean slate for each test run
    for model in MODELS:
        await model.delete_all()
        
    yield
    if db._motor_client is not None:
        db._motor_client.close()
        db._motor_client = None


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c