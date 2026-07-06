"""Role + tenant aware access policy for retrieval/tools.

Spec: role-based access must apply to both API endpoints and agent tools.
This module centralizes the policy so any service or tool that touches
tenant data uses a single, auditable check.
"""
from __future__ import annotations

from app.api.deps import TenantContext
from app.core.errors import ForbiddenError, TenantIsolationError


def assert_same_tenant(ctx: TenantContext, target_college: str | None) -> None:
    if target_college is None:
        return
    if target_college != ctx.college_name:
        raise TenantIsolationError(
            "Cross-tenant access attempted and was blocked."
        )


def assert_role_at_least(ctx: TenantContext, *allowed: str) -> None:
    if ctx.role not in allowed:
        raise ForbiddenError(
            f"Role '{ctx.role}' is not in the allowed set {allowed}."
        )


def can_view_admin_data(ctx: TenantContext) -> bool:
    return ctx.role == "admin"