"""Ingestion Celery task: parse → chunk → embed → upsert to Qdrant.

Idempotency: a document's status drives re-runs (set to 'failed' with error
message, can be re-enqueued via admin endpoint).
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.core.logging import get_logger
from app.models.document import DocumentRecord
from app.observability.tracing import get_tracer
from app.services.ingestion_service import (
    embed_texts,
    parse_to_chunks,
    upsert_chunks,
)
from app.workers.celery_app import celery_app

log = get_logger(__name__)


@celery_app.task(
    name="app.workers.ingestion_tasks.ingest_document",
    bind=True,
    max_retries=3,
    default_retry_delay=15,
)
def ingest_document(
    self,
    document_id: str,
    file_path: str,
    college_name: str,
    department: str | None,
    mime_type: str,
    filename: str,
) -> dict[str, Any]:
    """Parse + chunk + embed + index a single document for one tenant.

    On retryable failures, raises so Celery schedules a retry. The stored
    file is NEVER deleted here — its lifecycle (retry, delete) is owned by
    upload_service via DocumentRecord.storage_path.
    """
    import asyncio

    try:
        return asyncio.run(
            _run_ingestion(
                document_id, file_path, college_name, department, mime_type, filename
            )
        )
    except Exception as exc:  # noqa: BLE001
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            log.error(
                "ingest_retries_exhausted",
                document_id=document_id,
                error=str(exc),
            )
            raise


async def _run_ingestion(
    document_id: str,
    file_path: str,
    college_name: str,
    department: str | None,
    mime_type: str,
    filename: str,
) -> dict[str, Any]:
    tracer = get_tracer()
    doc = await DocumentRecord.get(document_id)
    if doc is None:
        log.warning("ingest_doc_missing", document_id=document_id)
        return {"ok": False, "reason": "doc_missing"}
    if doc.college_name != college_name:
        log.error(
            "ingest_tenant_mismatch",
            document_id=document_id,
            doc_tenant=doc.college_name,
            claimed=college_name,
        )
        return {"ok": False, "reason": "tenant_mismatch"}

    doc.status = "processing"
    doc.updated_at = datetime.now(UTC)
    await doc.save()

    import anyio

    file_bytes = await anyio.Path(file_path).read_bytes()

    chunks = await parse_to_chunks(
        file_bytes=file_bytes, mime_type=mime_type, filename=filename
    )
    if not chunks:
        raise ValueError("No text content extracted from document")

    texts = [c["text"] for c in chunks]
    embeddings = await embed_texts(texts)
    qdrant_ids = await upsert_chunks(
        college_name=college_name,
        document_id=document_id,
        department=department,
        chunks=chunks,
        embeddings=embeddings,
        filename=filename,
    )
    doc.chunk_count = len(chunks)
    doc.qdrant_ids = qdrant_ids
    doc.status = "completed"
    doc.error_message = None
    doc.updated_at = datetime.now(UTC)
    await doc.save()
    if tracer is not None:
        tracer.log_event(
            "ingestion_completed",
            metadata={
                "document_id": document_id,
                "chunk_count": len(chunks),
                "tenant": college_name,
            },
        )
    log.info("ingest_completed", document_id=document_id, chunks=len(chunks))
    # Stored file is kept on purpose: enables admin/user retry and re-ingestion.
    return {"ok": True, "chunk_count": len(chunks), "qdrant_ids": len(qdrant_ids)}
