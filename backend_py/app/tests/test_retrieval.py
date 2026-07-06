"""Retrieval tests — exercise filter construction without a live DB."""
from __future__ import annotations

from qdrant_client.models import Filter

from app.api.deps import TenantContext
from app.services.retrieval_service import build_tenant_filter
from app.services.upload_service import collection_name


def _ctx(role: str, dept: str | None = None, college: str = "College A") -> TenantContext:
    return TenantContext(
        user_id="u1",
        role=role,
        college_name=college,
        department=dept,
        college_id="A",
    )


def test_collection_name_isolation():
    assert collection_name("ChatWave College") == "cw_chatwave_college"
    assert collection_name("MIT") == "cw_mit"
    assert collection_name("A") != collection_name("B")


def test_tenant_context_carries_college_and_role():
    ctx = _ctx("faculty", dept="CS", college="MIT")
    assert ctx.college_name == "MIT"
    assert ctx.department == "CS"
    assert ctx.role == "faculty"


def test_filter_for_student_contains_tenant_and_department():
    ctx = _ctx("student", dept="CS", college="ChatWave College")
    f = build_tenant_filter(ctx)
    assert isinstance(f, Filter)
    keys = sorted(c.key for c in f.must or [])
    assert keys == ["collegeName", "department"]
    dept_value = next(
        c.match.value for c in f.must or [] if c.key == "department"  # type: ignore[union-attr]
    )
    assert dept_value == "CS"


def test_filter_for_admin_omits_department_filter():
    ctx = _ctx("admin", dept=None, college="ChatWave College")
    f = build_tenant_filter(ctx)
    keys = [c.key for c in f.must or []]
    assert keys == ["collegeName"]


def test_filter_for_student_without_department_falls_back_to_college_wide():
    ctx = _ctx("student", dept=None, college="ChatWave College")
    f = build_tenant_filter(ctx)
    dept_value = next(
        c.match.value for c in f.must or [] if c.key == "department"  # type: ignore[union-attr]
    )
    assert dept_value == "college_wide"


def test_include_department_false_skips_department_filter():
    ctx = _ctx("student", dept="CS")
    f = build_tenant_filter(ctx, include_department=False)
    keys = [c.key for c in f.must or []]
    assert keys == ["collegeName"]