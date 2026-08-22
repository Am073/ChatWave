# ChatWave — Multi-tenant Agentic AI Platform

> **Current versions:**
> - **v2 (FastAPI + AI stack)** — `backend_py/` (FastAPI + Beanie + LangGraph + Qdrant + LiteLLM + Celery + Langfuse)
> - **Frontend** — `frontend/` (React 19 + Vite, pointed at FastAPI)
>
> See `specs/` for the v2 specification and `CHATWAVE-INFO.md` for the v1 source-of-truth.
> See `backend_py/RETIRE_EXPRESS.md` for the v1 retirement checklist (now complete — Express was removed).

ChatWave is a production-grade, multi-tenant agentic AI platform for educational institutions. It allows students, faculty, and administrators to search and interact with institutional knowledge bases (syllabi, schedules, regulations, documents) scoped dynamically to their college and department.

---

## Quick start

```bash
# 1. Backend (FastAPI)
cd backend_py
uv sync --all-extras
cp .env.example .env       # edit secrets (cloud URIs for Mongo/Qdrant/Redis)
uv run uvicorn app.main:app --reload --port 8000
uv run celery -A app.workers.celery_app.celery_app worker -l info

# 2. Frontend (React)
cd ../frontend
cp .env.example .env       # default VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev                # http://localhost:5173
```

See `SETUP.md` for full instructions.

## Architecture

```
chatwave/
├── backend_py/            FastAPI + Beanie + LangGraph + Qdrant + LiteLLM
├── frontend/              React 19 + Vite (proxies /api to FastAPI :8000)
├── specs/                 Source-of-truth spec for v2
├── CHATWAVE-INFO.md       Technical reference (architecture + API + config)
└── .github/workflows/     CI for backend (ruff + pytest) and frontend (lint/test/build)
```

## Stack highlights

- **API**: FastAPI on Python 3.12+ (WebSocket chat, SSE announcements, HTTP REST)
- **Data models**: Pydantic v2 + Beanie ODM
- **Primary DB**: MongoDB
- **Vector DB**: Qdrant (per-tenant collections, payload-indexed filters)
- **Agent orchestration**: LangGraph (7-node state machine: 5 pipeline + clarify/refuse) with tenant-scoped RAG tools (search_documents, get_announcements) exposed over MCP
- **Model gateway**: LiteLLM (Gemini, Claude, GPT-4o) with Redis-backed runtime model switcher
- **Background jobs**: Celery + Redis
- **Parsing**: Docling primary, fallback loaders as needed
- **Observability**: Langfuse + Prometheus metrics + structured request logging
- **Evals**: DeepEval (faithfulness / answer relevancy / contextual precision & recall)
- **Auth**: JWT + CSRF double-submit cookies; OAuth for Google Calendar
- **Security**: Redis-backed rate limiter, env validation, security headers, HSTS
- **Frontend**: React 19 + Vite + WebSocket chat + Vitest tests
- **Frontend tests**: Vitest + React Testing Library (component + hook coverage)
- **Deployment**: Native Python (uvicorn) + Node (Vite) — infrastructure is fully cloud-managed (MongoDB Atlas, Qdrant Cloud, Redis Cloud)

## More

- `specs/` — full specification (must-read)
- `CHATWAVE-INFO.md` — technical reference (architecture, API, config)
- `SETUP.md` — environment setup
- `backend_py/RETIRE_EXPRESS.md` — v1 retirement checklist (complete)

## Key platform features

- **WebSocket chat** at `ws://host/api/chat/ws` (auto-reconnect, cancel support)
- **SSE announcement push** at `GET /api/announcements/stream`
- **Google Calendar** OAuth flow + event CRUD + sync
- **Multi-LLM** with runtime model switching (admin endpoint)
- **Prometheus metrics** at `/api/metrics`
- **Redis rate limiter** (sliding window per IP+route)
- **Strong password policy** + startup env validation + HTTPS redirect
- **Audit log** persisted to MongoDB (AuditEvent collection)
- **Frontend tests** with Vitest + React Testing Library
- **Cloud infrastructure**: MongoDB Atlas + Qdrant Cloud + Redis Cloud (no local Docker required)