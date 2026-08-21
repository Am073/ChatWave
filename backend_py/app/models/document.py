"""Document record model + ingestion lifecycle status."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from beanie import Document, Indexed
from pydantic import BaseModel, Field

DocumentStatus = Literal["pending", "processing", "completed", "failed"]


class DocumentRecord(Document):
    uploader: Indexed(str)  # User id
    college_name: Indexed(str)  # tenant key
    department: str | None = None
    filename: str
    file_type: str  # MIME
    size_bytes: int = 0
    status: DocumentStatus = "pending"
    chunk_count: int = 0
    qdrant_ids: list[str] = Field(default_factory=list)
    embedding_model: str | None = None
    error_message: str | None = None
    # Local path of the stored upload bytes; enables retry without re-upload.
    storage_path: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "documents"
        indexes = ["college_name", "uploader", "status"]


class DocumentOut(BaseModel):
    id: str = Field(alias="_id")
    uploader: str
    college_name: str
    department: str | None
    filename: str
    file_type: str
    size_bytes: int
    status: DocumentStatus
    chunk_count: int
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"populate_by_name": True}


def document_out(doc: DocumentRecord) -> DocumentOut:
    return DocumentOut(
        _id=str(doc.id),
        uploader=doc.uploader,
        college_name=doc.college_name,
        department=doc.department,
        filename=doc.filename,
        file_type=doc.file_type,
        size_bytes=doc.size_bytes,
        status=doc.status,
        chunk_count=doc.chunk_count,
        error_message=doc.error_message,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )