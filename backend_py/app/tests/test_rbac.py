"""RBAC boundary tests (offline-safe).

Verify the FastAPI dependency wiring enforces 401/403 correctly when no DB
or live services are available.
"""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_unauth_user_blocked_from_protected_routes(client):
    protected = [
        ("GET", "/api/auth/me"),
        ("GET", "/api/admin/stats"),
        ("GET", "/api/admin/health"),
        ("GET", "/api/admin/users"),
        ("GET", "/api/admin/quality"),
        ("GET", "/api/upload"),
        ("GET", "/api/chat/history"),
    ]
    for method, path in protected:
        resp = await client.request(method, path)
        assert resp.status_code in (401, 403), f"{method} {path} -> {resp.status_code}"


@pytest.mark.asyncio
async def test_mutating_routes_without_csrf_and_no_auth_rejected(client):
    """No-auth mutating calls should bounce at auth, not at CSRF."""
    resp = await client.post(
        "/api/auth/logout",
        headers={"X-CSRF-Token": "x"},
    )
    # Auth is the first gate, so 401 is correct.
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_health_is_public(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_csrf_token_endpoint_works_without_auth(client):
    resp = await client.get("/api/auth/csrf-token")
    assert resp.status_code in (200, 204)