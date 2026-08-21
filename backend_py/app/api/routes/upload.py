"""Upload routes."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import (
    CSRFDep,
    CurrentUser,
    TenantContextDep,
    require_faculty_or_admin,
)
from app.core.errors import NotFoundError
from app.models.document import DocumentRecord
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


@router.post("/{document_id}/retry")
async def retry_document(
    user: CurrentUser, _: CSRFDep, ctx: TenantContextDep, document_id: str
):
    """Re-enqueue a failed or pending document for ingestion.

    The uploader or an admin can trigger the retry. Since the original file
    is no longer on disk (temp files are deleted after ingestion), this
    resets the document to 'pending' and asks the caller to re-upload.
    """
    doc = await DocumentRecord.get(document_id)
    if doc is None or doc.college_name != ctx.college_name:
        raise NotFoundError("Document not found")
    if doc.uploader != ctx.user_id and user.role != "admin":
        from app.core.errors import ForbiddenError

        raise ForbiddenError("Only the uploader or admin may retry this document")
    from app.services.upload_service import retry_document

    return await retry_document(doc)