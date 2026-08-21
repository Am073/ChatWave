"""Chat routes: HTTP answer + history + clear + SSE streaming + WebSocket streaming."""
from __future__ import annotations

import asyncio
import contextlib
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
    Streams real LLM tokens as they are generated.
    """

    async def event_gen():
        agen = chat_service.answer_stream(ctx, ChatIn(question=question))
        try:
            async for ev in agen:
                yield {"event": ev["event"], "data": json.dumps(ev["data"])}
        finally:
            # Client disconnected -> abort the in-flight agent/LLM call.
            await agen.aclose()

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
        {"type": "status", "stage": "started"|"answered"|"cancelled"}
        {"type": "sources", "sources": [...]}
        {"type": "token", "content": "Your"}
        {"type": "final", "answer": "...", "traceId": "...", "model": "...", "confidence": "high"}
        {"type": "error", "message": "..."}
        {"type": "pong"}

    Auth: the same access_token cookie used by the HTTP routes is read from
    the WebSocket upgrade request. CSRF is not enforced for WS because the
    WebSocket spec doesn't support custom headers from browsers.

    Concurrency: receive and stream run as competing tasks so cancel/ping
    frames are processed WHILE an answer is streaming. Cancel hard-aborts
    the in-flight LLM call (task cancellation), not just the frame forwarding.
    """
    user = await _resolve_ws_user(websocket)
    if user is None:
        await websocket.close(code=4401, reason="Unauthorized")
        return
    await websocket.accept()

    session_id = uuid.uuid4().hex
    send_lock = asyncio.Lock()

    async def send(frame: dict) -> None:
        # Serialize sends: the receive loop (pong/error) and the stream task
        # (status/sources/token/final) can fire concurrently.
        async with send_lock:
            await websocket.send_json(frame)

    await send({"type": "ready", "userId": str(user.id), "sessionId": session_id})

    recv_task = asyncio.create_task(websocket.receive_text())
    stream_task: asyncio.Task | None = None

    async def _run_stream(
        question: str, model: str | None, mode: str, client_session: str
    ) -> None:
        from app.api.deps import TenantContext

        ctx = TenantContext(
            user_id=str(user.id),
            role=user.role,
            college_name=user.college_name,
            department=user.department,
            college_id=user.college_id,
        )
        agen = chat_service.answer_stream(
            ctx, ChatIn(question=question, model=model, mode=mode)
        )
        try:
            async for ev in agen:
                if ev["event"] == "status":
                    await send({"type": "status", **ev["data"]})
                elif ev["event"] == "sources":
                    await send({"type": "sources", "sources": ev["data"]})
                else:
                    # token + final frames are already wire-shaped.
                    await send(ev["data"])
        except asyncio.CancelledError:
            with contextlib.suppress(Exception):  # socket may already be gone
                await send({"type": "status", "stage": "cancelled"})
            raise
        except AuthError as exc:
            await send({"type": "error", "message": str(exc)})
        except Exception as exc:  # noqa: BLE001
            log.exception("ws_chat_failed", user_id=str(user.id), error=str(exc))
            await send({"type": "error", "message": "Failed to generate answer"})
        finally:
            # Consumer gone or finished early -> abort agent/LLM call.
            await agen.aclose()

    try:
        while True:
            pending = {recv_task}
            if stream_task is not None and not stream_task.done():
                pending.add(stream_task)
            done, _ = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)

            if recv_task in done:
                raw = recv_task.result()  # WebSocketDisconnect propagates
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    await send({"type": "error", "message": "Invalid JSON"})
                    recv_task = asyncio.create_task(websocket.receive_text())
                    continue
                kind = msg.get("type")
                if kind == "ping":
                    await send({"type": "pong"})
                elif kind == "cancel":
                    if stream_task is not None and not stream_task.done():
                        # Hard-cancel: aborts the LLM call; the stream task's
                        # CancelledError handler emits the cancelled frame.
                        stream_task.cancel()
                    else:
                        await send({"type": "status", "stage": "cancelled"})
                elif kind == "question":
                    question = (msg.get("content") or "").strip()
                    if not question:
                        await send(
                            {"type": "error", "message": "Question cannot be empty"}
                        )
                    else:
                        if stream_task is not None and not stream_task.done():
                            stream_task.cancel()  # supersede in-flight answer
                        stream_task = asyncio.create_task(
                            _run_stream(
                                question,
                                msg.get("model"),
                                msg.get("mode", "college"),
                                msg.get("sessionId") or session_id,
                            )
                        )
                else:
                    await send(
                        {"type": "error", "message": f"Unknown message type: {kind!r}"}
                    )
                recv_task = asyncio.create_task(websocket.receive_text())

            if stream_task is not None and stream_task in done:
                with contextlib.suppress(asyncio.CancelledError):
                    stream_task.result()  # surface unexpected crashes in tests
                stream_task = None
    except WebSocketDisconnect:
        log.info("ws_disconnected", user_id=str(user.id))
    finally:
        recv_task.cancel()
        if stream_task is not None and not stream_task.done():
            stream_task.cancel()
