"""Announcement service: visibility-scoped query shared by the route + agent tool.

The tenant-scoped query (college_name + role/department filter) is reused by:
  - the public REST list endpoint (announcements.py)
  - the LangGraph agent's get_announcements fallback (tools.py)

Keep this in one place so a query change hits every caller.
"""
from __future__ import annotations

from app.api.deps import TenantContext
from app.models.announcement import Announcement


async def list_visible_announcements(
    ctx: TenantContext,
    *,
    department: str | None = None,
    limit: int = 50,
) -> list[Announcement]:
    """Return announcements visible to `ctx` within the tenant.

    Admin sees all announcements in the college. Non-admin sees college_wide
    (department null) plus their own department (or `department` override).
    """
    base: dict = {"college_name": ctx.college_name}
    if ctx.role == "admin":
        return await Announcement.find(base).to_list(limit)

    own = department or ctx.department
    if own:
        return await Announcement.find(
            {
                "$and": [
                    base,
                    {
                        "$or": [
                            {"department": None},
                            {"department": own},
                        ]
                    },
                ]
            }
        ).to_list(limit)

    base["department"] = None
    return await Announcement.find(base).to_list(limit)
