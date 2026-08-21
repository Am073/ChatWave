"""MCP server exposing ChatWave's agent tools over the Model Context Protocol.

The same two read-only tools the LangGraph agent uses are registered on an
in-process MCPServer (the FastMCP-style API shipped with the `mcp` package),
so they are:

- introspectable via `app.mcp.client.list_mcp_tools()` (admin endpoint), and
- callable from any external MCP client (e.g. Claude Desktop) by running
  this module as a stdio server: `uv run python -m app.mcp.server`.

Tenant scope is passed explicitly per tool call — the server never infers
identity, mirroring the API-side TenantContext discipline.
"""
from __future__ import annotations

from typing import Any

from mcp.server.mcpserver import MCPServer

mcp = MCPServer("chatwave")


def _ctx(user_id: str, role: str, college_name: str, department: str | None):
    from app.api.deps import TenantContext

    return TenantContext(
        user_id=user_id,
        role=role,  # type: ignore[arg-type]
        college_name=college_name,
        department=department,
        college_id="",  # not needed for retrieval/announcements
    )


@mcp.tool()
async def search_documents(
    query: str,
    user_id: str,
    role: str,
    college_name: str,
    department: str | None = None,
    top_k: int = 5,
    trace_id: str | None = None,
) -> list[dict[str, Any]]:
    """Tenant-scoped vector search over uploaded institutional documents."""
    from app.agents.tools import _search_documents_impl as _impl

    return await _impl(
        _ctx(user_id, role, college_name, department),
        query,
        top_k=top_k,
        trace_id=trace_id,
    )


@mcp.tool()
async def get_announcements(
    user_id: str,
    role: str,
    college_name: str,
    department: str | None = None,
    limit: int = 10,
    trace_id: str | None = None,
) -> list[dict[str, Any]]:
    """Tenant- and department-scoped announcement feed."""
    from app.agents.tools import _get_announcements_impl as _impl

    return await _impl(
        _ctx(user_id, role, college_name, department),
        limit=limit,
        trace_id=trace_id,
    )


if __name__ == "__main__":
    mcp.run()  # stdio transport for external MCP clients
