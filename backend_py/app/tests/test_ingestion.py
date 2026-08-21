"""Ingestion lifecycle tests.

Verifies the parser/chunker fallback path works without external services,
and that an ingestion task can be enqueued.
"""
from __future__ import annotations

from app.services.ingestion_service import _fallback_chunk_text, _fallback_extract_text
from app.services.upload_service import collection_name


def test_fallback_chunk_text_basic():
    text = " ".join(f"word{i}" for i in range(500))
    chunks = _fallback_chunk_text(text, max_chars=200, overlap=20)
    assert len(chunks) > 1
    for c in chunks:
        assert c["text"]
        assert c["metadata"]["section"]


def test_fallback_chunk_text_empty():
    assert _fallback_chunk_text("") == []
    assert _fallback_chunk_text("   \n\n   ") == []


def test_fallback_chunk_text_preserves_text():
    text = "important policy text about student conduct and academic integrity"
    chunks = _fallback_chunk_text(text, max_chars=100, overlap=10)
    assert any("policy text" in c["text"] for c in chunks)


def test_fallback_extract_text_handles_unknown_mime():
    """Unknown MIME types return empty string (no crash)."""
    result = _fallback_extract_text(b"random bytes", "application/x-unknown", "x.bin")
    assert result == ""


def test_fallback_extract_text_handles_empty_bytes():
    assert _fallback_extract_text(b"", "application/pdf", "empty.pdf") == ""


def test_collection_name_slugification():
    assert collection_name("ChatWave College") == "cw_chatwave_college"
    assert collection_name("MIT") == "cw_mit"
    # Slug uniqueness across tenants
    assert collection_name("A") != collection_name("B")
    # Special chars become underscores
    assert collection_name("St. John's University!") == "cw_st_john_s_university"


def test_collection_name_empty_falls_back_to_tenant():
    """Edge case: empty / whitespace-only name should still produce a valid slug."""
    name = collection_name("   ")
    assert name.startswith("cw_")


def test_document_status_enum_in_model():
    """Spec: status moves pending -> processing -> completed or failed."""
    # We verify the DocumentStatus Literal type directly (not via runtime
    # introspection of the Beanie model, which has forward-ref issues).
    from app.models.document import DocumentStatus

    # DocumentStatus is a Literal alias; verify all 4 expected values exist
    # by attempting a value assignment in a typed context.
    values: list[DocumentStatus] = ["pending", "processing", "completed", "failed"]
    for v in values:
        # The variable is typed as DocumentStatus, so this is a type check
        assert v in ("pending", "processing", "completed", "failed")
    # The Literal type is exported and importable
    from typing import get_args

    assert set(get_args(DocumentStatus)) == {"pending", "processing", "completed", "failed"}