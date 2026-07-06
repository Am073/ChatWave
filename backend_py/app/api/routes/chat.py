"""Chat routes: full + history + clear + SSE streaming."""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Query
from sse_starlette.sse import EventSourceResponse

from app.api.deps import CSRFDep, CurrentUser, TenantContextDep
from app.schemas.chat import ChatIn
from app.services import chat_service

router = APIRouter()


@router.post("")
async def chat(
    user: CurrentUser, _: CSRFDep, ctx: TenantContextDep, payload: ChatIn
):
    return await chat_service.answer(ctx, payload)


@router.get("/history")
async def history(
    user: CurrentUser,
    ctx: TenantContextDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
):
    return await chat_service.list_history(ctx, page=page, limit=limit)


@router.delete("/history")
async def clear(user: CurrentUser, _: CSRFDep, ctx: TenantContextDep):
    return await chat_service.clear_history(ctx)


@router.get("/stream")
async def stream(user: CurrentUser, ctx: TenantContextDep, question: str = ""):
    """SSE streaming endpoint.

    Security: auth is via same-site cookies (read in dep), not query params.
    Long-lived tokens are NEVER placed in query strings (Risk #4 mitigation).
    """

    async def event_gen():
        yield {"event": "status", "data": json.dumps({"stage": "started"})}
        # FIX[9]: After agent completes, stream the answer token-by-token
        # instead of emitting a single 'final' event with the complete answer.
        result = await chat_service.answer(ctx, ChatIn(question=question))
        yield {"event": "sources", "data": json.dumps(result.get("sources", []))}

        # Stream answer in ~4-char chunks
        answer = result.get("answer", "")
        chunk_size = 4
        for i in range(0, len(answer), chunk_size):
            chunk = answer[i : i + chunk_size]
            yield {
                "event": "token",
                "data": json.dumps({"type": "token", "content": chunk}),
            }
            await asyncio.sleep(0.01)

        yield {
            "event": "final",
            "data": json.dumps(
                {
                    "answer": answer,
                    "traceId": result.get("traceId"),
                    "model": result.get("model"),
                    "confidence": result.get("confidence"),
                }
            ),
        }

    return EventSourceResponse(event_gen())