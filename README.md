# ChatWave — Multi-tenant Agentic AI Platform

> **Current versions:**
> - **v2 (FastAPI + AI stack)** — `backend_py/` (FastAPI + Beanie + LangGraph + LlamaIndex + Qdrant + LiteLLM + Celery + Langfuse)
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
cp .env.example .env       # edit secrets
docker compose up -d mongo qdrant redis   # from repo root
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
├── backend_py/            FastAPI + Beanie + LangGraph + LlamaIndex + Qdrant + LiteLLM
├── frontend/              React 19 + Vite (proxies /api to FastAPI :8000)
├── specs/                 Source-of-truth spec for v2
├── CHATWAVE-INFO.md       v1 reference + transition plan (historical)
├── .github/workflows/     CI for backend_py (ruff + pytest)
└── docker-compose.yml     Local Mongo + Qdrant + Redis
```

## Stack highlights

- **API**: FastAPI on Python 3.12+
- **Data models**: Pydantic v2 + Beanie ODM
- **Primary DB**: MongoDB
- **Vector DB**: Qdrant (per-tenant collections)
- **RAG framework**: LlamaIndex
- **Agent orchestration**: LangGraph
- **Model gateway**: LiteLLM
- **Background jobs**: Celery + Redis
- **Parsing**: Docling primary, fallback loaders as needed
- **Observability**: Langfuse
- **Evals**: Ragas + DeepEval
- **Frontend**: React 19 + Vite

## More

- `specs/` — full specification (must-read)
- `CHATWAVE-INFO.md` — v1 reference + transition plan
- `SETUP.md` — environment setup
- `backend_py/RETIRE_EXPRESS.md` — v1 retirement checklist (complete)