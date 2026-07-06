# Context

## Product

ChatWave is a multi-tenant AI assistant for educational institutions. It helps students, faculty, and administrators interact with institutional knowledge such as policies, syllabi, academic calendars, announcements, schedules, uploaded documents, and campus operations.

The current version is a MERN-style application with:

- React frontend
- Express backend
- MongoDB
- Qdrant
- Gemini embeddings and chat generation
- Custom RAG ingestion and retrieval
- WebSocket streaming
- Admin dashboard
- Announcement system
- Google Calendar integration

## Why v2 Exists

The current system proves the product concept, but the AI layer is mostly custom code. The v2 goal is to rebuild the backend around modern AI engineering practices:

- FastAPI for Python-native AI integration
- LlamaIndex for ingestion and retrieval
- LangGraph for controlled agent workflows
- LiteLLM for provider-independent model routing
- Langfuse for tracing and prompt/model observability
- Ragas and DeepEval for measurable quality gates
- Celery and Redis for durable async ingestion

The v2 system should look and behave like a production AI system operated by a real startup, not a demo chatbot.

## Target Users

- Students asking policy, schedule, event, deadline, and academic questions
- Faculty uploading documents, reviewing answers, and publishing announcements
- Admins managing users, documents, departments, quality metrics, health, and AI behavior
- Operators/debuggers reviewing traces, failed answers, eval regressions, and missing-document signals

## Business Goals

- Preserve all v1 product features.
- Improve AI answer quality and source grounding.
- Make agent behavior observable and auditable.
- Enable model/provider switching without code rewrites.
- Support thousands of daily users with predictable latency, cost, and failure behavior.
- Build a portfolio-grade production AI system suitable for startup interviews and junior AI/backend engineering roles.

## Non-Negotiable Constraints

- Multi-tenant isolation must be preserved.
- A user from one college must never retrieve another college's data.
- Role-based access must apply to both API endpoints and agent tools.
- The old Express backend must not be deleted until FastAPI reaches parity.
- The frontend should continue working during migration where possible.
- AI responses for institutional policy must be source-grounded or refuse/ask clarification.
- Tool calls must be auditable.

## Success Criteria

ChatWave v2 is successful when:

- FastAPI can replace the current Express backend for core flows.
- Upload, ingestion, chat, announcements, admin health, and auth all work.
- RAG answers include citations and refuse unsupported claims.
- LangGraph handles controlled agent flow with bounded loops.
- Langfuse traces every model, retrieval, reranking, and tool step.
- Ragas and DeepEval run against golden datasets in CI.
- Tenant isolation tests pass against real integration dependencies.
- The frontend can talk to FastAPI without a full rewrite.

