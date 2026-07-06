"""Tenant isolation unit tests.

Verifies the TenantContext dependency and TenantIsolationError enforcement
work without requiring live services.
"""
from __future__ import annotations

import pytest

from app.api.deps import TenantContext, enforce_tenant_filter
from app.core.errors import TenantIsolationError


@pytest.mark.asyncio
async def test_tenant_context_blocks_cross_college():
    ctx = TenantContext(
        user_id="u1",
        role="student",
        college_name="College A",
        department=None,
        college_id="C-A",
    )
    # Same tenant is fine
    enforce_tenant_filter(ctx, "College A")
    # Different tenant is blocked
    with pytest.raises(TenantIsolationError):
        enforce_tenant_filter(ctx, "College B")
    # None is allowed (resource with no stated tenant)
    enforce_tenant_filter(ctx, None)


def test_tenant_context_is_immutable():
    ctx = TenantContext(
        user_id="u1",
        role="student",
        college_name="College A",
        department=None,
        college_id="C-A",
    )
    with pytest.raises((AttributeError, TypeError)):
        ctx.college_name = "tampered"  # type: ignore[misc]