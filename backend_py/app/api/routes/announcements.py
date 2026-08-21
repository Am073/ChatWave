"""Announcement routes - preserves v1 department/college-wide visibility rules.

Admin role: sees all announcements (skips $or filter — fixes v1 Bug #6).
Faculty/Admin: can create. Visibility is role+department scoped for reads.
A SSE endpoint allows live push of newly-created announcements to subscribed
clients in the same tenant.
"""
from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sse_starlette.sse import EventSourceResponse

from app.api.deps import (
    CSRFDep,
    CurrentUser,
    TenantContextDep,
    require_faculty_or_admin,
)
from app.core.errors import NotFoundError
from app.events.announcement_bus import bus, serialize
from app.models.announcement import (
    Announcement,
    announcement_out,
)
from app.models.user import User
from app.schemas.announcement import AnnouncementCreateIn
from app.services.announcement_service import list_visible_announcements

router = APIRouter()

FacultyOrAdmin = Annotated[User, Depends(require_faculty_or_admin)]


@router.get("")
async def list_announcements(
    user: CurrentUser,
    ctx: TenantContextDep,
    category: str | None = Query(None),
    department: str | None = Query(None),
    limit: int = Query(50, le=200),
) -> list[dict]:
    docs = await list_visible_announcements(ctx, department=department, limit=limit)
    if category:
        docs = [d for d in docs if d.category == category]
    return [announcement_out(d).model_dump(by_alias=True) for d in docs]


@router.post("", status_code=201)
async def create_announcement(
    user: FacultyOrAdmin,
    _: CSRFDep,
    ctx: TenantContextDep,
    payload: AnnouncementCreateIn,
) -> dict:
    target_dept = payload.department
    if payload.scope == "college_wide":
        target_dept = None
    elif not target_dept:
        target_dept = ctx.department
    else:
        # Faculty may only post to their own department; admins may post anywhere.
        from app.core.errors import ForbiddenError

        if user.role != "admin" and target_dept != ctx.department:
            raise ForbiddenError("Faculty can only post in their own department")
    announcement = Announcement(
        author=str(user.id),
        author_name=user.name,
        college_name=ctx.college_name,
        department=target_dept,
        title=payload.title,
        content=payload.content,
        category=payload.category,
        scope=payload.scope,
        is_private=payload.is_private,
    )
    await announcement.insert()
    out = announcement_out(announcement).model_dump(by_alias=True)
    # Publish to SSE subscribers in this tenant (best-effort).
    await bus.publish(
        ctx.college_name,
        {"type": "announcement.created", "announcement": out},
    )
    return out


@router.get("/stream")
async def stream_announcements(
    user: CurrentUser, ctx: TenantContextDep
):
    """Server-Sent Events stream of new announcements in the user's tenant.

    Heartbeat every 25 seconds to keep idle connections open across proxies.
    """

    async def event_gen():
        q = await bus.subscribe(ctx.college_name)
        try:
            yield {"event": "ready", "data": serialize({"tenant": ctx.college_name})}
            while True:
                try:
                    payload = await asyncio.wait_for(q.get(), timeout=25.0)
                    yield {
                        "event": "announcement",
                        "data": serialize(payload),
                    }
                except TimeoutError:
                    # Heartbeat keep-alive.
                    yield {"event": "ping", "data": "{}"}
        finally:
            await bus.unsubscribe(ctx.college_name, q)

    return EventSourceResponse(event_gen())


@router.put("/{announcement_id}/read")
async def mark_read(
    user: CurrentUser, _: CSRFDep, ctx: TenantContextDep, announcement_id: str
) -> dict:
    """Idempotent mark-as-read: $addToSet makes the operation race-free
    and avoids the read-modify-write pattern that would otherwise let two
    concurrent clicks append the same user_id twice."""
    announcement = await Announcement.get(announcement_id)
    if announcement is None or announcement.college_name != ctx.college_name:
        raise NotFoundError("Announcement not found")
    await announcement.update({"$addToSet": {"read_by": str(user.id)}})
    return {"message": "Marked as read"}


@router.delete("/{announcement_id}")
async def delete_announcement(
    user: CurrentUser, _: CSRFDep, ctx: TenantContextDep, announcement_id: str
) -> dict:
    announcement = await Announcement.get(announcement_id)
    if announcement is None or announcement.college_name != ctx.college_name:
        raise NotFoundError("Announcement not found")
    if announcement.author != str(user.id) and user.role != "admin":
        from app.core.errors import ForbiddenError

        raise ForbiddenError("Only author or admin may delete")
    await announcement.delete()
    return {"message": "Announcement deleted"}