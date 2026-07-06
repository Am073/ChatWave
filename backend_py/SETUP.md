# ChatWave v2 — Environment Setup

## Python
- 3.12+ required (3.13 supported)
- Use `uv` as the package manager (https://docs.astral.sh/uv/)

## First-time setup
```bash
cd backend_py
uv sync --all-extras
cp .env.example .env
# Edit .env with your real secrets
```

## Required services
You can run them locally via `docker compose up -d mongo qdrant redis`
(from the repo root) or point the `.env` at managed instances.

| Service | Default URL |
|---------|-------------|
| MongoDB | `mongodb://localhost:27017/chatwave` |
| Qdrant  | `http://localhost:6333` |
| Redis   | `redis://localhost:6379/0` |

## External APIs
- **Gemini API key** (or any other LLM provider supported by LiteLLM)
- **Langfuse** (optional, for tracing)

## Common commands
```bash
uv run uvicorn app.main:app --reload          # API
uv run celery -A app.workers.celery_app.celery_app worker -l info   # worker
uv run pytest                                   # tests
uv run ruff check .                             # lint
uv run python -m app.evals.run_agent_evals      # guardrail eval smoke test
```