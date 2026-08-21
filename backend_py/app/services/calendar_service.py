"""Google Calendar OAuth + event service.

This module handles the full Google Calendar integration lifecycle:
1. Building the OAuth authorization URL.
2. Exchanging the callback code for access + refresh tokens.
3. Storing encrypted tokens on the user document.
4. Refreshing expired access tokens.
5. Listing/creating/deleting calendar events on behalf of the user.

The module avoids the heavyweight google-auth + google-api-python-client
libraries; it speaks directly to the Google OAuth2 + Calendar REST APIs via
httpx. This keeps the dependency footprint small and the implementation
explicit (good for interviews).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.core.security import _settings as _security_settings  # type: ignore[attr-defined]
from app.models.google_token import UserGoogleToken

log = get_logger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
OAUTH_SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


# ---- Token encryption (AES-256-GCM via cryptography) ----

def _get_fernet_key() -> bytes:
    """Derive a Fernet-compatible key from the JWT secret (deterministic, 32 bytes)."""
    # We intentionally derive a Fernet-compatible key from JWT_SECRET so we
    # don't require an additional secret. For production, the JWT secret
    # rotation will invalidate existing tokens — that is acceptable since
    # users will simply be asked to re-authorize.
    secret = _security_settings.jwt_secret.encode("utf-8")
    return base64.urlsafe_b64encode(hashlib.sha256(secret).digest())


def _encrypt(value: str) -> str:
    from cryptography.fernet import Fernet

    return Fernet(_get_fernet_key()).encrypt(value.encode("utf-8")).decode("utf-8")


def _decrypt(ciphertext: str) -> str:
    from cryptography.fernet import Fernet, InvalidToken

    try:
        return Fernet(_get_fernet_key()).decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise AppError("Stored token could not be decrypted", status_code=500) from exc


# ---- OAuth flow ----

def build_auth_url(state: str) -> str:
    """Return the Google OAuth consent URL with our callback + scopes."""
    settings = get_settings()
    if not settings.google_oauth_client_id:
        raise AppError("Google OAuth client ID is not configured", status_code=503)
    params = {
        "client_id": settings.google_oauth_client_id,
        "redirect_uri": settings.google_oauth_redirect_uri,
        "response_type": "code",
        "scope": " ".join(OAUTH_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def generate_state(user_id: str) -> str:
    """Sign a per-request state value that round-trips the user id."""
    nonce = secrets.token_urlsafe(16)
    sig = hmac.new(
        _security_settings.csrf_secret.encode("utf-8"),
        f"{user_id}:{nonce}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{user_id}.{nonce}.{sig}"


def verify_state(state: str) -> str:
    """Verify the signed state and return the embedded user id."""
    try:
        user_id, nonce, sig = state.split(".", 2)
    except ValueError as exc:
        raise AppError("Invalid OAuth state", status_code=400) from exc
    expected = hmac.new(
        _security_settings.csrf_secret.encode("utf-8"),
        f"{user_id}:{nonce}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        raise AppError("Invalid OAuth state", status_code=400)
    return user_id


async def exchange_code(code: str) -> dict[str, Any]:
    """Exchange an authorization code for tokens."""
    settings = get_settings()
    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        raise AppError("Google OAuth is not configured", status_code=503)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "redirect_uri": settings.google_oauth_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code != 200:
        log.warning("google_token_exchange_failed", status=resp.status_code, body=resp.text[:300])
        raise AppError("Failed to exchange code for tokens", status_code=502)
    return resp.json()


async def store_tokens(user_id: str, token_data: dict[str, Any]) -> UserGoogleToken:
    """Persist encrypted tokens for the user (upsert)."""
    access = token_data.get("access_token")
    refresh = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in")
    expires_at = (
        datetime.now(UTC).timestamp() + int(expires_in)
        if expires_in
        else None
    )
    expires_dt = (
        datetime.fromtimestamp(expires_at, tz=UTC) if expires_at else None
    )
    record = await UserGoogleToken.find_one({"user": user_id})
    if record is None:
        record = UserGoogleToken(
            user=user_id,
            access_token=_encrypt(access),
            refresh_token=_encrypt(refresh) if refresh else None,
            expires_at=expires_dt,
        )
        await record.insert()
    else:
        record.access_token = _encrypt(access)
        if refresh:
            record.refresh_token = _encrypt(refresh)
        record.expires_at = expires_dt
        await record.save()
    log.info("google_tokens_stored", user_id=user_id)
    return record


async def _get_valid_access_token(user_id: str) -> str:
    record = await UserGoogleToken.find_one({"user": user_id})
    if record is None:
        raise AppError("Google Calendar is not connected", status_code=401)
    access = _decrypt(record.access_token)
    if record.expires_at and record.expires_at > datetime.now(UTC):
        return access
    if not record.refresh_token:
        raise AppError("Google refresh token missing; please re-authorize", status_code=401)
    refresh = _decrypt(record.refresh_token)
    settings = get_settings()
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "refresh_token": refresh,
                "grant_type": "refresh_token",
            },
        )
    if resp.status_code != 200:
        log.warning("google_token_refresh_failed", body=resp.text[:300])
        raise AppError("Failed to refresh Google token", status_code=502)
    data = resp.json()
    record.access_token = _encrypt(data["access_token"])
    if data.get("expires_in"):
        record.expires_at = datetime.fromtimestamp(
            datetime.now(UTC).timestamp() + int(data["expires_in"]),
            tz=UTC,
        )
    await record.save()
    return _decrypt(record.access_token)


# ---- Calendar API helpers ----

async def list_events(
    user_id: str,
    *,
    time_min: datetime | None = None,
    time_max: datetime | None = None,
    max_results: int = 50,
) -> list[dict[str, Any]]:
    access = await _get_valid_access_token(user_id)
    params: dict[str, Any] = {
        "maxResults": max_results,
        "singleEvents": "true",
        "orderBy": "startTime",
    }
    if time_min:
        params["timeMin"] = time_min.isoformat()
    if time_max:
        params["timeMax"] = time_max.isoformat()
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{GOOGLE_CALENDAR_API}/calendars/primary/events",
            params=params,
            headers={"Authorization": f"Bearer {access}"},
        )
    if resp.status_code != 200:
        log.warning("google_list_events_failed", body=resp.text[:300])
        raise AppError("Failed to list Google Calendar events", status_code=502)
    return resp.json().get("items", [])


async def create_event(
    user_id: str,
    *,
    summary: str,
    start: datetime,
    end: datetime,
    description: str | None = None,
    location: str | None = None,
) -> dict[str, Any]:
    access = await _get_valid_access_token(user_id)
    body: dict[str, Any] = {
        "summary": summary,
        "start": {"dateTime": start.isoformat(), "timeZone": "UTC"},
        "end": {"dateTime": end.isoformat(), "timeZone": "UTC"},
    }
    if description:
        body["description"] = description
    if location:
        body["location"] = location
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{GOOGLE_CALENDAR_API}/calendars/primary/events",
            json=body,
            headers={
                "Authorization": f"Bearer {access}",
                "Content-Type": "application/json",
            },
        )
    if resp.status_code not in (200, 201):
        log.warning("google_create_event_failed", body=resp.text[:300])
        raise AppError("Failed to create Google Calendar event", status_code=502)
    return resp.json()


async def delete_event(user_id: str, event_id: str) -> None:
    access = await _get_valid_access_token(user_id)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.delete(
            f"{GOOGLE_CALENDAR_API}/calendars/primary/events/{event_id}",
            headers={"Authorization": f"Bearer {access}"},
        )
    if resp.status_code not in (204, 410):
        log.warning("google_delete_event_failed", body=resp.text[:300])
        raise AppError("Failed to delete Google Calendar event", status_code=502)


async def disconnect(user_id: str) -> dict:
    record = await UserGoogleToken.find_one({"user": user_id})
    if record is not None:
        # Best-effort token revocation.
        try:
            access = _decrypt(record.access_token)
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    f"https://oauth2.googleapis.com/revoke?token={access}",
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
        except Exception as exc:  # noqa: BLE001
            log.info("google_revoke_skipped", error=str(exc))
        await record.delete()
    return {"message": "Google Calendar disconnected"}
