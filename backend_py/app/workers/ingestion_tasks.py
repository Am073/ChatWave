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
    file_path: str,  # FIX[3]: Receive file path instead of raw bytes
    college_name: str,
    department: str | None,
    mime_type: str,
    filename: str,
) -> dict[str, Any]:
    """Parse + chunk + embed + index a single document for one tenant."""
    import asyncio

    return asyncio.run(
        _run_ingestion(
            document_id, file_path, college_name, department, mime_type, filename
        )
    )


async def _run_ingestion(
    document_id: str,
    file_path: str,  # FIX[3]: Receive file path instead of raw bytes
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

    try:
        # FIX[3]: Read file bytes from temp file on disk
        import os

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
        log.info(
            "ingest_completed", document_id=document_id, chunks=len(chunks)
        )
        return {"ok": True, "chunk_count": len(chunks), "qdrant_ids": len(qdrant_ids)}

    except Exception as exc:  # noqa: BLE001
        doc.status = "failed"
        doc.error_message = str(exc)[:1000]
        doc.updated_at = datetime.now(UTC)
        await doc.save()
        log.exception("ingest_failed", document_id=document_id)
        if tracer is not None:
            tracer.log_event(
                "ingestion_failed",
                metadata={"document_id": document_id, "error": str(exc)},
                level="ERROR",
            )
        # Celery retry is invoked from the bound task wrapper; the async
        # runner returns a failure dict when retries are exhausted.
        return {"ok": False, "reason": "ingestion_exception", "error": str(exc)}
    finally:
        # FIX[3]: Clean up the temp file after ingestion completes or fails
        import contextlib
        import os

        with contextlib.suppress(OSError):
            os.unlink(file_path)