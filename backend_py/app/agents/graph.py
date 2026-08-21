"""LangGraph agent graph: 5 nodes + hard loop limit.

Nodes:
  intent_classifier
  context_retriever
  sufficiency_check
  answer_generator
  citation_validator

Conditional edge: sufficiency_check -> [clarify, refuse, continue]
Hard cap: MAX_ITERATIONS prevents uncontrolled loops.
"""
from __future__ import annotations

from typing import Any

import litellm
from langgraph.graph import END, StateGraph

from app.agents.prompts import (
    build_answer_prompt,
    build_system_prompt,
)
from app.agents.state import AgentState
from app.agents.tools import get_announcements, search_documents
from app.core.config import get_settings
from app.core.logging import get_logger
from app.observability.tracing import get_tracer
from app.rag.citations import (
    build_clarification_question,
    build_refusal_answer,
    has_grounded_sources,
)

log = get_logger(__name__)
_settings = get_settings()


# ---- Node implementations ----


async def intent_classifier(state: AgentState) -> AgentState:
    state.iteration += 1
    tracer = get_tracer()
    model = state.model_override or _settings.chat_model
    try:
        resp = await litellm.acompletion(
            model=model,
            messages=[
                {"role": "system", "content": "You classify intents."},
                {
                    "role": "user",
                    "content": f"Classify: {state.question}. Respond with one label only.",
                },
            ],
            max_tokens=8,
        )
        label = (resp["choices"][0]["message"]["content"] or "").strip().lower()
        if "policy" in label:
            state.intent = "policy_lookup"
        elif "announce" in label:
            state.intent = "announcement_lookup"
        elif "refuse" in label:
            state.intent = "refuse"
        else:
            state.intent = "general"
    except Exception as exc:  # noqa: BLE001
        log.warning("intent_classifier_failed", error=str(exc))
        state.intent = "policy_lookup"  # default to retrieval for safety
    state.agent_steps.append(
        {"node": "intent_classifier", "intent": state.intent, "iter": state.iteration}
    )
    if tracer is not None:
        tracer.log_event("intent_classified", metadata={"intent": state.intent})
    return state


async def context_retriever(state: AgentState) -> AgentState:
    if state.mode == "general":
        state.sources = []
        state.agent_steps.append(
            {"node": "context_retriever", "sources": 0, "skipped": True}
        )
        return state

    from app.api.deps import TenantContext

    ctx = TenantContext(
        user_id=state.user_id,
        role=state.role,
        college_name=state.college_name,
        department=state.department,
        college_id="",  # not needed in retrieval
    )
    if state.intent == "announcement_lookup":
        state.sources = await get_announcements(ctx, trace_id=state.trace_id)
        state.tool_calls.append(
            {"tool": "get_announcements", "ok": True, "count": len(state.sources)}
        )
    else:
        state.sources = await search_documents(
            ctx, state.question, trace_id=state.trace_id
        )
        state.tool_calls.append(
            {"tool": "search_documents", "ok": True, "count": len(state.sources)}
        )
    state.agent_steps.append(
        {"node": "context_retriever", "sources": len(state.sources)}
    )
    return state


def _sufficiency_router(state: AgentState) -> str:
    if state.mode == "general":
        return "continue"
    if state.iteration >= _settings.agent_max_iterations:
        return "refuse"
    if state.intent == "refuse":
        return "refuse"
    if not has_grounded_sources(state.sources):
        # Ask for clarification once; if already asked, refuse.
        if any(s["node"] == "clarify" for s in state.agent_steps):
            return "refuse"
        return "clarify"
    return "continue"


async def sufficiency_check(state: AgentState) -> AgentState:
    state.agent_steps.append(
        {"node": "sufficiency_check", "grounded": has_grounded_sources(state.sources)}
    )
    return state


async def answer_generator(state: AgentState) -> AgentState:
    tracer = get_tracer()
    model = state.model_override or _settings.chat_model
    ctx_text = "\n\n".join(
        f"[{i+1}] {s.get('text','')}"
        for i, s in enumerate(state.sources[:_settings.retrieval_top_k])
    )
    system = build_system_prompt(
        college_name=state.college_name, role=state.role, department=state.department
    )
    user = build_answer_prompt(question=state.question, context=ctx_text or "(no context)")
    try:
        resp = await litellm.acompletion(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=_settings.max_completion_tokens,
        )
        state.answer = resp["choices"][0]["message"]["content"] or ""
    except Exception as exc:  # noqa: BLE001
        log.error("answer_gen_failed", error=str(exc))
        state.answer = (
            "I couldn't generate an answer right now due to a model error. "
            "Please try again shortly."
        )
    state.agent_steps.append({"node": "answer_generator", "answer_len": len(state.answer)})
    if tracer is not None:
        tracer.log_event("answer_generated", metadata={"len": len(state.answer)})
    return state


async def citation_validator(state: AgentState) -> AgentState:
    state.confidence = "high" if has_grounded_sources(state.sources) else "low"
    state.finished = True
    state.agent_steps.append(
        {"node": "citation_validator", "confidence": state.confidence}
    )
    return state


async def _clarify_node(state: AgentState) -> AgentState:
    state.answer = build_clarification_question()
    state.clarification = True
    state.finished = True
    state.agent_steps.append({"node": "clarify", "answer": state.answer})
    return state


async def _refuse_node(state: AgentState) -> AgentState:
    state.answer = build_refusal_answer()
    state.refused = True
    state.finished = True
    state.agent_steps.append({"node": "refuse", "answer": state.answer})
    return state


# ---- Graph assembly ----


def build_agent_graph() -> Any:
    graph = StateGraph(AgentState)
    graph.add_node("intent_classifier", intent_classifier)
    graph.add_node("context_retriever", context_retriever)
    graph.add_node("sufficiency_check", sufficiency_check)
    graph.add_node("answer_generator", answer_generator)
    graph.add_node("citation_validator", citation_validator)
    graph.add_node("clarify", _clarify_node)
    graph.add_node("refuse", _refuse_node)

    graph.set_entry_point("intent_classifier")
    graph.add_edge("intent_classifier", "context_retriever")
    graph.add_edge("context_retriever", "sufficiency_check")
    graph.add_conditional_edges(
        "sufficiency_check",
        _sufficiency_router,
        {"continue": "answer_generator", "clarify": "clarify", "refuse": "refuse"},
    )
    graph.add_edge("answer_generator", "citation_validator")
    graph.add_edge("clarify", END)
    graph.add_edge("refuse", END)
    graph.add_edge("citation_validator", END)

    return graph.compile()


_agent = build_agent_graph()


async def run_agent(state: AgentState, model_override: str | None = None) -> AgentState:
    """Invoke the agent graph. Optionally override the chat model for this run."""
    if model_override:
        state.model_override = model_override
    res = await _agent.ainvoke(state)
    if isinstance(res, dict):
        return AgentState(**res)
    return res