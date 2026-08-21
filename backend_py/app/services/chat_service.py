"""Chat service: end-to-end RAG + agent orchestration + ChatLog persistence.

Layered:
1. Build AgentState from request + tenant context.
2. Run LangGraph graph.
3. Persist ChatLog with trace id, sources, model, prompt version.
4. Return API-shaped response.
"""
from __future__ import annotations

import asyncio
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

from app.agents.graph import run_agent
from app.agents.state import AgentState
from app.api.deps import TenantContext
from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.chat_log import ChatLog
from app.observability.metrics import CHATLOG_INSERT_FAILURES
from app.observability.tracing import get_tracer, new_trace_id
from app.schemas.chat import ChatIn

log = get_logger(__name__)


def resolve_model(model_override: str | None) -> str:
    """Pick the chat model: explicit override > in-memory override > settings default."""
    if model_override:
        return model_override
    # Allow runtime override (set via admin endpoint).
    from app.services.model_registry import get_active_chat_model

    return get_active_chat_model() or get_settings().chat_model


async def _finalize(
    ctx: TenantContext,
    final: AgentState,
    chat_model: str,
    session_id: str,
    trace_id: str,
) -> dict:
    """Persist the ChatLog, emit tracing, extract dates, shape the API response."""
    tracer = get_tracer()
    try:
        log_doc = ChatLog(
            user=ctx.user_id,
            college_name=ctx.college_name,
            question=final.question,
            answer=final.answer,
            sources=final.sources,
            session_id=session_id,
            model=chat_model,
            prompt_version=final.prompt_version,
            trace_id=trace_id,
            confidence=final.confidence,
            quality_scores={},
            agent_steps=final.agent_steps,
            tokens_used=0,
            created_at=datetime.now(UTC),
        )
        await log_doc.insert()
    except Exception as exc:  # noqa: BLE001
        # Logged at error level + a counter so operators see the failure rate
        # rather than silent data loss when Mongo is down.
        log.error("chatlog_insert_failed", error=str(exc), trace_id=trace_id)
        if CHATLOG_INSERT_FAILURES is not None:
            CHATLOG_INSERT_FAILURES.labels(tenant=ctx.college_name).inc()
    if tracer is not None:
        tracer.log_event(
            "chat_completed",
            metadata={
                "trace_id": trace_id,
                "tenant": ctx.college_name,
                "confidence": final.confidence,
                "tool_calls": len(final.tool_calls),
                "model": chat_model,
            },
        )
    # Detect calendar-worthy dates in the answer + source snippets so the
    # UI can offer a one-click "Add to Calendar" affordance.
    from app.services.date_extractor import merge_date_sources

    blobs: list[str] = [final.answer or ""]
    for s in final.sources or []:
        text = s.get("text") if isinstance(s, dict) else None
        if text:
            blobs.append(text)
    detected = merge_date_sources(*blobs)
    return {
        "answer": final.answer,
        "sources": final.sources,
        "sessionId": session_id,
        "traceId": trace_id,
        "model": chat_model,
        "confidence": final.confidence,
        "detectedDates": [d.to_dict() for d in detected],
    }


async def answer(ctx: TenantContext, payload: ChatIn) -> dict:
    trace_id = new_trace_id()
    session_id = payload.sessionId or uuid.uuid4().hex
    chat_model = resolve_model(payload.model)
    state = AgentState(
        user_id=ctx.user_id,
        role=ctx.role,  # type: ignore[arg-type]
        college_name=ctx.college_name,
        department=ctx.department,
        question=payload.question,
        session_id=session_id,
        prompt_version="v2.0",
        trace_id=trace_id,
        mode=payload.mode or "college",
    )
    final = await run_agent(state, model_override=chat_model)
    return await _finalize(ctx, final, chat_model, session_id, trace_id)


_DONE = object()  # sentinel: agent run finished


async def answer_stream(
    ctx: TenantContext, payload: ChatIn
) -> AsyncIterator[dict[str, Any]]:
    """Run the agent and yield tagged events as they happen.

    Yields: {"event": "status"|"sources"|"token"|"final", "data": dict}.
    Real LLM tokens are forwarded as they arrive (no post-hoc chunking).
    If the consumer stops early (client disconnect / cancel), the underlying
    agent task is cancelled, which aborts the in-flight LLM call.
    """
    trace_id = new_trace_id()
    session_id = payload.sessionId or uuid.uuid4().hex
    chat_model = resolve_model(payload.model)
    queue: asyncio.Queue = asyncio.Queue()
    state = AgentState(
        user_id=ctx.user_id,
        role=ctx.role,  # type: ignore[arg-type]
        college_name=ctx.college_name,
        department=ctx.department,
        question=payload.question,
        session_id=session_id,
        prompt_version="v2.0",
        trace_id=trace_id,
        mode=payload.mode or "college",
        token_queue=queue,
    )

    async def _run() -> AgentState:
        try:
            return await run_agent(state, model_override=chat_model)
        finally:
            queue.put_nowait(_DONE)

    task = asyncio.create_task(_run())
    try:
        yield {"event": "status", "data": {"stage": "started"}}
        while True:
            item = await queue.get()
            if item is _DONE:
                break
            if isinstance(item, str):
                yield {"event": "token", "data": {"type": "token", "content": item}}
            else:
                yield {"event": "status", "data": {"stage": "answered"}}
                yield {"event": "sources", "data": item["sources"]}
        final = await task
        result = await _finalize(ctx, final, chat_model, session_id, trace_id)
        yield {
            "event": "final",
            "data": {
                "type": "final",
                "answer": result["answer"],
                "traceId": result["traceId"],
                "model": result["model"],
                "confidence": result["confidence"],
                "sessionId": session_id,
                "detectedDates": result["detectedDates"],
            },
        }
    finally:
        if not task.done():
            task.cancel()


async def list_history(
    ctx: TenantContext,
    page: int = 1,
    limit: int = 20,
    before: datetime | None = None,
) -> dict:
    """Paginate the user's chat history.

    Two modes:
    - `page` + `limit` (legacy): skip-based pagination.
    - `before` (cursor): only return logs strictly older than this timestamp.
      Preferred for infinite scroll — no offset drift on new writes.
    Returns `{logs, has_more, next_cursor, page, limit}`.
    """
    query: dict = {"user": ctx.user_id, "college_name": ctx.college_name}
    if before is not None:
        query["created_at"] = {"$lt": before}
        docs = (
            await ChatLog.find(query).sort("-created_at").limit(limit + 1).to_list(limit + 1)
        )
        has_more = len(docs) > limit
        if has_more:
            docs = docs[:limit]
    else:
        docs = (
            await ChatLog.find(query)
            .sort("-created_at")
            .skip((page - 1) * limit)
            .limit(limit + 1)
            .to_list(limit + 1)
        )
        has_more = len(docs) > limit
        if has_more:
            docs = docs[:limit]
    next_cursor = docs[-1].created_at.isoformat() if (docs and has_more) else None
    return {
        "logs": [
            {
                "id": str(d.id),
                "question": d.question,
                "answer": d.answer,
                "sources": d.sources,
                "session_id": d.session_id,
                "trace_id": d.trace_id,
                "confidence": d.confidence,
                "created_at": d.created_at,
            }
            for d in docs
        ],
        "page": page,
        "limit": limit,
        "has_more": has_more,
        "next_cursor": next_cursor,
    }


async def clear_history(ctx: TenantContext) -> dict:
    await ChatLog.find(
        {"user": ctx.user_id, "college_name": ctx.college_name}
    ).delete()
    return {"message": "Chat history cleared"}