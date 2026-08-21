"""Data-safety guard: tests must never touch the production database.

Regression guard for a real bug: `uv run` auto-loads .env (APP_ENV=development),
which used to defeat conftest's env override and made the TestClient lifespan
bind Beanie to the production `chatwave` DB while fixtures bound to
`chatwave_test` — splitting state and failing WS auth with 4401.
"""
from __future__ import annotations

import os


def test_app_env_is_forced_to_test():
    assert os.environ.get("APP_ENV") == "test"


async def test_beanie_bound_database_ends_with_test(db_session):
    """Whatever DB Beanie is bound to during tests MUST be a *_test database."""
    from app.models.user import User

    db_name = User.get_settings().pymongo_collection.database.name
    assert db_name.endswith("_test"), (
        f"Tests are bound to non-test database {db_name!r} — refusing to run. "
        "Check APP_ENV forcing in conftest.py."
    )
