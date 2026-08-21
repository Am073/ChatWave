"""Chat routes: HTTP answer + history + clear + SSE streaming + WebSocket streaming."""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sse_starlette.sse import EventSourceResponse

from app.api.deps import (
    ACCESS_COOKIE,
    CSRFDep,
    CurrentUser,
    TenantContextDep,
    get_tenant_context,
    verify_access_token,
)
from app.core.errors import AuthError
from app.core.logging import get_logger
from app.models.user import User
from app.schemas.chat import ChatIn
from app.services import chat_service

router = APIRouter()
log = get_logger(__name__)


# ---- HTTP routes -----------------------------------------------------------


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
    before: str | None = Query(
        None,
        description="ISO-8601 cursor; return logs strictly older than this timestamp",
    ),
):
    parsed_before: datetime | None = None
    if before:
        try:
            parsed_before = datetime.fromisoformat(before.replace("Z", "+00:00"))
        except ValueError:
            parsed_before = None
    return await chat_service.list_history(
        ctx, page=page, limit=limit, before=parsed_before
    )


@router.delete("/history")
async def clear(user: CurrentUser, _: CSRFDep, ctx: TenantContextDep):
    return await chat_service.clear_history(ctx)


@router.get("/stream")
async def stream(user: CurrentUser, ctx: TenantContextDep, question: str = ""):
    """SSE streaming endpoint (kept for compatibility with non-WS clients).

    Security: auth is via same-site cookies (read in dep), not query params.
    Long-lived tokens are NEVER placed in query strings (Risk #4 mitigation).
    """

    async def event_gen():
        yield {"event": "status", "data": json.dumps({"stage": "started"})}
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
                    "detectedDates": result.get("detectedDates", []),
                }
            ),
        }

    return EventSourceResponse(event_gen())


# ---- WebSocket route -------------------------------------------------------


async def _resolve_ws_user(websocket: WebSocket) -> User | None:
    """Resolve the authenticated user from the WebSocket cookies.

    WebSockets don't go through FastAPI Depends(), so we manually verify the
    access_token cookie. Returns None if authentication fails.
    """
    token = websocket.cookies.get(ACCESS_COOKIE)
    if not token:
        return None
    payload = verify_access_token(token)
    if payload is None or payload.get("type") != "access":
        return None
    user_id = payload.get("sub") or payload.get("userId")
    if not user_id:
        return None
    try:
        user = await User.get(user_id)
    except Exception as exc:  # noqa: BLE001
        log.warning("ws_user_lookup_failed", error=str(exc))
        return None
    if user is None or not user.is_active:
        return None
    return user


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket) -> None:
    """WebSocket endpoint for bidirectional streaming chat.

    Wire protocol (JSON messages):
      Client -> Server:
        {"type": "question", "content": "When is my exam?", "mode": "college",
         "model": "gemini/gemini-2.0-flash", "sessionId": "optional"}
        {"type": "cancel"}   # user wants to stop generation
        {"type": "ping"}     # keep-alive
      Server -> Client:
        {"type": "ready", "userId": "...", "sessionId": "..."}
        {"type": "status", "stage": "searching"}
        {"type": "sources", "sources": [...]}
        {"type": "token", "content": "Your"}
        {"type": "final", "answer": "...", "traceId": "...", "model": "...", "confidence": "high"}
        {"type": "error", "message": "..."}
        {"type": "pong"}

    Auth: the same access_token cookie used by the HTTP routes is read from
    the WebSocket upgrade request. CSRF is not enforced for WS because the
    WebSocket spec doesn't support custom headers from browsers.
    """
    user = await _resolve_ws_user(websocket)
    if user is None:
        await websocket.close(code=4401, reason="Unauthorized")
        return
    await websocket.accept()

    session_id = uuid.uuid4().hex
    await websocket.send_json(
        {"type": "ready", "userId": str(user.id), "sessionId": session_id}
    )

    # Cancellation token for the currently streaming answer (if any).
    cancel_event: asyncio.Event | None = None
    stream_task: asyncio.Task | None = None

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue
            kind = msg.get("type")
            if kind == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            if kind == "cancel":
                # Signal the active stream to abort between token sends.
                if cancel_event is not None:
                    cancel_event.set()
                await websocket.send_json({"type": "status", "stage": "cancelling"})
                continue
            if kind == "question":
                # If a previous answer is still streaming, wait for it
                # to finish (or be cancelled) before starting the next.
                if stream_task is not None and not stream_task.done():
                    try:
                        await asyncio.wait_for(stream_task, timeout=10.0)
                    except TimeoutError:
                        stream_task.cancel()
                question = (msg.get("content") or "").strip()
                if not question:
                    await websocket.send_json(
                        {"type": "error", "message": "Question cannot be empty"}
                    )
                    continue
                model = msg.get("model")
                mode = msg.get("mode", "college")
                client_session = msg.get("sessionId") or session_id
                cancel_event = asyncio.Event()
                stream_task = asyncio.create_task(
                    _stream_answer(
                        websocket,
                        user=user,
                        question=question,
                        model=model,
                        mode=mode,
                        session_id=client_session,
                        cancel_event=cancel_event,
                    )
                )
                # Yield control so cancel can be processed while the stream runs.
                await stream_task
                continue
            await websocket.send_json(
                {"type": "error", "message": f"Unknown message type: {kind!r}"}
            )
    except WebSocketDisconnect:
        log.info("ws_disconnected", user_id=str(user.id))
        if stream_task is not None and not stream_task.done():
            stream_task.cancel()


async def _stream_answer(
    websocket: WebSocket,
    *,
    user: User,
    question: str,
    model: str | None,
    mode: str,
    session_id: str,
    cancel_event: asyncio.Event | None = None,
) -> None:
    """Run the chat agent and stream tokens to the WebSocket client.

    If `cancel_event` is set during the token loop, the loop aborts and
    the client is notified. The agent call itself is not interruptible
    without a deeper refactor of the LangGraph runner; the LLM cost of
    the in-flight call is still incurred, but no further tokens are
    sent to a (likely-stale) client.
    """
    from app.api.deps import TenantContext

    ctx = TenantContext(
        user_id=str(user.id),
        role=user.role,
        college_name=user.college_name,
        department=user.department,
        college_id=user.college_id,
    )
    await websocket.send_json({"type": "status", "stage": "started"})
    try:
        result = await chat_service.answer(
            ctx, ChatIn(question=question, model=model, mode=mode)
        )
    except AuthError as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        return
    except Exception as exc:  # noqa: BLE001
        log.exception("ws_chat_failed", user_id=str(user.id), error=str(exc))
        await websocket.send_json(
            {"type": "error", "message": "Failed to generate answer"}
        )
        return

    if cancel_event is not None and cancel_event.is_set():
        await websocket.send_json({"type": "status", "stage": "cancelled"})
        return

    await websocket.send_json({"type": "status", "stage": "answered"})
    await websocket.send_json(
        {"type": "sources", "sources": result.get("sources", [])}
    )

    # Stream the answer in small chunks to give a real-time typing effect.
    answer = result.get("answer", "") or ""
    chunk_size = 4
    for i in range(0, len(answer), chunk_size):
        if cancel_event is not None and cancel_event.is_set():
            await websocket.send_json({"type": "status", "stage": "cancelled"})
            return
        await websocket.send_json(
            {"type": "token", "content": answer[i : i + chunk_size]}
        )
        await asyncio.sleep(0.01)

    await websocket.send_json(
        {
            "type": "final",
            "answer": answer,
            "traceId": result.get("traceId"),
            "model": result.get("model"),
            "confidence": result.get("confidence"),
            "sessionId": result.get("sessionId") or session_id,
            "detectedDates": result.get("detectedDates", []),
        }
    )
