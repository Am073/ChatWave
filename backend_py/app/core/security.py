"""Security primitives: password hashing, JWT access/refresh tokens, CSRF token.

Preserves the v1 cookie-based strategy:
- access_token (15m, HttpOnly) + refresh_token (7d, HttpOnly)
- refresh_token_hash stored (bcrypt) on the user document
- double-submit csrf_token cookie (readable by JS)
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

_settings = get_settings()
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd_context.verify(plain, hashed)
    except Exception:
        return False


def _create_token(payload: dict[str, Any], secret: str, expires_delta: timedelta) -> str:
    to_encode = {**payload, "exp": datetime.now(UTC) + expires_delta}
    return jwt.encode(to_encode, secret, algorithm="HS256")


def create_access_token(
    user_id: str,
    role: str,
    college_name: str,
    department: str | None,
    college_id: str,
) -> str:
    payload = {
        "sub": user_id,
        "userId": user_id,
        "role": role,
        "college_name": college_name,
        "department": department,
        "college_id": college_id,
        "type": "access",
    }
    return _create_token(
        payload,
        _settings.jwt_secret,
        timedelta(minutes=_settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "userId": user_id, "type": "refresh"},
        _settings.jwt_refresh_secret,
        timedelta(days=_settings.refresh_token_expire_days),
    )


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, _settings.jwt_secret, algorithms=["HS256"])


def decode_refresh_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, _settings.jwt_refresh_secret, algorithms=["HS256"])


def verify_access_token(token: str) -> dict[str, Any] | None:
    try:
        return decode_access_token(token)
    except JWTError:
        return None


def verify_refresh_token(token: str) -> dict[str, Any] | None:
    try:
        return decode_refresh_token(token)
    except JWTError:
        return None


# ---- CSRF (double-submit cookie) ----

def generate_csrf_token() -> str:
    """Random signed token: prevents prediction. HMAC over random bytes."""
    nonce = secrets.token_urlsafe(32)
    sig = hmac.new(
        _settings.csrf_secret.encode(), nonce.encode(), hashlib.sha256
    ).hexdigest()
    return f"{nonce}.{sig}"


def verify_csrf_token(cookie_token: str, header_token: str) -> bool:
    if not cookie_token or not header_token:
        return False
    if not hmac.compare_digest(cookie_token, header_token):
        return False
    try:
        nonce, sig = cookie_token.split(".", 1)
    except ValueError:
        return False
    expected = hmac.new(
        _settings.csrf_secret.encode(), nonce.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(sig, expected)