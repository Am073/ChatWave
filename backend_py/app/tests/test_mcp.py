"""MCP tool-surface tests: introspection, dispatch, agent fallback."""
from __future__ import annotations

from app.api.deps import TenantContext
from app.mcp.client import call_mcp_tool, list_mcp_tools


async def test_list_tools_exposes_both_tools():
    tools = await list_mcp_tools()
    names = {t["name"] for t in tools}
    assert {"search_documents", "get_announcements"} <= names
    for t in tools:
        assert t["description"]
        assert "type" in t["inputSchema"]


async def test_call_through_mcp_returns_payload(db_session):
    """Dispatch through MCPServer with a real (empty) tenant scope."""
    result = await call_mcp_tool(
        "get_announcements",
        {
            "user_id": "u1",
            "role": "student",
            "college_name": "NoSuchCollege",
        },
    )
    assert result == []


async def test_agent_tool_falls_back_when_mcp_fails(db_session, monkeypatch):
    """If MCP dispatch raises, the direct implementation still serves the call."""
    import app.mcp.client as mcp_client
    from app.agents import tools as agent_tools

    async def boom(name, arguments):
        raise RuntimeError("mcp down")

    monkeypatch.setattr(mcp_client, "call_mcp_tool", boom)
    ctx = TenantContext(
        user_id="u1",
        role="student",
        college_name="NoSuchCollege",
        department=None,
        college_id="c1",
    )
    result = await agent_tools.get_announcements(ctx)
    assert result == []


async def test_agent_tool_routes_through_mcp(db_session, monkeypatch):
    """Happy path: the wrapper goes through call_mcp_tool."""
    from app.agents import tools as agent_tools

    seen = {}

    async def fake_call(name, arguments):
        seen["name"] = name
        return [{"id": "a1"}]

    monkeypatch.setattr("app.mcp.client.call_mcp_tool", fake_call)
    ctx = TenantContext(
        user_id="u1",
        role="student",
        college_name="TestU",
        department=None,
        college_id="c1",
    )
    result = await agent_tools.get_announcements(ctx)
    assert result == [{"id": "a1"}]
    assert seen["name"] == "get_announcements"
