# ChatWave v2 — Express Retirement Checklist

The Express `backend/` has been **retired** (deleted from the repo) as of this
release. All parity checklist items below were satisfied before retirement.

## ✅ Parity checklist (complete)

- [x] Register
- [x] Login
- [x] Logout
- [x] Current user
- [x] Role-based route protection
- [x] Document upload
- [x] Ingestion status
- [x] Document delete
- [x] Chat answer
- [x] Chat sources
- [x] Chat history
- [x] Announcement list/create
- [x] Admin stats
- [x] Admin health
- [x] Streaming answer (SSE at `/api/chat/stream`)
- [x] Tenant isolation

## Rollback path

The Express `backend/` is no longer in the repo. To restore it for
emergency rollback, see `CHATWAVE-INFO.md` and the v1 git history.

`docker compose up` still brings up Mongo + Qdrant + Redis.
Frontend `VITE_API_BASE_URL` is the only switch needed to point at FastAPI.