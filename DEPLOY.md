# Deploying ChatWave to Render

Production topology for this repo on [Render](https://render.com): one **Web Service** (FastAPI), one **Background Worker** (Celery), one **Static Site** (React build). MongoDB/Qdrant/Redis stay on their existing clouds (Atlas / Qdrant Cloud / Redis Cloud).

```
Browser ──HTTPS──▶ Static Site (frontend dist)      ──fetch/WS──▶ Web Service :443 (uvicorn, workers=1)
                                                                     │ Celery broker=Redis Cloud
                                                     Background Worker (celery --pool=solo)
                                                                     ▼
                                     MongoDB Atlas · Qdrant Cloud · Redis Cloud · Gemini API
```

> **Why workers=1:** the SSE announcement bus is in-process (`events/announcement_bus.py`). Scale to multiple uvicorn workers only after swapping it for Redis pub/sub. The rate limiter, model override, and Celery broker are already Redis-backed and multi-worker safe.

---

## 0. Before you start

- [ ] Code pushed to GitHub (`main`) — CI green on both workflows.
- [ ] Secrets ready: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET` (**≥32 chars each**, e.g. `openssl rand -base64 48`), `MONGO_URI`, `QDRANT_URL`+`QDRANT_API_KEY` (**rotate if it ever appeared in shared notes/logs**), `REDIS_URL`, `GEMINI_API_KEY`.
- [ ] Google OAuth (optional): client id/secret; redirect URI will be `https://<api-service>.onrender.com/api/calendar/oauth/callback`.
- [ ] Decide subdomains up front — CORS/OAuth/cookies depend on them (e.g. `chatwave-api.onrender.com`, `chatwave.onrender.com`).

---

## 1. Web Service (API)

| Setting | Value |
|---|---|
| Type | Web Service → "Build and deploy from a Git repository" |
| Root Directory | `backend_py` |
| Runtime | Python 3 |
| Build Command | `pip install uv && uv sync --all-extras` |
| Start Command | `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1` |
| Health Check Path | `/api/health/live` |
| Plan | Starter minimum (free tier spins down → ~50 s cold starts break WS demos) |

### Environment variables (Web Service)

| Key | Value |
|---|---|
| `APP_ENV` | `production` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` / `CSRF_SECRET` | your generated ≥32-char secrets |
| `MONGO_URI` | Atlas SRV URI |
| `QDRANT_URL` / `QDRANT_API_KEY` | Qdrant Cloud endpoint + key |
| `REDIS_URL` | Redis Cloud TLS URL (`rediss://…`) |
| `GEMINI_API_KEY` | Google AI Studio key |
| `CHAT_MODEL` / `EMBEDDING_MODEL` | `gemini/gemini-3.6-flash` / `gemini/gemini-embedding-001` |
| `EMBEDDING_DIM` | `3072` |
| `FRONTEND_URL` | `https://<static-site>.onrender.com` |
| `ADDITIONAL_CORS_ORIGINS` | `https://<static-site>.onrender.com` (exact origin; credentials mode forbids wildcards) |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | optional; redirect = `https://<api>.onrender.com/api/calendar/oauth/callback` |
| `LANGFUSE_*` | optional |

Render injects `PORT`; the start command binds to it.

---

## 2. Background Worker (Celery)

| Setting | Value |
|---|---|
| Type | Background Worker |
| Root Directory | `backend_py` |
| Build Command | same as Web Service |
| Start Command | `uv run celery -A app.workers.celery_app.celery_app worker -l info --pool=solo` |

Copy the **same environment variables** as the Web Service (broker/result backend derive from `REDIS_URL`). `--pool=solo` is intentional: one task at a time, no fork issues, matches the single-task design.

**Disk (recommended):** attach a Render Disk mounted at `/opt/render/project/src/backend_py/uploads`. Without it, ingested source bytes live on ephemeral storage — documents still work after redeploy, but *retry* needs a re-upload.

---

## 3. Static Site (frontend)

| Setting | Value |
|---|---|
| Type | Static Site |
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Rewrite Rule | `/* → /index.html` (SPA routing) |

Environment variables (build-time only):

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://<api-service>.onrender.com` |
| `VITE_DEMO_MODE` | leave unset in production |

The SPA calls the API cross-origin: that's why `ADDITIONAL_CORS_ORIGINS` must list the static-site origin exactly, and why cookies require `FRONTEND_URL` to match it too.

---

## 4. Managed-cloud checklist

- [ ] **MongoDB Atlas → Network Access:** add Render's egress IPs (Static Outbound IPs are shown on the service page; requires a paid instance role) or `0.0.0.0/0` for quick demos.
- [ ] **Qdrant Cloud:** new API key rotated in; URL reachable from Render region.
- [ ] **Redis Cloud:** TLS URL (`rediss://`); note the port.
- [ ] **Gemini:** key has embedding + chat model access; free tier throttles book-scale ingestion (backoff handles it).

## 5. Post-deploy smoke (in order)

1. `https://<api>/api/health/live` → `{"status":"alive"}`; then `/api/health` shows all four services true.
2. One-off shell on the Web Service: `uv run python -m scripts.seed_db`.
3. Open the static site → login `CW-STUDENT / Password@123`.
4. General-mode question → streaming answer.
5. Faculty login → upload a small PDF → wait for `completed`.
6. Student, college mode → cited answer naming the file.
7. Admin → switch model → repeat a question → response `model` field changes → reset.
8. Register a second college → same question clarifies/refuses → isolation proven.

## 6. Production caveats (all deliberate, all documented)

| Caveat | Detail | Upgrade path |
|---|---|---|
| Single API worker | SSE announcement bus is in-process | swap bus for Redis pub/sub, then raise `--workers` |
| Ephemeral disk without Disk attachment | retry-after-redeploy needs re-upload | attach Disk (§2) or S3 adapter behind `storage_path` |
| Free-tier spin-down | ~50 s cold start kills interactive WS demos | Starter plan for demo periods |
| Free-tier LLM quotas | book ingestion crawls via backoff | paid tier removes throttling |
| X-Forwarded-For trusted | correct behind Render's proxy | already the deployment assumption |
| HTTPS redirect + secure cookies | automatic under `APP_ENV=production` | never serve prod over plain HTTP |

## 7. Local production rehearsal

Rehearse the prod code paths locally before deploying:

```bash
# from backend_py — process-scoped env only, .env untouched
$env:APP_ENV="production"; $env:FRONTEND_URL="https://rehearsal.example.com"
$env:JWT_SECRET=("p"*48); $env:JWT_REFRESH_SECRET=("r"*48); $env:CSRF_SECRET=("c"*48)
uv run uvicorn app.main:app --port 8001
# expect: boot clean, then GET http://localhost:8001/api/health/live → 301 → https
```

Verified during the audit: boot clean + HTTP→HTTPS 301 on health/live.
