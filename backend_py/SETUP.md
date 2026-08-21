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
All infrastructure services (MongoDB, Qdrant, Redis) are managed in the cloud —
point the `.env` URIs at your cloud instances. No local Docker required.

| Service   | Cloud configuration |
|-----------|---------------------|
| MongoDB   | `MONGO_URI` (e.g. `mongodb+srv://...atlas...`) |
| Qdrant    | `QDRANT_URL` + `QDRANT_API_KEY` |
| Redis     | `REDIS_URL` |

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