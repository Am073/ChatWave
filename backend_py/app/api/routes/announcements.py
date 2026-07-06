"""Announcement routes - preserves v1 department/college-wide visibility rules.

Admin role: sees all announcements (skips $or filter — fixes v1 Bug #6).
Faculty/Admin: can create. Visibility is role+department scoped for reads.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    CSRFDep,
    CurrentUser,
    TenantContextDep,
    require_faculty_or_admin,
)
from app.core.errors import NotFoundError
from app.models.announcement import (
    Announcement,
    announcement_out,
)
from app.models.user import User
from app.schemas.announcement import AnnouncementCreateIn

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
    # Build tenant-scoped query (spec: every query filters by college_name).
    query: dict = {"college_name": ctx.college_name}
    if ctx.role == "admin":
        # Admin sees all announcements within tenant (Bug #6 fix ported).
        pass
    else:
        # Non-admin: college_wide (department null) OR own department.
        own = department or ctx.department
        if own:
            docs = await Announcement.find(
                {
                    "$and": [
                        query,
                        {
                            "$or": [
                                {"department": None},
                                {"department": own},
                            ]
                        },
                    ]
                }
            ).to_list(limit)
        else:
            query["department"] = None  # type: ignore[assignment]
            docs = await Announcement.find(query).to_list(limit)
        if category:
            docs = [d for d in docs if d.category == category]
        return [announcement_out(d).model_dump(by_alias=True) for d in docs]

    docs = await Announcement.find(query).to_list(limit)
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
    return announcement_out(announcement).model_dump(by_alias=True)


@router.put("/{announcement_id}/read")
async def mark_read(
    user: CurrentUser, _: CSRFDep, ctx: TenantContextDep, announcement_id: str
) -> dict:
    announcement = await Announcement.get(announcement_id)
    if announcement is None or announcement.college_name != ctx.college_name:
        raise NotFoundError("Announcement not found")
    if str(user.id) not in announcement.read_by:
        announcement.read_by.append(str(user.id))
        await announcement.save()
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