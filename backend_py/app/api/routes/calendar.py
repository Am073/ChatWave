"""Calendar routes - Google Calendar OAuth integration (deferred/optional)."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CSRFDep, CurrentUser

router = APIRouter()


@router.get("/status")
async def calendar_status(user: CurrentUser):
    return {"connected": False}


@router.get("/auth")
async def calendar_auth(user: CurrentUser):
    from app.core.errors import AppError

    raise AppError("Google Calendar OAuth not configured", status_code=501)


@router.post("/events")
async def create_event(user: CurrentUser, _: CSRFDep):
    from app.core.errors import AppError

    raise AppError("Calendar events not implemented in v2 yet", status_code=501)


@router.get("/events")
async def list_events(user: CurrentUser):
    return []