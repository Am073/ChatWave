# ChatWave v2 Spec-Driven Architecture

> **⚠️ Historical document.** This folder is the *original planning spec* for the v2 rebuild, kept for decision provenance. The shipped implementation intentionally deviates in places — most notably **no LlamaIndex** (raw qdrant-client retrieval), **no Ragas** (broken against current langchain-community; DeepEval instead), and an **MCP tool surface** beyond the original design. See `FINAL_AUDIT.md` §9 Q2 and `CHATWAVE-INFO.md` for what actually ships. Do not treat `[x]` items below as proof a named library is used.

This folder is the source of truth for the ChatWave v2 rebuild.

ChatWave v2 is a FastAPI-based, multi-tenant agentic AI platform for institutional knowledge and campus operations. It replaces the current Express custom RAG backend with a production-grade AI stack built around FastAPI, LlamaIndex, LangGraph, Qdrant, LiteLLM, Celery, Langfuse, Ragas, and DeepEval.

The current Express backend must remain working until the FastAPI backend reaches API parity and passes quality gates.

## Documents

| File | Purpose |
|------|---------|
| `context.md` | Product context, current system, target users, constraints, and success criteria |
| `decisions.md` | Finalized technical decisions and rationale |
| `spec.md` | Functional and non-functional specification for the v2 platform |
| `tasks.md` | Phased implementation plan with deliverables and acceptance checks |
| `api-contract.md` | Compatibility contract for frontend/backend migration |
| `quality.md` | Testing, evaluation, observability, and release quality gates |
| `risk-register.md` | Major engineering risks, mitigations, and decision triggers |
| `migration.md` | Migration strategy from Express v1 to FastAPI v2 |

## Operating Principle

Every tool must own a clear responsibility. The goal is not to add tools for appearance; the goal is to build a measurable, debuggable, secure, and maintainable AI system.

## Final Stack

- API: FastAPI on Python 3.12+
- Data models: Pydantic v2 + Beanie ODM
- Primary database: MongoDB
- Vector database: Qdrant
- RAG framework: LlamaIndex
- Agent orchestration: LangGraph
- Model gateway: LiteLLM
- Background jobs: Celery + Redis
- Parsing: Docling primary, fallback loaders as needed
- Observability: Langfuse
- Evals: Ragas + DeepEval
- Testing: pytest, pytest-asyncio, httpx, testcontainers
- Frontend: existing React app first, gradual TypeScript and shadcn/ui migration later

