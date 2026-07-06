"""Chat service: end-to-end RAG + agent orchestration + ChatLog persistence.

Layered:
1. Build AgentState from request + tenant context.
2. Run LangGraph graph.
3. Persist ChatLog with trace id, sources, model, prompt version.
4. Return API-shaped response.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from app.agents.graph import run_agent
from app.agents.state import AgentState
from app.api.deps import TenantContext
from app.core.logging import get_logger
from app.models.chat_log import ChatLog
from app.observability.tracing import get_tracer, new_trace_id
from app.schemas.chat import ChatIn

log = get_logger(__name__)


async def answer(ctx: TenantContext, payload: ChatIn) -> dict:
    tracer = get_tracer()
    trace_id = new_trace_id()
    session_id = payload.sessionId or uuid.uuid4().hex
    state = AgentState(
        user_id=ctx.user_id,
        role=ctx.role,  # type: ignore[arg-type]
        college_name=ctx.college_name,
        department=ctx.department,
        question=payload.question,
        session_id=session_id,
        prompt_version="v2.0",
        trace_id=trace_id,
    )
    final = await run_agent(state)
    # Persist ChatLog
    log_doc = ChatLog(
        user=ctx.user_id,
        college_name=ctx.college_name,
        question=final.question,
        answer=final.answer,
        sources=final.sources,
        session_id=session_id,
        model="gemini/gemini-2.0-flash",
        prompt_version=final.prompt_version,
        trace_id=trace_id,
        confidence=final.confidence,
        quality_scores={},
        agent_steps=final.agent_steps,
        tokens_used=0,
        created_at=datetime.now(UTC),
    )
    try:
        await log_doc.insert()
    except Exception as exc:  # noqa: BLE001
        log.warning("chatlog_insert_failed", error=str(exc))
    if tracer is not None:
        tracer.log_event(
            "chat_completed",
            metadata={
                "trace_id": trace_id,
                "tenant": ctx.college_name,
                "confidence": final.confidence,
                "tool_calls": len(final.tool_calls),
            },
        )
    return {
        "answer": final.answer,
        "sources": final.sources,
        "sessionId": session_id,
        "traceId": trace_id,
        "model": "gemini/gemini-2.0-flash",
        "confidence": final.confidence,
    }


async def list_history(ctx: TenantContext, page: int = 1, limit: int = 20) -> dict:
    docs = (
        await ChatLog.find({"user": ctx.user_id, "college_name": ctx.college_name})
        .sort("-created_at")
        .skip((page - 1) * limit)
        .limit(limit)
        .to_list(limit)
    )
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
    }


async def clear_history(ctx: TenantContext) -> dict:
    await ChatLog.find(
        {"user": ctx.user_id, "college_name": ctx.college_name}
    ).delete()
    return {"message": "Chat history cleared"}