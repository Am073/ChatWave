"""Upload service: validate, persist, enqueue ingestion, list/status/delete.

This module owns the document lifecycle on the API side (persistence,
validation, tenant scoping). The heavy lifting (parsing, chunking, embedding,
indexing) lives in app.services.ingestion_service and
app.workers.ingestion_tasks.
"""
from __future__ import annotations

import re

from fastapi import UploadFile

from app.api.deps import TenantContext
from app.core.config import get_settings
from app.core.errors import AppError, NotFoundError
from app.core.logging import get_logger
from app.models.document import DocumentRecord, document_out
from app.models.user import User
from app.observability.tracing import get_tracer
from app.workers.celery_app import enqueue_ingestion

log = get_logger(__name__)
_settings = get_settings()
_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    slug = _SLUG_RE.sub("_", name.lower()).strip("_")
    return slug or "tenant"


def collection_name(college_name: str) -> str:
    """Qdrant collection name (preserves v1 cw_{college_slug} pattern)."""
    return f"{_settings.qdrant_collection_prefix}{_slugify(college_name)}"


def validate_upload(file: UploadFile) -> None:
    if file.content_type and file.content_type not in _settings.allowed_mime_types:
        raise AppError(
            f"Unsupported file type: {file.content_type}", status_code=400
        )
    if not file.filename:
        raise AppError("File must have a filename", status_code=400)


async def enqueue_upload(
    ctx: TenantContext,
    file: UploadFile,
    scope: str,
    department: str | None,
) -> dict:
    validate_upload(file)
    # Read once into memory (kept under the configured limit).
    contents = await file.read()
    if len(contents) > _settings.max_upload_mb * 1024 * 1024:
        raise AppError(
            f"File exceeds maximum size of {_settings.max_upload_mb}MB",
            status_code=413,
        )

    target_dept = department
    if scope == "college_wide":
        target_dept = None
    elif not target_dept:
        target_dept = ctx.department

    doc = DocumentRecord(
        uploader=ctx.user_id,
        college_name=ctx.college_name,
        department=target_dept,
        filename=file.filename or "upload.bin",
        file_type=file.content_type or "application/octet-stream",
        size_bytes=len(contents),
        status="pending",
    )
    await doc.insert()

    import tempfile

    with tempfile.NamedTemporaryFile(  # noqa: SIM115
        delete=False, suffix=f"_{doc.filename}"
    ) as tmp:
        tmp.write(contents)
        tmp.flush()
        tmp_path = tmp.name

    # Enqueue Celery ingestion (lazy import keeps API bootable if Celery
    # broker is down — the task will simply fail and be retried).
    try:
        task = enqueue_ingestion(
            document_id=str(doc.id),
            file_path=tmp_path,
            college_name=ctx.college_name,
            department=target_dept,
            mime_type=doc.file_type,
            filename=doc.filename,
        )
        log.info(
            "ingestion_enqueued",
            document_id=str(doc.id),
            task_id=getattr(task, "id", None),
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("ingestion_enqueue_failed", error=str(exc), document_id=str(doc.id))
        # Document remains in 'pending'; operator can retry once broker is back.

    tracer = get_tracer()
    if tracer is not None:
        tracer.log_event(
            "upload_accepted",
            metadata={
                "document_id": str(doc.id),
                "filename": doc.filename,
                "size_bytes": doc.size_bytes,
                "college_name": ctx.college_name,
            },
        )

    return {"documentId": str(doc.id), "status": doc.status}


async def list_documents(ctx: TenantContext) -> list[dict]:
    docs = await DocumentRecord.find({"college_name": ctx.college_name}).to_list(200)
    return [document_out(d).model_dump(by_alias=True) for d in docs]


async def get_status(ctx: TenantContext, document_id: str) -> dict:
    doc = await _owned_doc(ctx, document_id)
    return {
        "id": str(doc.id),
        "status": doc.status,
        "chunk_count": doc.chunk_count,
        "error_message": doc.error_message,
        "embedding_model": doc.embedding_model,
    }


async def remove(ctx: TenantContext, user: User, document_id: str) -> dict:
    doc = await _owned_doc(ctx, document_id)
    if doc.uploader != ctx.user_id and user.role != "admin":
        raise AppError("Only the uploader or admin may delete this document", status_code=403)
    # Delete vectors from Qdrant first.
    try:
        from app.services.ingestion_service import delete_vectors

        await delete_vectors(ctx.college_name, doc.qdrant_ids)
    except Exception as exc:  # noqa: BLE001
        log.warning("qdrant_delete_failed", error=str(exc), document_id=str(doc.id))
    await doc.delete()
    return {"message": "Document deleted"}


async def remove_document(
    *, college_name: str, document_id: str, user_id: str
) -> dict:
    """Admin-scoped delete: tenant-scoped, no ownership check."""
    doc = await DocumentRecord.get(document_id)
    if doc is None or doc.college_name != college_name:
        raise NotFoundError("Document not found")
    try:
        from app.services.ingestion_service import delete_vectors

        await delete_vectors(college_name, doc.qdrant_ids)
    except Exception as exc:  # noqa: BLE001
        log.warning("qdrant_delete_failed", error=str(exc), document_id=str(doc.id))
    await doc.delete()
    log.info(
        "admin_document_deleted", document_id=str(doc.id), by_user=user_id
    )
    return {"message": "Document deleted"}


async def retry_document(doc: DocumentRecord) -> dict:
    """Re-enqueue a failed/pending document. Caller must have already validated tenant scope."""
    import tempfile
    from datetime import UTC, datetime

    from app.core.config import get_settings
    from app.workers.celery_app import enqueue_ingestion

    settings = get_settings()
    doc.status = "pending"
    doc.error_message = None
    doc.updated_at = datetime.now(UTC)
    await doc.save()

    # We do not have the original file on disk (it was deleted after ingestion),
    # so the retry will fail unless the file is re-uploaded. In a cloud setup
    # this would re-pull from object storage; here we just mark it pending and
    # surface a clear message to the operator.
    log.info(
        "document_retry_requested",
        document_id=str(doc.id),
        note="file_not_in_storage; re-upload required",
    )
    return {
        "documentId": str(doc.id),
        "status": doc.status,
        "message": "Document reset to pending. Please re-upload the file.",
    }


async def _owned_doc(ctx: TenantContext, document_id: str) -> DocumentRecord:
    doc = await DocumentRecord.get(document_id)
    if doc is None or doc.college_name != ctx.college_name:
        raise NotFoundError("Document not found")
    return doc