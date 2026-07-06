"""Auth integration tests.

The boundary tests (auth required, RBAC) run without a DB. The full
register/login/logout flow requires a reachable MongoDB and is gated behind
the `requires_db` marker (auto-skipped when Mongo is offline).
"""
from __future__ import annotations

import pytest

from app.tests.conftest import requires_db


@pytest.mark.asyncio
async def test_health_endpoint(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("ok", "degraded")
    assert "services" in body


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_admin_requires_auth(client):
    resp = await client.get("/api/admin/stats")
    assert resp.status_code == 401


@pytest.mark.asyncio
@requires_db
async def test_register_login_logout_flow(client):
    resp = await client.post(
        "/api/auth/register",
        json={
            "name": "Test Student",
            "college_id": "CW-TEST-STU",
            "password": "Password@123",
            "college_name": "ChatWave College",
            "department": "Computer Science",
            "role": "student",
        },
    )
    assert resp.status_code == 201, resp.text
    cookies = resp.cookies
    assert "access_token" in cookies
    assert "csrf_token" in cookies

    csrf = cookies.get("csrf_token")
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["college_id"] == "CW-TEST-STU"

    # Student cannot access admin stats (RBAC)
    resp = await client.get("/api/admin/stats")
    assert resp.status_code == 403

    # Logout requires CSRF
    resp = await client.post(
        "/api/auth/logout",
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 200