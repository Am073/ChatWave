# Decisions

This document records finalized architecture decisions for ChatWave v2.

## Decision 1: Backend Framework

Decision: Use FastAPI.

Rationale:

- Python AI ecosystem integration is stronger than Node for this project.
- FastAPI provides async request handling, OpenAPI docs, dependency injection, and Pydantic-native validation.
- It fits LlamaIndex, LangGraph, LiteLLM, Langfuse, Ragas, and DeepEval naturally.

Rejected:

- Keep Express: would preserve custom AI code and weaker Python AI tooling integration.
- Django/Django Ninja: heavier than needed for this service.
- Flask: weaker typing and async-first ergonomics.

## Decision 2: Migration Strategy

Decision: Build `backend_py/` side-by-side and keep `backend/` until parity.

Rationale:

- Reduces migration risk.
- Allows frontend compatibility testing.
- Preserves a working product while v2 is built.

Rejected:

- Big-bang deletion of Express backend.

## Decision 3: Primary Database

Decision: Keep MongoDB.

Rationale:

- Existing data model is document-oriented and already works.
- Avoids unnecessary relational migration.
- Beanie gives a Pydantic-native async ODM.

Rejected:

- PostgreSQL migration at the same time as AI/backend migration.

## Decision 4: MongoDB Access

Decision: Use Beanie ODM over raw Motor for core models.

Rationale:

- Typed models.
- Pydantic v2 compatibility.
- Cleaner service code for a portfolio project.

Note:

- Raw Motor can still be used for advanced queries if Beanie becomes limiting.

## Decision 5: Vector Database

Decision: Keep Qdrant.

Rationale:

- Already part of the current architecture.
- Strong vector search capabilities.
- Supports metadata filters and hybrid retrieval patterns.
- Official Python client replaces custom Axios wrapper.

## Decision 6: RAG Framework

Decision: Use LlamaIndex for ingestion, indexing, retrieval, and citation-aware query flows.

Rationale:

- Reduces custom RAG code.
- Strong document indexing and retriever abstractions.
- Integrates with Qdrant and observability tools.

Rejected:

- Continue custom RAG.
- Use LangChain for all RAG.

## Decision 7: Agent Framework

Decision: Use LangGraph.

Rationale:

- Controlled state-machine agent architecture.
- Explicit nodes, conditional edges, and loop limits.
- Better for production-style agent workflows than free-running agent abstractions.

Initial graph:

```text
intent_classifier
  -> context_retriever
  -> sufficiency_check
  -> answer_generator
  -> citation_validator
```

Initial tools:

- `search_documents`
- `get_announcements`

## Decision 8: Model Gateway

Decision: Use LiteLLM for all LLM and embedding calls.

Rationale:

- Provider switching by config.
- Built-in retry/fallback options.
- Cost and token tracking support.
- Avoids direct lock-in to Gemini SDK.

Default provider:

- Start with Gemini Flash models for cost efficiency.
- Keep OpenAI/Anthropic/Groq-compatible routing possible through LiteLLM.

## Decision 9: Embeddings

Decision: Use LiteLLM-managed embeddings initially.

Rationale:

- Keeps embedding provider configurable.
- Avoids mixing local FastEmbed and hosted embeddings too early.

Future option:

- Add FastEmbed as a local/cost-saving fallback after quality benchmarking.

## Decision 10: Document Parsing

Decision: Use Docling as the primary parser, with fallback loaders.

Rationale:

- Better layout-aware PDF extraction.
- Stronger table and structured-document handling than simple parsers.
- One main ingestion abstraction.

Risk:

- Some formats may still need fallback loaders such as PyMuPDF, python-docx, pandas/openpyxl, or OCR-specific handling.

## Decision 11: Background Jobs

Decision: Use Celery + Redis.

Rationale:

- Durable ingestion jobs.
- Retries and visibility.
- Good production story.
- Flower can support development monitoring.

Rejected:

- FastAPI `BackgroundTasks` for long-running ingestion.
- Worker threads.

## Decision 12: Streaming

Decision: Use SSE or fetch-based streaming for one-way AI answer streaming.

Rationale:

- Simpler than WebSocket for token streaming.
- HTTP-native and easier to operate.

Security constraint:

- Do not pass long-lived auth tokens in query params.
- Prefer same-site cookie auth or fetch streaming with headers.

## Decision 13: Observability

Decision: Use Langfuse first.

Rationale:

- Open-source friendly.
- Strong tracing, prompt/version management, and feedback support.
- Useful for portfolio and production debugging.

Alternative:

- Arize Phoenix can be added or used later if deeper eval/debug workflows are needed.

## Decision 14: Evaluation

Decision: Use both Ragas and DeepEval.

Rationale:

- Ragas covers RAG quality metrics.
- DeepEval covers test-case style LLM quality and safety checks.

Required datasets:

- Golden QA
- Expected sources
- Prompt injection
- Tenant isolation
- Ambiguous/no-answer
- Tool-calling

## Decision 15: Guardrails

Decision: Start with custom policy checks, add framework guardrails later where useful.

Rationale:

- Tenant isolation and RBAC are product-specific and must be explicit.
- Prompt-injection and output checks can be custom initially.
- NeMo Guardrails or Guardrails AI can be introduced after core behavior is stable.

## Decision 16: Frontend

Decision: Keep the React frontend working first. Modernize gradually.

Rationale:

- Backend/AI migration is already large.
- Frontend rewrite should not block FastAPI parity.

Future frontend decisions:

- Gradual TypeScript migration.
- Gradual shadcn/ui adoption.
- Optional TanStack Router migration later.
- Remove or reduce Three.js if it distracts from product value.

