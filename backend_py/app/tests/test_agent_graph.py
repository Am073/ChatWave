"""Agent graph unit tests — exercise LangGraph state machine directly.

These tests don't need a live Mongo (the agent graph is pure state
transformation + LiteLLM client). They use stub embeddings/retrieval where
needed.
"""
from __future__ import annotations

import pytest

from app.agents.state import AgentState


def _state(intent: str | None = None, sources: list | None = None) -> AgentState:
    return AgentState(
        user_id="u1",
        role="student",
        college_name="Test College",
        department="CS",
        question="What is the attendance policy?",
        session_id="s1",
        prompt_version="v2.0",
        trace_id="t1",
        intent=intent,  # type: ignore[arg-type]
        sources=sources or [],
    )


@pytest.mark.asyncio
async def test_sufficiency_router_with_no_sources_refuses_after_one_clarify():
    from app.agents.graph import _sufficiency_router

    # First call: should ask for clarification
    s1 = _state(intent="policy_lookup", sources=[])
    decision = _sufficiency_router(s1)
    assert decision == "clarify"
    # After we've already clarified, should refuse
    s1.agent_steps.append({"node": "clarify"})
    decision2 = _sufficiency_router(s1)
    assert decision2 == "refuse"


@pytest.mark.asyncio
async def test_sufficiency_router_with_strong_sources_continues():
    from app.agents.graph import _sufficiency_router

    s = _state(
        intent="policy_lookup",
        sources=[{"documentId": "d1", "score": 0.85, "text": "policy text"}],
    )
    assert _sufficiency_router(s) == "continue"


@pytest.mark.asyncio
async def test_sufficiency_router_blocks_refuse_intent():
    from app.agents.graph import _sufficiency_router

    s = _state(intent="refuse", sources=[])
    assert _sufficiency_router(s) == "refuse"


@pytest.mark.asyncio
async def test_sufficiency_router_caps_at_max_iterations():
    from app.agents.graph import _sufficiency_router
    from app.core.config import get_settings

    s = _state(intent="policy_lookup", sources=[])
    s.iteration = get_settings().agent_max_iterations
    assert _sufficiency_router(s) == "refuse"


@pytest.mark.asyncio
async def test_clarify_node_sets_finished_and_clarification():
    from app.agents.graph import _clarify_node
    from app.rag.citations import build_clarification_question

    s = _state()
    out = await _clarify_node(s)
    assert out.finished
    assert out.clarification
    assert out.answer == build_clarification_question()


@pytest.mark.asyncio
async def test_refuse_node_sets_refused():
    from app.agents.graph import _refuse_node
    from app.rag.citations import build_refusal_answer

    s = _state()
    out = await _refuse_node(s)
    assert out.refused
    assert out.finished
    assert out.answer == build_refusal_answer()