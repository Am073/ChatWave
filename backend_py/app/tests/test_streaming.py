"""Streaming pipeline tests: real token forwarding + true cancellation.

Runs fully offline — litellm is mocked, mode="general" skips retrieval,
and ChatLog insert failures are tolerated by design (logged, not raised).
"""
import asyncio

import app.agents.graph as graph_mod
from app.api.deps import TenantContext
from app.schemas.chat import ChatIn
from app.services import chat_service

CTX = TenantContext(
    user_id="u1",
    role="student",
    college_name="TestU",
    department=None,
    college_id="c1",
)


class _FakeStream:
    def __init__(self, tokens):
        self._tokens = list(tokens)

    def __aiter__(self):
        self._it = iter(self._tokens)
        return self

    async def __anext__(self):
        try:
            tok = next(self._it)
        except StopIteration:
            raise StopAsyncIteration from None
        return {"choices": [{"delta": {"content": tok}}]}


def _mock_acompletion(tokens):
    async def fake(**kwargs):
        if kwargs.get("stream"):
            return _FakeStream(tokens)
        # Non-streaming (intent classifier / plain answer path).
        return {"choices": [{"message": {"content": "".join(tokens)}}]}

    return fake


async def test_answer_stream_emits_real_tokens(monkeypatch):
    tokens = ["Hello", " world"]
    monkeypatch.setattr(graph_mod.litellm, "acompletion", _mock_acompletion(tokens))
    events = []
    async for ev in chat_service.answer_stream(
        CTX, ChatIn(question="hi", mode="general")
    ):
        events.append(ev)

    kinds = [e["event"] for e in events]
    assert kinds[0] == "status"
    assert "token" in kinds
    assert kinds[-1] == "final"

    got = [e["data"]["content"] for e in events if e["event"] == "token"]
    assert got == tokens  # exact deltas, no re-chunking

    final = events[-1]["data"]
    assert final["answer"] == "Hello world"
    assert final["traceId"]
    assert any(e["event"] == "sources" for e in events)


async def test_answer_non_streaming_unchanged(monkeypatch):
    monkeypatch.setattr(graph_mod.litellm, "acompletion", _mock_acompletion(["A", "B"]))
    result = await chat_service.answer(CTX, ChatIn(question="hi", mode="general"))
    assert result["answer"] == "AB"


async def test_close_aborts_inflight_llm_call(monkeypatch):
    """Closing the event stream must cancel the underlying LLM iteration."""

    class _SlowStream:
        def __init__(self):
            self.aborted = False

        def __aiter__(self):
            return self

        async def __anext__(self):
            try:
                await asyncio.sleep(30)
            except asyncio.CancelledError:
                self.aborted = True
                raise
            raise StopAsyncIteration

    slow = _SlowStream()

    async def fake(**kwargs):
        if kwargs.get("stream"):
            return slow
        return {"choices": [{"message": {"content": "general"}}]}

    monkeypatch.setattr(graph_mod.litellm, "acompletion", fake)

    agen = chat_service.answer_stream(CTX, ChatIn(question="hi", mode="general"))
    assert (await agen.__anext__())["event"] == "status"  # started
    # Drain until we block on queue.get() (sources may or may not arrive first).
    try:
        while True:
            await asyncio.wait_for(agen.__anext__(), timeout=2)
    except (StopAsyncIteration, TimeoutError):
        pass
    await agen.aclose()
    # Let the cancelled agent task process its cancellation.
    for _ in range(10):
        await asyncio.sleep(0)
    assert slow.aborted, "LLM stream was not cancelled after consumer closed"
