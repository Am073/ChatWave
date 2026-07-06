# ChatWave v2 — FastAPI Backend

Multi-tenant agentic AI platform for educational institutions.
Built on FastAPI + Beanie + LangGraph + LlamaIndex + Qdrant + LiteLLM + Celery + Langfuse.

See `/specs` for the source-of-truth specification and migration plan.

## Quick start (uv)

```bash
# 1. Install uv (https://docs.astral.sh/uv/)
# 2. From this directory:
uv sync --all-extras

# 3. Configure env
cp .env.example .env
# Edit .env: set JWT_SECRET, MONGO_URI, QDRANT_URL, REDIS_URL, GEMINI_API_KEY, etc.

# 4. Start supporting services
docker compose up -d mongo qdrant redis   # or use your own

# 5. Run API
uv run uvicorn app.main:app --reload

# 6. Run Celery worker
uv run celery -A app.workers.celery_app.celery_app worker -l info

# 7. (Optional) Run Flower
uv run celery -A app.workers.celery_app.celery_app flower
```

## API surface

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/auth/register` | – |
| `POST` | `/api/auth/login` | – |
| `POST` | `/api/auth/logout` | + CSRF |
| `POST` | `/api/auth/refresh` | cookie |
| `POST` | `/api/auth/change-password` | + CSRF |
| `GET`  | `/api/auth/me` | – |
| `GET`  | `/api/auth/csrf-token` | – |
| `POST` | `/api/chat` | + CSRF |
| `GET`  | `/api/chat/history` | – |
| `DELETE` | `/api/chat/history` | + CSRF |
| `GET`  | `/api/chat/stream` | – (cookie auth) |
| `POST` | `/api/upload` | + CSRF + faculty/admin |
| `GET`  | `/api/upload` | – |
| `GET`  | `/api/upload/{id}/status` | – |
| `DELETE` | `/api/upload/{id}` | + CSRF |
| `GET`  | `/api/announcements` | – |
| `POST` | `/api/announcements` | + CSRF + faculty/admin |
| `GET`  | `/api/admin/stats` | admin |
| `GET`  | `/api/admin/health` | admin |
| `GET`  | `/api/admin/quality` | admin |
| `GET`  | `/api/health` | – |

## Architecture

```
backend_py/
├── pyproject.toml
├── .env.example
├── Dockerfile
├── README.md
└── app/
    ├── main.py                   FastAPI factory + lifespan
    ├── core/                     config, logging, errors, security, db
    ├── api/                      routes + dependencies
    │   ├── deps.py               auth/RBAC/tenant/CSRF
    │   └── routes/               auth, chat, upload, announcements, admin, calendar, health
    ├── models/                   Beanie documents: User, DocumentRecord, ...
    ├── schemas/                  Pydantic request/response
    ├── services/                 auth, chat, upload, retrieval, ingestion, admin
    ├── agents/                   LangGraph graph + state + tools + prompts
    ├── rag/                      citations + chunking helpers
    ├── workers/                  Celery app + ingestion task
    ├── observability/            Langfuse tracing bridge
    ├── guardrails/               injection, output, access policy
    ├── evals/                    datasets + Ragas/DeepEval runners
    └── tests/                    pytest
```

## Development

```bash
uv run pytest
uv run ruff check .
uv run python -m app.evals.run_agent_evals
```

## More

- `/specs` — full specification (must-read)
- `CHATWAVE-INFO.md` (repo root) — v1 reference + transition plan
- `SETUP.md` (repo root) — environment setup across the monorepo