"""Agent tools: search_documents + get_announcements (read-only).

Tools receive the TenantContext explicitly. RBAC is enforced inside each tool
(spec: role-based access must apply to both API endpoints AND agent tools).
Every tool call is recorded to the audit log.

Dispatch goes through the MCP server (app.mcp) so the agent exercises the
same tool surface an external MCP client sees; if MCP dispatch fails for any
reason we fall back to calling the implementation directly.
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


async def _search_documents_impl(
    ctx: TenantContext,
    query: str,
    top_k: int = 5,
    trace_id: str | None = None,
) -> list[dict[str, Any]]:
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


async def _get_announcements_impl(
    ctx: TenantContext,
    limit: int = 10,
    trace_id: str | None = None,
) -> list[dict[str, Any]]:
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


async def _via_mcp(name: str, arguments: dict[str, Any]) -> Any | None:
    """Route through the MCP server; None signals 'use direct fallback'."""
    try:
        from app.mcp.client import call_mcp_tool

        return await call_mcp_tool(name, arguments)
    except Exception as exc:  # noqa: BLE001 - MCP must never break the agent
        log.warning("mcp_tool_dispatch_failed", tool=name, error=str(exc))
        return None


async def search_documents(
    ctx: TenantContext,
    query: str,
    top_k: int = 5,
    trace_id: str | None = None,
) -> list[dict[str, Any]]:
    """Tool: tenant+department filtered vector search."""
    via = await _via_mcp(
        "search_documents",
        {
            "query": query,
            "user_id": ctx.user_id,
            "role": ctx.role,
            "college_name": ctx.college_name,
            "department": ctx.department,
            "top_k": top_k,
            "trace_id": trace_id,
        },
    )
    if via is not None:
        return via
    return await _search_documents_impl(ctx, query, top_k=top_k, trace_id=trace_id)


async def get_announcements(
    ctx: TenantContext,
    limit: int = 10,
    trace_id: str | None = None,
) -> list[dict[str, Any]]:
    """Tool: tenant + department scoped announcement feed."""
    via = await _via_mcp(
        "get_announcements",
        {
            "user_id": ctx.user_id,
            "role": ctx.role,
            "college_name": ctx.college_name,
            "department": ctx.department,
            "limit": limit,
            "trace_id": trace_id,
        },
    )
    if via is not None:
        return via
    return await _get_announcements_impl(ctx, limit=limit, trace_id=trace_id)
