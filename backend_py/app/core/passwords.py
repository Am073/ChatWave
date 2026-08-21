"""Password validation: enforce strong passwords on register and change-password flows.

Enforces:
- Minimum length (configurable, default 8)
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character
- No common passwords
"""
from __future__ import annotations

import re

from app.core.errors import ValidationAppError

MIN_LENGTH = 8
MAX_LENGTH = 128

# Common weak passwords to reject outright.
COMMON_PASSWORDS = frozenset(
    {
        "password",
        "password1",
        "password123",
        "12345678",
        "123456789",
        "qwerty123",
        "admin123",
        "welcome1",
        "letmein1",
        "iloveyou",
        "changeme",
    }
)

_UPPER = re.compile(r"[A-Z]")
_LOWER = re.compile(r"[a-z]")
_DIGIT = re.compile(r"\d")
_SPECIAL = re.compile(r"[!@#$%^&*()\-_=+\[\]{};:'\",.<>/?\\|`~]")


def validate_password_strength(password: str) -> None:
    """Raise ValidationAppError if password does not meet strength requirements."""
    if len(password) < MIN_LENGTH:
        raise ValidationAppError(
            f"Password must be at least {MIN_LENGTH} characters long"
        )
    if len(password) > MAX_LENGTH:
        raise ValidationAppError(
            f"Password must be at most {MAX_LENGTH} characters long"
        )

    lower = password.lower()
    if lower in COMMON_PASSWORDS:
        raise ValidationAppError("Password is too common; please choose a stronger one")

    missing: list[str] = []
    if not _UPPER.search(password):
        missing.append("uppercase letter")
    if not _LOWER.search(password):
        missing.append("lowercase letter")
    if not _DIGIT.search(password):
        missing.append("digit")
    if not _SPECIAL.search(password):
        missing.append("special character")
    if missing:
        raise ValidationAppError(
            "Password must contain at least one: " + ", ".join(missing)
        )
