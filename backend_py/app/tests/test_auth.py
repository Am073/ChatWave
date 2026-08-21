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
async def test_register_login_logout_flow(db_session, client):
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


@pytest.mark.asyncio
@requires_db
async def test_login_invalid_password(db_session, client):
    # Register a temporary user first
    await client.post(
        "/api/auth/register",
        json={
            "name": "Wrong Pw Student",
            "college_id": "CW-WRONG-PW",
            "password": "Password@123",
            "college_name": "ChatWave College",
            "department": "CS",
            "role": "student",
        },
    )
    # Attempt login with wrong password
    resp = await client.post(
        "/api/auth/login",
        json={
            "college_id": "CW-WRONG-PW",
            "password": "WrongPassword",
            "role": "student",
        },
    )
    assert resp.status_code == 401
    assert "Invalid College ID or password" in resp.text


@pytest.mark.asyncio
@requires_db
async def test_login_incorrect_role(db_session, client):
    # Register a student
    await client.post(
        "/api/auth/register",
        json={
            "name": "Role Guard Student",
            "college_id": "CW-ROLE-STU",
            "password": "Password@123",
            "college_name": "ChatWave College",
            "department": "CS",
            "role": "student",
        },
    )
    # Attempt login as faculty role (which is mismatch)
    resp = await client.post(
        "/api/auth/login",
        json={
            "college_id": "CW-ROLE-STU",
            "password": "Password@123",
            "role": "faculty",
        },
    )
    assert resp.status_code == 401
    assert "Incorrect role" in resp.text


@pytest.mark.asyncio
@requires_db
async def test_token_refresh(db_session, client):
    # Register and login to get refresh token cookie
    login_resp = await client.post(
        "/api/auth/register",
        json={
            "name": "Refresh Student",
            "college_id": "CW-REFRESH-STU",
            "password": "Password@123",
            "college_name": "ChatWave College",
            "department": "CS",
            "role": "student",
        },
    )
    assert login_resp.status_code == 201
    assert "refresh_token" in login_resp.cookies

    # Call refresh endpoint (it reads the refresh_token cookie)
    resp = await client.post("/api/auth/refresh")
    assert resp.status_code == 200
    assert "access_token" in resp.cookies


@pytest.mark.asyncio
@requires_db
async def test_csrf_enforcement(db_session, client):
    # Register a user to get login cookies
    login_resp = await client.post(
        "/api/auth/register",
        json={
            "name": "CSRF Student",
            "college_id": "CW-CSRF-STU",
            "password": "Password@123",
            "college_name": "ChatWave College",
            "department": "CS",
            "role": "student",
        },
    )
    assert login_resp.status_code == 201

    # Perform a mutating action (like change password or logout) without X-CSRF-Token header
    resp = await client.post(
        "/api/auth/change-password",
        json={"oldPassword": "Password@123", "newPassword": "NewPassword@123"},
    )
    # Assert CSRF validation blocks the request
    assert resp.status_code == 403
    assert "CSRF" in resp.text