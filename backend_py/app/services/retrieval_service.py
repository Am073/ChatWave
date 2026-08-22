"""Retrieval service: tenant + department-filtered vector search.

Qdrant stores one collection per tenant (Decision #5). Department filtering
is enforced as a metadata filter. The retriever returns source nodes with
score, text, documentId, chunkIndex, and page metadata.
"""
from __future__ import annotations

import re
from typing import Any

from qdrant_client.models import FieldCondition, Filter, MatchAny, MatchValue

from app.api.deps import TenantContext
from app.core.config import get_settings
from app.core.db import get_qdrant_client
from app.core.logging import get_logger
from app.observability.tracing import get_tracer, timed
from app.services.ingestion_service import embed_texts
from app.services.upload_service import collection_name

log = get_logger(__name__)
_settings = get_settings()

_STOP_WORDS = frozenset({
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "shall",
    "should", "may", "might", "must", "can", "could", "am", "in", "on",
    "at", "to", "for", "of", "with", "by", "from", "as", "into", "about",
    "that", "this", "these", "those", "it", "its", "and", "or", "but",
    "not", "no", "if", "so", "what", "when", "where", "how", "who", "which",
    "all", "any", "my", "your", "our", "their", "his", "her", "me", "we",
    "they", "you", "i", "up", "out", "just", "than", "then", "very",
})


def _extract_keywords(query: str) -> list[str]:
    """Extract significant words from a query for keyword filtering."""
    words = re.findall(r"[a-zA-Z]{3,}", query.lower())
    return [w for w in words if w not in _STOP_WORDS]


def build_tenant_filter(
    ctx: TenantContext, include_department: bool = True
) -> Filter:
    """Construct the Qdrant payload filter for a tenant-scoped search.

    Exposed so unit tests can assert that admin and non-admin users produce
    different filter shapes (defends against accidental tenant-isolation
    regressions).
    """
    conditions: list[FieldCondition] = [
        FieldCondition(key="collegeName", match=MatchValue(value=ctx.college_name)),
    ]
    if include_department and ctx.role != "admin":
        # College-wide documents (department="college_wide") must stay visible
        # to every tenant member; own-department docs additionally match.
        dept_values = sorted({ctx.department or "college_wide", "college_wide"})
        conditions.append(
            FieldCondition(key="department", match=MatchAny(any=dept_values))
        )
    return Filter(must=conditions)


async def retrieve(
    ctx: TenantContext,
    query: str,
    top_k: int | None = None,
    include_department: bool = True,
) -> list[dict[str, Any]]:
    """Top-k tenant-scoped vector search.

    Filters:
    - Hard tenant filter on collection name (cw_{slug}) + payload collegeName.
    - Department filter: own department OR college_wide unless admin (always
      sees college_wide in their tenant).
    """
    tracer = get_tracer()
    k = top_k or _settings.retrieval_top_k
    coll = collection_name(ctx.college_name)
    with timed("retrieval") as latency:
        try:
            [query_vec] = await embed_texts([query])
        except Exception as exc:  # noqa: BLE001
            log.error("query_embed_failed", error=str(exc))
            return []

        query_filter = build_tenant_filter(ctx, include_department=include_department)

        # Note: no keyword `should` clauses here. In Qdrant, `should` is
        # mandatory (>=1 must match), which silently excluded chunks not
        # containing literal query keywords and destroyed recall. Pure dense
        # vector search handles relevance ranking.
        client = get_qdrant_client()
        try:
            # qdrant-client >= 2.0 replaced .search() with .query_points().
            response = await client.query_points(
                collection_name=coll,
                query=query_vec,
                limit=k,
                with_payload=True,
                query_filter=query_filter,
            )
            results = response.points
        except Exception as exc:  # noqa: BLE001
            log.warning("qdrant_search_failed", error=str(exc))
            return []
    if tracer is not None:
        tracer.log_event(
            "retrieval",
            metadata={
                "tenant": ctx.college_name,
                "k": k,
                "latency_ms": round(latency["latency_ms"], 2),
                "hits": len(results),
            },
        )
    sources: list[dict[str, Any]] = []
    for hit in results:
        payload = hit.payload or {}
        sources.append(
            {
                "documentId": payload.get("documentId"),
                "chunkIndex": payload.get("chunkIndex", 0),
                "title": payload.get("filename"),
                "page": payload.get("page"),
                "score": float(hit.score or 0.0),
                "text": (payload.get("text") or "")[:600],
            }
        )
    return sources