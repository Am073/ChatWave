"""Upload routes - full implementation in Phase 3."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import (
    CSRFDep,
    CurrentUser,
    TenantContextDep,
    require_faculty_or_admin,
)
from app.models.user import User

router = APIRouter()

FacultyOrAdmin = Annotated[User, Depends(require_faculty_or_admin)]


@router.post("", status_code=202)
async def upload(
    user: FacultyOrAdmin,
    _: CSRFDep,
    ctx: TenantContextDep,
    file: UploadFile = File(...),  # noqa: B008
    scope: str = Form("college_wide"),  # noqa: B008
    department: str | None = Form(None),  # noqa: B008
):
    from app.services.upload_service import enqueue_upload

    return await enqueue_upload(ctx, file, scope, department)


@router.get("")
async def list_documents(user: CurrentUser, ctx: TenantContextDep):
    from app.services.upload_service import list_documents as _list

    return await _list(ctx)


@router.get("/{document_id}/status")
async def document_status(
    user: CurrentUser, ctx: TenantContextDep, document_id: str
):
    from app.services.upload_service import get_status

    return await get_status(ctx, document_id)


@router.delete("/{document_id}")
async def delete_document(
    user: CurrentUser, _: CSRFDep, ctx: TenantContextDep, document_id: str
):
    from app.services.upload_service import remove

    return await remove(ctx, user, document_id)