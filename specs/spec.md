# Specification

## Objective

Build ChatWave v2 as a FastAPI-based, multi-tenant agentic AI platform that preserves v1 product capabilities while adding production AI features: framework-based RAG, controlled agent workflows, observability, evals, guardrails, durable ingestion, and API compatibility.

## Scope

### In Scope

- FastAPI backend in `backend_py/`
- Auth, RBAC, and tenant isolation
- MongoDB models using Beanie
- Qdrant integration using official Python client
- LlamaIndex ingestion and retrieval
- LangGraph agent workflow
- LiteLLM model routing
- Celery + Redis ingestion jobs
- SSE or fetch-based streaming
- Langfuse tracing
- Ragas and DeepEval evaluations
- Guardrail and policy checks
- API compatibility with current frontend
- Integration and regression tests

### Out of Scope For Initial v2

- Full frontend rewrite
- Full shadcn/ui replacement
- Tailwind v4 migration
- TanStack Router migration
- Multi-agent supervisor architecture
- Production Kubernetes deployment
- Deleting Express backend before parity

## Functional Requirements

### Authentication

- Users can register, login, logout, and fetch current profile.
- Auth supports secure cookie-based sessions or JWT with safe refresh handling.
- Auth must expose current user, role, college, and department to route dependencies.
- Admin, faculty, and student permissions must be enforced consistently.

### Tenant Isolation

- Every request must resolve tenant context.
- Every MongoDB query involving tenant data must filter by `college_name`.
- Every Qdrant query must filter or route by tenant collection.
- Agent tools must receive tenant context explicitly.
- Tenant isolation must be tested.

### Document Upload

- Faculty/admin users can upload supported institutional documents.
- Uploads are stored as document records with ingestion status.
- Ingestion runs asynchronously through Celery.
- Users can poll document status.
- Failed ingestion records must store error messages.

### Ingestion

- Docling is the primary parser.
- Fallback parsers may be used for unsupported or poor-quality extractions.
- Parsed content must preserve useful metadata such as page, heading, sheet, section, and file name where possible.
- LlamaIndex creates nodes/chunks.
- Embeddings are generated through LiteLLM.
- Chunks are written to Qdrant with tenant and document metadata.

### Retrieval

- Retrieval must use LlamaIndex and Qdrant.
- Retrieval must enforce tenant and department filters.
- Hybrid retrieval and reranking should be implemented after baseline retrieval works.
- Query rewriting can be added after baseline retrieval and citations are stable.
- Retrieval should return source nodes with scores and metadata.

### Agent

- LangGraph manages request state.
- Initial graph nodes:
  - `intent_classifier`
  - `context_retriever`
  - `sufficiency_check`
  - `answer_generator`
  - `citation_validator`
- Initial tools:
  - `search_documents`
  - `get_announcements`
- Agent must have a hard loop limit.
- Agent must ask clarification or refuse when context is insufficient.
- Agent must not perform sensitive actions without explicit user confirmation.

### Chat

- Users can send chat questions.
- The system returns answer, sources, trace id, and confidence/quality metadata where appropriate.
- Answers about institutional policy must cite sources.
- Unsupported claims must be refused or clarified.
- Chat history is stored with user id, session id, question, answer, sources, model, prompt version, and trace id.

### Streaming

- Streaming endpoint returns incremental answer chunks.
- Streaming may also emit status events such as retrieval started, tool called, answer started, and final sources.
- Streaming auth must not leak long-lived tokens in URLs.

### Announcements

- Announcement APIs must preserve v1 behavior.
- Department and college-wide visibility rules must remain intact.
- Agent can retrieve announcements through a controlled tool.

### Admin

- Admin can view users, documents, activity, health, and AI quality metrics.
- Admin can see failed queries, low-confidence answers, missing-document signals, and trace links.
- Admin can trigger re-indexing and eval runs in later phases.

## Non-Functional Requirements

### Security

- Secure cookies in production.
- RBAC on routes and tools.
- Tenant isolation as a first-class dependency.
- Prompt injection detection.
- Source-grounding checks for policy answers.
- Audit logs for agent tools.

### Reliability

- Celery jobs must retry transient failures.
- Ingestion failures must not crash API workers.
- Model provider errors must be handled with retry/fallback where configured.
- Health endpoint checks MongoDB, Qdrant, Redis, and model gateway configuration.

### Observability

- Every AI request must have a trace id.
- Trace id must be stored in ChatLog.
- Langfuse must capture model calls, embeddings, retrieval, reranking, tool calls, prompt version, latency, token usage, and final answer.

### Performance

- API should remain responsive during ingestion.
- Long-running document processing must happen outside request handlers.
- Retrieval and generation latency must be measured.
- p95 latency should be tracked before hard thresholds are set.

### Maintainability

- Services should be typed.
- Routes should be thin.
- Business logic should live in services.
- Agent nodes should be testable in isolation.
- No framework or tool should hide tenant/RBAC policy.

