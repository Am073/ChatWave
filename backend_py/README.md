# ChatWave v2 — FastAPI Backend

Multi-tenant agentic AI platform for educational institutions.
Built on FastAPI + Beanie + LangGraph + Qdrant + LiteLLM + Celery + Langfuse.

See `/specs` for the source-of-truth specification and migration plan.

## Quick start (uv)

```bash
# 1. Install uv (https://docs.astral.sh/uv/)
# 2. From this directory:
uv sync --all-extras

# 3. Configure env
cp .env.example .env
# Edit .env: set JWT_SECRET, MONGO_URI, QDRANT_URL, REDIS_URL, GEMINI_API_KEY, etc.
# (URIs should point at your cloud instances — MongoDB Atlas, Qdrant Cloud, Redis Cloud)

# 4. Run API
uv run uvicorn app.main:app --reload

# 5. Run Celery worker
uv run celery -A app.workers.celery_app.celery_app worker -l info

# 6. (Optional) Run Flower
uv run celery -A app.workers.celery_app.celery_app flower
```

## API surface

Auth column: **cookie** = valid `access_token` HttpOnly cookie required; **CSRF** = `X-CSRF-Token` header must match the double-submit cookie.

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/auth/register` | – |
| `POST` | `/api/auth/login` | – |
| `POST` | `/api/auth/logout` | cookie + CSRF |
| `POST` | `/api/auth/refresh` | refresh cookie |
| `POST` | `/api/auth/change-password` | cookie + CSRF |
| `GET`  | `/api/auth/me` | cookie |
| `GET`  | `/api/auth/csrf-token` | – |
| `POST` | `/api/chat` | cookie + CSRF |
| `WS`   | `/api/chat/ws` | cookie (upgrade handshake) |
| `GET`  | `/api/chat/stream` | cookie (SSE) |
| `GET` | `/api/chat/history` | cookie |
| `DELETE` | `/api/chat/history` | cookie + CSRF |
| `POST` | `/api/upload` | cookie + CSRF + faculty/admin |
| `GET`  | `/api/upload` | cookie |
| `GET`  | `/api/upload/{id}/status` | cookie |
| `DELETE` | `/api/upload/{id}` | cookie + CSRF |
| `GET`/`POST` | `/api/announcements` | GET cookie · POST cookie + CSRF + faculty/admin |
| `GET`  | `/api/admin/stats` | admin |
| `GET`  | `/api/admin/health` | admin |
| `GET`  | `/api/admin/quality` | admin |
| `GET`  | `/api/admin/mcp/tools` | admin |
| `GET`  | `/api/health` | – |

## Architecture

```
backend_py/
├── pyproject.toml
├── .env.example
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
    ├── mcp/                      MCP tool surface (server + client dispatch)
    ├── events/                   In-process announcement pub/sub (SSE)
    ├── observability/            Langfuse tracing + Prometheus metrics
    ├── guardrails/               injection detector, output validator, audit log
    ├── evals/                    datasets + DeepEval runners (offline + --live)
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