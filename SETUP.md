# Setup & Installation Guide — ChatWave v2

This guide walks you through setting up ChatWave v2 (FastAPI backend + React frontend).

---

## Prerequisites

1. **Python 3.12+** (3.13 supported)
2. **Node.js 20+** (for the React frontend only)
3. **uv** (https://docs.astral.sh/uv/) — Python package manager
4. **Cloud-managed services** (no local Docker required):
   - **MongoDB Atlas** — connection URI in `MONGO_URI`
   - **Qdrant Cloud** — connection URL + API key in `QDRANT_URL` / `QDRANT_API_KEY`
   - **Redis Cloud** — connection URI in `REDIS_URL`
5. **Google Gemini API key** (or any LiteLLM-supported LLM key)
6. *(Optional)* **Langfuse** credentials for tracing

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

## 3. Required services (cloud)

All infrastructure services (MongoDB, Qdrant, Redis) are configured to point at
cloud providers via `backend_py/.env`:

- **MongoDB Atlas** — `MONGO_URI`
- **Qdrant Cloud** — `QDRANT_URL` + `QDRANT_API_KEY`
- **Redis Cloud** — `REDIS_URL`

No local Docker is required — just ensure the URIs in `.env` are reachable
from your machine.

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