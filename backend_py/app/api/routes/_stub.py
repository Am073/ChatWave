"""Placeholder route modules, progressively implemented in later phases.

Each defines a router so app.main can include them at startup without import
errors. Full implementations live in chat.py/upload.py/announcements.py/admin.py/
calendar.py and are filled out in their respective phases.
"""
from __future__ import annotations

from fastapi import APIRouter


def _empty_router() -> APIRouter:
    router = APIRouter()

    @router.get("/", include_in_schema=False)
    async def _stub() -> dict:
        return {"message": "not implemented yet"}

    return router