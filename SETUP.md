# Setup & Installation Guide — ChatWave v2

This guide walks you through setting up ChatWave v2 (FastAPI backend + React frontend).

---

## Prerequisites

1. **Python 3.12+** (3.13 supported)
2. **Node.js 20+** (for the React frontend only)
3. **uv** (https://docs.astral.sh/uv/) — Python package manager
4. **MongoDB 7+** (local Docker or Atlas)
5. **Qdrant** (local Docker or Qdrant Cloud)
6. **Redis 6+** (local Docker or managed)
7. **Google Gemini API key** (or any LiteLLM-supported LLM key)
8. *(Optional)* **Langfuse** credentials for tracing

---

## 1. Backend (FastAPI)

```bash
cd backend_py
uv sync --all-extras
cp .env.example .env
# Edit .env: set JWT_SECRET, MONGO_URI, QDRANT_URL, REDIS_URL, GEMINI_API_KEY, etc.
```

Start the API and the worker:

```bash
# Terminal 1 — API
uv run uvicorn app.main:app --reload --port 8000

# Terminal 2 — Celery ingestion worker
uv run celery -A app.workers.celery_app.celery_app worker -l info

# Terminal 3 (optional) — Flower monitoring
uv run celery -A app.workers.celery_app.celery_app flower
```

## 2. Frontend (React)

```bash
cd frontend
cp .env.example .env
# VITE_API_BASE_URL should point at the FastAPI backend (default http://localhost:8000)
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api/*` to the FastAPI backend on `:8000`.

## 3. Required services (local Docker)

From the repo root, the `docker-compose.yml` brings up MongoDB, Qdrant, and Redis:

```bash
docker compose up -d mongo qdrant redis
```

## 4. Seeded test users

Run the seeder (Node.js only) to populate mock accounts:

```bash
cd backend
# NOTE: backend/ no longer ships with v2. The seeder is preserved in CHATWAVE-INFO.md
# as a reference implementation. For v2, register accounts via POST /api/auth/register.
```


## 5. Verify

- API health: http://localhost:8000/api/health
- API docs: http://localhost:8000/docs
- Frontend: http://localhost:5173