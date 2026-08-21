"""Agent tools: search_documents + get_announcements (read-only).

Tools receive the TenantContext explicitly. RBAC is enforced inside each tool
(spec: role-based access must apply to both API endpoints AND agent tools).
Every tool call is recorded to the audit log.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.api.deps import TenantContext
from app.core.logging import get_logger
from app.guardrails.audit import audit_tool_call
from app.services.announcement_service import list_visible_announcements
from app.services.retrieval_service import retrieve

log = get_logger(__name__)


async def search_documents(
    ctx: TenantContext,
    query: str,
    top_k: int = 5,
    trace_id: str | None = None,
) -> list[dict[str, Any]]:
    """Tool: tenant+department filtered vector search."""
    result = await retrieve(ctx=ctx, query=query, top_k=top_k)
    audit_tool_call(
        tool="search_documents",
        user_id=ctx.user_id,
        role=ctx.role,
        college_name=ctx.college_name,
        ok=True,
        inputs={"query": query, "top_k": top_k},
        outputs_summary={"count": len(result) if result else 0},
        trace_id=trace_id,
    )
    return result or []


async def get_announcements(
    ctx: TenantContext,
    limit: int = 10,
    trace_id: str | None = None,
) -> list[dict[str, Any]]:
    """Tool: tenant + department scoped announcement feed."""
    docs = await list_visible_announcements(ctx, limit=limit)
    result = [
        {
            "id": str(a.id),
            "title": a.title,
            "content": a.content,
            "category": a.category,
            "department": a.department,
            "created_at": (a.created_at or datetime.now(UTC)).isoformat(),
        }
        for a in docs
    ]
    audit_tool_call(
        tool="get_announcements",
        user_id=ctx.user_id,
        role=ctx.role,
        college_name=ctx.college_name,
        ok=True,
        inputs={"limit": limit},
        outputs_summary={"count": len(result) if result else 0},
        trace_id=trace_id,
    )
    return result or []
