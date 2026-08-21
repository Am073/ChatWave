"""Calendar routes - Google Calendar OAuth + event CRUD."""
from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.api.deps import CSRFDep, CurrentUser
from app.core.errors import ValidationAppError
from app.models.calendar_event import CalendarEvent
from app.models.user import User

router = APIRouter()


class CalendarEventIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    start_time: datetime
    end_time: datetime
    description: str | None = Field(default=None, max_length=2000)
    location: str | None = Field(default=None, max_length=200)


def _user(user: User) -> str:
    return str(user.id)


@router.get("/status")
async def calendar_status(user: CurrentUser):
    """Return whether the user has connected Google Calendar."""
    from app.models.google_token import UserGoogleToken

    record = await UserGoogleToken.find_one({"user": _user(user)})
    return {
        "connected": record is not None,
        "expiresAt": record.expires_at if record else None,
    }


@router.get("/auth")
async def calendar_auth(user: CurrentUser):
    """Build the Google OAuth consent URL with a signed state."""
    from app.services import calendar_service

    state = calendar_service.generate_state(_user(user))
    url = calendar_service.build_auth_url(state)
    return {"authorizationUrl": url, "state": state}


@router.get("/oauth/callback")
async def calendar_oauth_callback(code: str, state: str):
    """OAuth callback: exchange the code and store encrypted tokens.

    The signed state is verified; on success we redirect back to the frontend
    with a status flag so the UI can show a toast.
    """
    from fastapi.responses import RedirectResponse

    from app.core.config import get_settings
    from app.services import calendar_service

    settings = get_settings()
    user_id = calendar_service.verify_state(state)
    try:
        token_data = await calendar_service.exchange_code(code)
        await calendar_service.store_tokens(user_id, token_data)
    except Exception:
        return RedirectResponse(
            url=f"{settings.frontend_url}/settings/calendar?status=error"
        )
    return RedirectResponse(
        url=f"{settings.frontend_url}/settings/calendar?status=connected"
    )


@router.post("/events", status_code=201)
async def create_event(
    user: CurrentUser, _: CSRFDep, payload: CalendarEventIn
):
    """Create a Google Calendar event on the user's primary calendar."""
    from app.services import calendar_service

    if payload.end_time <= payload.start_time:
        raise ValidationAppError("end_time must be after start_time")
    created = await calendar_service.create_event(
        _user(user),
        summary=payload.title,
        start=payload.start_time,
        end=payload.end_time,
        description=payload.description,
        location=payload.location,
    )
    # Mirror locally for offline reference + analytics.
    local = CalendarEvent(
        user=_user(user),
        google_event_id=created.get("id"),
        title=payload.title,
        start_time=payload.start_time,
        end_time=payload.end_time,
        event_description=payload.description,
    )
    await local.insert()
    return {
        "id": created.get("id"),
        "title": payload.title,
        "start_time": payload.start_time.isoformat(),
        "end_time": payload.end_time.isoformat(),
        "htmlLink": created.get("htmlLink"),
    }


@router.get("/events")
async def list_events(
    user: CurrentUser,
    time_min: datetime | None = Query(None),
    time_max: datetime | None = Query(None),
    max_results: int = Query(50, le=200),
):
    from app.services import calendar_service

    if not time_min:
        time_min = datetime.now(UTC)
    items = await calendar_service.list_events(
        _user(user), time_min=time_min, time_max=time_max, max_results=max_results
    )
    return {
        "events": [
            {
                "id": item.get("id"),
                "title": item.get("summary"),
                "start": (item.get("start") or {}).get("dateTime"),
                "end": (item.get("end") or {}).get("dateTime"),
                "htmlLink": item.get("htmlLink"),
                "status": item.get("status"),
            }
            for item in items
        ]
    }


@router.delete("/events/{event_id}")
async def delete_event(user: CurrentUser, _: CSRFDep, event_id: str):
    from app.services import calendar_service

    await calendar_service.delete_event(_user(user), event_id)
    # Also remove the local mirror.
    local = await CalendarEvent.find_one(
        {"user": _user(user), "google_event_id": event_id}
    )
    if local is not None:
        await local.delete()
    return {"message": "Event deleted"}


@router.post("/sync")
async def sync_events(user: CurrentUser, _: CSRFDep):
    """Pull all upcoming Google events and mirror them into the local collection."""
    from app.services import calendar_service

    items = await calendar_service.list_events(_user(user), time_min=datetime.now(UTC))
    synced = 0
    for item in items:
        google_id = item.get("id")
        if not google_id:
            continue
        existing = await CalendarEvent.find_one(
            {"user": _user(user), "google_event_id": google_id}
        )
        if existing is None:
            start_str = (item.get("start") or {}).get("dateTime")
            end_str = (item.get("end") or {}).get("dateTime")
            if not start_str or not end_str:
                continue
            await CalendarEvent(
                user=_user(user),
                google_event_id=google_id,
                title=item.get("summary", "Untitled"),
                start_time=datetime.fromisoformat(start_str.replace("Z", "+00:00")),
                end_time=datetime.fromisoformat(end_str.replace("Z", "+00:00")),
                event_description=item.get("description"),
            ).insert()
            synced += 1
    return {"synced": synced, "total": len(items)}


@router.delete("/disconnect")
async def disconnect(user: CurrentUser, _: CSRFDep):
    from app.services import calendar_service

    return await calendar_service.disconnect(_user(user))


# ---- Smart date detection + bulk add ---------------------------------------


class BulkEventIn(BaseModel):
    events: list[CalendarEventIn] = Field(min_length=1, max_length=25)


class ExtractDatesIn(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    sources: list[str] | None = Field(default=None, max_length=10)


@router.post("/extract-dates")
async def extract_dates(
    user: CurrentUser,
    payload: ExtractDatesIn,
) -> dict:
    """Detect calendar-worthy dates inside a chat response.

    Combines the assistant's answer with any cited document chunks so we
    don't miss a date that lives only in the source. Returns a deduplicated
    list with inferred labels (e.g. "Exam date", "Deadline").
    """
    from app.services.date_extractor import merge_date_sources

    blobs: list[str] = [payload.text]
    if payload.sources:
        blobs.extend(s for s in payload.sources if s)
    detected = merge_date_sources(*blobs)
    return {"dates": [d.to_dict() for d in detected]}


@router.post("/events/bulk", status_code=201)
async def bulk_create_events(
    user: CurrentUser, _: CSRFDep, payload: BulkEventIn
):
    """Create multiple Google Calendar events in one call.

    Used by the chat UI when a response contains several candidate dates and
    the student picks the ones they want to track. Each event is created
    independently; partial failures are reported in the per-event `status`.
    """
    from app.services import calendar_service

    # Pre-validate the batch.
    for ev in payload.events:
        if ev.end_time <= ev.start_time:
            raise ValidationAppError(
                f"Event '{ev.title}' has end_time <= start_time"
            )

    results: list[dict] = []
    successes = 0
    failures = 0
    for ev in payload.events:
        try:
            created = await calendar_service.create_event(
                _user(user),
                summary=ev.title,
                start=ev.start_time,
                end=ev.end_time,
                description=ev.description,
                location=ev.location,
            )
            # Mirror locally for analytics + offline reference.
            local = CalendarEvent(
                user=_user(user),
                google_event_id=created.get("id"),
                title=ev.title,
                start_time=ev.start_time,
                end_time=ev.end_time,
                event_description=ev.description,
            )
            await local.insert()
            results.append(
                {
                    "ok": True,
                    "title": ev.title,
                    "id": created.get("id"),
                    "htmlLink": created.get("htmlLink"),
                }
            )
            successes += 1
        except Exception as exc:  # noqa: BLE001
            from app.core.errors import AppError

            status_code = getattr(exc, "status_code", 500)
            message = str(exc) if isinstance(exc, AppError) else "Failed to create event"
            results.append(
                {
                    "ok": False,
                    "title": ev.title,
                    "error": message,
                    "status": status_code,
                }
            )
            failures += 1
    return {
        "summary": {
            "total": len(payload.events),
            "succeeded": successes,
            "failed": failures,
        },
        "results": results,
    }
