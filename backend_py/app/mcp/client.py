"""MCP client used by the LangGraph agent and the admin introspection route.

Calls go through the MCPServer's own dispatch (validation + schema handling),
so the agent exercises the same tool surface an external MCP client would —
without a serialization round-trip. Swapping in a remote stdio/SSE transport
later only changes this module.
"""
from __future__ import annotations

import json
from typing import Any

from app.mcp.server import mcp


async def list_mcp_tools() -> list[dict[str, Any]]:
    """Tool specs for admin introspection (name, description, JSON schema)."""
    tools = await mcp.list_tools()
    return [
        {
            "name": t.name,
            "description": t.description,
            "inputSchema": t.input_schema,
        }
        for t in tools
    ]


async def call_mcp_tool(name: str, arguments: dict[str, Any]) -> Any:
    """Invoke a registered MCP tool and unwrap the result payload."""
    result = await mcp.call_tool(name, arguments)
    if getattr(result, "is_error", False):
        raise RuntimeError(f"MCP tool {name!r} execution failed")
    # Structured output first (mcp>=2 wraps return values under 'result').
    structured = getattr(result, "structured_content", None)
    if isinstance(structured, dict) and "result" in structured:
        return structured["result"]
    if structured is not None:
        return structured
    for block in getattr(result, "content", None) or []:
        text = getattr(block, "text", None)
        if text:
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return text
    return None
