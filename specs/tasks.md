# Tasks

## Phase 0 - Freeze v1 As Reference

- [x] Keep Express backend working. *(superseded by Phase 12)*
- [x] Keep current frontend working.
- [x] Treat `CHATWAVE-INFO.md` as v1 source-of-truth.
- [x] Add spec-driven docs in `specs/`.
- [x] Do not delete `backend/`. *(until Phase 12)*

Acceptance:

- [x] v1 still runs with existing setup. *(during transition; removed in Phase 12)*
- [x] v2 docs exist and are internally consistent.

## Phase 1 - FastAPI Foundation

- [x] Create `backend_py/`.
- [x] Add `pyproject.toml`.
- [x] Add FastAPI app in `app/main.py`.
- [x] Add health route.
- [x] Add pydantic-settings config.
- [x] Add structured logging.
- [x] Add CORS middleware.
- [x] Add MongoDB connection.
- [x] Add Qdrant connection.
- [x] Add Redis connection check.
- [x] Add pytest setup.

Acceptance:

- [x] `GET /api/health` returns service status.
- [x] Tests can start the FastAPI app.
- [x] Config validation fails fast on missing critical settings.

## Phase 2 - Auth, RBAC, And Tenant Isolation

- [x] Define Beanie user model.
- [x] Port register endpoint.
- [x] Port login endpoint.
- [x] Port logout endpoint.
- [x] Port current-user endpoint.
- [x] Implement auth dependency.
- [x] Implement role dependency.
- [x] Implement tenant dependency.
- [x] Add tenant isolation tests.

Acceptance:

- [x] Student/faculty/admin login works.
- [x] Protected routes reject unauthenticated users.
- [x] Student cannot access admin endpoints.
- [x] Tenant context is available to services and tools.

## Phase 3 - Document Model And Upload

- [x] Define document model.
- [x] Implement upload route with `UploadFile`.
- [x] Validate file size and MIME type.
- [x] Create document record with `pending` status.
- [x] Enqueue ingestion job.
- [x] Implement status endpoint.
- [x] Implement delete endpoint.

Acceptance:

- [x] Upload returns document id.
- [x] Status polling works.
- [x] Invalid file types are rejected.
- [x] Delete removes document record and associated vectors.

## Phase 4 - Ingestion Pipeline

- [x] Add Celery app.
- [x] Add Redis broker config.
- [x] Add Docling parser adapter.
- [x] Add fallback parser interface.
- [x] Add LlamaIndex node creation.
- [x] Add LiteLLM embedding adapter.
- [x] Add Qdrant upsert logic.
- [x] Persist ingestion status and errors.

Acceptance:

- [x] Uploaded PDF/DOCX/XLSX/image can be processed or fail cleanly.
- [x] Qdrant contains tenant-scoped vectors.
- [x] Document status moves from `pending` to `processing` to `completed` or `failed`.

## Phase 5 - Baseline RAG

- [x] Implement LlamaIndex retriever.
- [x] Enforce tenant filter/collection routing.
- [x] Enforce department filter.
- [x] Return source nodes.
- [x] Generate grounded answer through LiteLLM.
- [x] Store ChatLog.

Acceptance:

- [x] `POST /api/chat` returns answer and sources.
- [x] Weak/no context triggers refusal or clarification.
- [x] Sources include document id and metadata.

## Phase 6 - Agent Graph

- [x] Define LangGraph state.
- [x] Add intent classifier node.
- [x] Add context retriever node.
- [x] Add sufficiency check node.
- [x] Add answer generator node.
- [x] Add citation validator node.
- [x] Add `search_documents` tool.
- [x] Add `get_announcements` tool.
- [x] Add loop limits.

Acceptance:

- [x] Agent follows bounded graph.
- [x] Agent can answer document questions.
- [x] Agent can retrieve announcements.
- [x] Agent refuses or clarifies when context is insufficient.

## Phase 7 - Streaming

- [x] Implement SSE or fetch-streaming endpoint.
- [x] Stream answer chunks.
- [x] Stream status events.
- [x] Stream final sources.
- [x] Use cookie/header auth, not long-lived query tokens.

Acceptance:

- [x] Frontend receives incremental answer chunks.
- [x] Auth is safe.
- [x] Final event includes answer metadata and sources.

## Phase 8 - Observability

- [x] Add Langfuse config.
- [x] Trace chat request lifecycle.
- [x] Trace LLM calls.
- [x] Trace embedding calls.
- [x] Trace retrieval and reranking.
- [x] Trace tool calls.
- [x] Store trace id in ChatLog.

Acceptance:

- [x] Every chat response has a trace id.
- [x] Langfuse shows retrieval, prompt, model, and tool details.
- [x] Errors are visible in traces.

## Phase 9 - Evals

- [x] Create `golden_qa.jsonl`.
- [x] Create expected-sources dataset.
- [x] Create prompt-injection dataset.
- [x] Create tenant-isolation dataset.
- [x] Add Ragas eval runner.
- [x] Add DeepEval tests.
- [x] Add CI thresholds.

Acceptance:

- [x] Eval suite runs locally.
- [x] CI can fail on quality regression.
- [x] Metrics are recorded and comparable across runs.

## Phase 10 - Guardrails

- [x] Add prompt-injection detector.
- [x] Add role-aware tool policy.
- [x] Add tenant-aware retrieval policy.
- [x] Add source-grounding validator.
- [x] Add unsupported-answer refusal policy.
- [x] Add audit logs for tool calls.

Acceptance:

- [x] Prompt-injection test cases do not override system policy.
- [x] Cross-tenant access attempts fail.
- [x] Admin-only data is not exposed to students.

## Phase 11 - Admin AI Quality Dashboard

- [x] Add backend endpoints for AI quality metrics.
- [x] Add failed-query list.
- [x] Add low-confidence answer list.
- [x] Add trace links.
- [x] Add missing-document signals.
- [x] Add eval score summaries.

Acceptance:

- [x] Admin can inspect AI behavior.
- [x] Admin can identify missing documents and failing topics.

## Phase 12 - Retire Express Backend

- [x] Confirm API parity.
- [x] Confirm frontend works against FastAPI.
- [x] Confirm tests pass.
- [x] Confirm evals pass.
- [x] Update README and SETUP.
- [x] Update Docker Compose.
- [x] Archive or remove Express backend only after approval.

Acceptance:

- [x] FastAPI is the default backend.
- [x] Express backend is no longer required for product functionality.