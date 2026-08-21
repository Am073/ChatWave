"""Celery application + enqueue helper for ingestion tasks.

Runs detached from the API: keeps long-running parsing/embedding outside the
request handlers. Broker = Redis. JSON serialization for cross-worker safety.
"""
from __future__ import annotations

from celery import Celery

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)
_settings = get_settings()

celery_app = Celery(
    "chatwave",
    broker=_settings.effective_broker_url,
    backend=_settings.effective_result_backend,
    include=["app.workers.ingestion_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,
    task_default_retry_delay=10,
    task_default_max_retries=3,
    broker_connection_retry_on_startup=True,
)


def enqueue_ingestion(
    document_id: str,
    file_path: str,
    college_name: str,
    department: str | None,
    mime_type: str,
    filename: str,
):
    from app.workers.ingestion_tasks import ingest_document

    return ingest_document.apply_async(
        kwargs={
            "document_id": document_id,
            "file_path": file_path,
            "college_name": college_name,
            "department": department,
            "mime_type": mime_type,
            "filename": filename,
        }
    )