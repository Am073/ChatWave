# ChatWave — Complete Technical Documentation

**Version:** 2.0.0  
**Last updated:** July 6, 2026  
**Stack:** FastAPI + React 19 + MongoDB Atlas + Qdrant Cloud + Redis Cloud  
**Architecture:** Multi-tenant agentic AI platform for educational institutions

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Project Directory Map](#3-project-directory-map)
4. [Backend Architecture](#4-backend-architecture)
   - 4.1 Application Factory & Lifespan
   - 4.2 Configuration System
   - 4.3 Database Connections
   - 4.4 Middleware Stack
   - 4.5 Route Registry
5. [API Reference](#5-api-reference)
   - 5.1 Health
   - 5.2 Authentication
   - 5.3 Chat
   - 5.4 Upload
   - 5.5 Announcements
   - 5.6 Calendar
   - 5.7 Admin
6. [Data Models (Beanie/MongoDB)](#6-data-models-beaniemongodb)
7. [Schemas (Pydantic)](#7-schemas-pydantic)
8. [AI Agent Architecture](#8-ai-agent-architecture)
   - 8.1 LangGraph State Machine
   - 8.2 Agent State
   - 8.3 Agent Tools (MCP-backed)
   - 8.4 Langfuse Observability
9. [Services Layer](#9-services-layer)
10. [Security Architecture](#10-security-architecture)
    - 10.1 Authentication (JWT)
    - 10.2 CSRF Double-Submit
    - 10.3 Role-Based Access Control
    - 10.4 Tenant Isolation
    - 10.5 Rate Limiting
    - 10.6 Password Policy
11. [Guardrails & Audit](#11-guardrails--audit)
12. [Observability](#12-observability)
    - 12.1 Prometheus Metrics
    - 12.2 Structured Logging
    - 12.3 Langfuse Tracing
13. [Background Workers (Celery)](#13-background-workers-celery)
14. [MCP (Model Context Protocol)](#14-mcp-model-context-protocol)
15. [Event System](#15-event-system)
16. [Frontend Architecture](#16-frontend-architecture)
17. [Cloud Infrastructure](#17-cloud-infrastructure)
18. [Testing](#18-testing)
19. [Local Development Setup](#19-local-development-setup)
20. [CI/CD](#20-cicd)
21. [Key Technical Decisions & Trade-offs](#21-key-technical-decisions--trade-offs)

---

## 1. Executive Summary

ChatWave is a production-grade, multi-tenant agentic AI platform for educational institutions. It allows students, faculty, and administrators to search and interact with institutional knowledge bases (syllabi, schedules, regulations, documents) scoped dynamically to their college and department.

### Core Non-negotiable Properties

1. **Tenant isolation** — college data must not leak across colleges.
2. **Role-based access control** — student, faculty, and admin flows are enforced in route dependencies and agent tools.
3. **Source grounding** — institutional answers cite retrieved sources or ask for clarification/refuse.
4. **Observability and auditability** — every chat carries a trace ID, tool calls are recorded to an audit log, and Prometheus metrics track all requests.

### Personas

| Role | Capabilities |
|------|--------------|
| **Student** | Chat with AI, view announcements, manage settings, Google Calendar integration |
| **Faculty** | All student features + upload documents, publish announcements |
| **Admin** | All faculty features + manage users, view health/activity/stats, switch runtime AI model, inspect audit logs, manage documents |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                   │
│            Vite dev server :5173 → proxies /api          │
│  Components: Chat, Upload, Admin, Settings, Calendar     │
│  State: TanStack Query + Context API                     │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP / WebSocket / SSE
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                     │
│                     Uvicorn :8000                        │
│                                                         │
│  Middleware Stack (order of application):                │
│  1. Security Headers (CSP, HSTS, X-Frame-Options)       │
│  2. GZip Compression                                    │
│  3. CORS                                                │
│  4. TrustedHost (if additional origins configured)       │
│  5. HTTPS Redirect (production only)                    │
│  6. Rate Limiter (Redis sliding window)                  │
│  7. Request Logging (structlog)                          │
│  8. Prometheus Metrics                                   │
│                                                         │
│  Routes: /api/*                                          │
│  Agent: LangGraph 5-node state machine                   │
│  MCP: Model Context Protocol tools                       │
└───────┬──────────────┬──────────────┬───────────────────┘
        │              │              │
        ▼              ▼              ▼
  MongoDB Atlas   Qdrant Cloud    Redis Cloud
  (Beanie ODM)    (Vector DB)     (Rate limit +
                                   Celery broker)
```

---

## 3. Project Directory Map

```
chatWave/
├── README.md                        # Project overview
├── SETUP.md                         # Environment setup guide
├── CHATWAVE-INFO.md                 # This document
├── BUILD_SUMMARY.md                 # Development phase summary
├── PROJECT_DEEP_DIVE.md             # Interview Q&A preparation
├── specs/                           # v2 architecture specification
│   ├── spec.md                      # Architecture spec
│   └── api-contract.md              # API contract
│
├── backend_py/                      # FastAPI backend (Python 3.12+)
│   ├── .env                         # Environment variables (gitignored)
│   ├── .env.example                 # Environment template
│   ├── pyproject.toml               # Dependencies & tooling config
│   ├── uv.lock                      # Lockfile for uv
│   │
│   ├── app/
│   │   ├── main.py                  # FastAPI app factory + lifespan
│   │   │
│   │   ├── core/                    # Core infrastructure
│   │   │   ├── config.py            # Pydantic Settings (all env vars)
│   │   │   ├── db.py                # DB connection management
│   │   │   ├── security.py          # JWT, password hashing, CSRF
│   │   │   ├── errors.py            # Unified error classes + handlers
│   │   │   ├── logging.py           # Structlog configuration
│   │   │   ├── env_validation.py    # Startup config validation
│   │   │   ├── rate_limiter.py      # Redis sliding-window rate limiter
│   │   │   ├── passwords.py         # Password strength validation
│   │   │   └── request_logging.py    # Request/response structured logging
│   │   │
│   │   ├── api/
│   │   │   ├── deps.py              # Auth, RBAC, CSRF dependencies
│   │   │   └── routes/
│   │   │       ├── health.py        # /api/health, /api/health/live, /api/metrics
│   │   │       ├── auth.py          # /api/auth/* (register, login, logout, etc.)
│   │   │       ├── chat.py          # /api/chat/* (answer, history, WS, SSE)
│   │   │       ├── upload.py         # /api/upload/* (upload, list, status, delete)
│   │   │       ├── announcements.py # /api/announcements/* (CRUD, SSE stream)
│   │   │       ├── admin.py         # /api/admin/* (stats, users, docs, model, MCP)
│   │   │       └── calendar.py      # /api/calendar/* (OAuth, events, sync, dates)
│   │   │
│   │   ├── models/                  # Beanie ODM documents (MongoDB)
│   │   │   ├── user.py              # User document
│   │   │   ├── document.py          # DocumentRecord document
│   │   │   ├── announcement.py      # Announcement document
│   │   │   ├── chat_log.py          # ChatLog document
│   │   │   ├── calendar_event.py    # CalendarEvent document
│   │   │   ├── google_token.py      # UserGoogleToken (encrypted OAuth)
│   │   │   └── audit_event.py       # AuditEvent document
│   │   │
│   │   ├── schemas/                 # Pydantic request/response models
│   │   │   ├── auth.py              # RegisterIn, LoginIn, ChangePasswordIn, etc.
│   │   │   ├── chat.py              # ChatIn, SourceOut, ChatResponse
│   │   │   ├── admin.py             # AdminUserCreateIn, AdminUserUpdateIn
│   │   │   └── announcement.py      # AnnouncementCreateIn
│   │   │
│   │   ├── services/                # Business logic layer
│   │   │   ├── auth_service.py      # Register, login, logout, refresh, password change
│   │   │   ├── chat_service.py      # RAG orchestration, history, date detection
│   │   │   ├── upload_service.py    # File validation, persistence, ingestion queue
│   │   │   ├── admin_service.py     # Stats, quality, user CRUD, document listing
│   │   │   ├── calendar_service.py  # Google OAuth flow + Calendar API (no SDK)
│   │   │   ├── date_extractor.py    # NLP date detection from unstructured text
│   │   │   ├── model_registry.py    # Runtime model switching (in-memory)
│   │   │   ├── retrieval_service.py # Qdrant vector search + hybrid filter
│   │   │   └── ingestion_service.py # Document parsing, chunking, embedding
│   │   │
│   │   ├── agents/                  # LangGraph agent
│   │   │   ├── state.py             # AgentState (typed Pydantic model)
│   │   │   ├── graph.py             # 5-node state machine
│   │   │   ├── tools.py             # search_documents + get_announcements
│   │   │   └── prompts.py           # System + answer prompt templates
│   │   │
│   │   ├── guardrails/
│   │   │   ├── audit.py             # Tool call audit (MongoDB + file + Langfuse)
│   │   │   ├── injection.py         # Prompt injection detection
│   │   │   └── output.py            # Output guardrail validation
│   │   │
│   │   ├── observability/
│   │   │   ├── tracing.py           # Langfuse tracing (NoOp fallback)
│   │   │   └── metrics.py           # Prometheus counters/histograms
│   │   │
│   │   ├── events/
│   │   │   └── announcement_bus.py  # In-process pub/sub for SSE announcements
│   │   │
│   │   ├── mcp/
│   │   │   ├── server.py            # MCP server (FastMCP) tool definitions
│   │   │   └── client.py            # MCP client for LangGraph agent
│   │   │
│   │   ├── workers/
│   │   │   ├── celery_app.py        # Celery app configuration
│   │   │   └── ingestion_tasks.py   # Document ingestion task (parse → chunk → embed)
│   │   │
│   │   ├── rag/
│   │   │   ├── citations.py         # Citation building, refusal, clarification
│   │   │   └── chunking.py          # Document chunking strategies
│   │   │
│   │   ├── evals/
│   │   │   ├── datasets.py          # Evaluation datasets
│   │   │   └── run_agent_evals.py   # Ragas/DeepEval evaluation runners
│   │   │
│   │   └── tests/                   # Pytest test suite (12 test files)
│   │       ├── conftest.py          # Fixtures: event_loop, db_session, client
│   │       ├── test_auth.py
│   │       ├── test_agent_graph.py
│   │       ├── test_audit.py
│   │       ├── test_date_extractor.py
│   │       ├── test_evals.py
│   │       ├── test_guardrails.py
│   │       ├── test_ingestion.py
│   │       ├── test_rbac.py
│   │       ├── test_retrieval.py
│   │       ├── test_tenant_isolation.py
│   │       └── test_* (more)
│   │
│   ├── RETIRE_EXPRESS.md            # v1 Express backend retirement notes
│   └── SETUP.md                     # Backend-specific setup
│
├── frontend/                        # React 19 + Vite
│   ├── .env.example                 # VITE_API_BASE_URL config
│   ├── package.json                 # Dependencies & scripts
│   ├── vite.config.js               # Vite config (proxy /api → :8000)
│   ├── tailwind.config.js           # Tailwind CSS config
│   ├── vitest.config.js             # Vitest test configuration
│   │
│   └── src/
│       ├── main.jsx                 # React entry point
│       ├── App.jsx                  # Router + QueryClient + AuthProvider
│       ├── index.css                # Tailwind imports + global styles
│       │
│       ├── components/
│       │   ├── Chat/                # ChatWindow, ChatMessage, CalendarButton, BulkDatePicker
│       │   ├── Admin/               # AdminDashboard, ModelSwitcher, DocumentTable
│       │   ├── Upload/              # DocumentUpload, UploadedDocumentsList
│       │   ├── Settings/            # GoogleCalendarSection, PasswordSection
│       │   ├── Feed/                # AnnouncementFeed component
│       │   ├── Layout/              # App layout, navigation, sidebar
│       │   ├── Three/               # ThreeBackground (3D animated background)
│       │   └── __tests__/           # Component tests
│       │
│       ├── hooks/                   # Custom React hooks
│       │   ├── useChatStream.js      # WebSocket chat hook
│       │   ├── useCalendarIntegration.js
│       │   ├── useAnnouncementStream.js  # SSE announcement hook
│       │   └── __tests__/           # Hook tests
│       │
│       ├── services/                # API client services
│       │   ├── api.js               # Axios instance with interceptors
│       │   ├── authService.js       # Login, register, logout, refresh
│       │   ├── chatService.js       # Chat API + streaming
│       │   ├── adminService.js      # Admin dashboard API
│       │   ├── uploadService.js     # Document upload API
│       │   ├── calendarService.js   # Google Calendar API
│       │   └── __tests__/           # Service tests
│       │
│       ├── pages/                   # Page components
│       │   ├── LoginPage.jsx
│       │   ├── StudentDashboard.jsx
│       │   ├── FacultyDashboard.jsx
│       │   ├── AdminDashboard.jsx
│       │   └── SettingsPage.jsx
│       │
│       ├── context/                 # React Context providers
│       │   └── AuthContext.jsx       # Auth state management
│       │
│       ├── utils/                   # Utility functions
│       │   └── dateFormat.js
│       │
│       └── test/
│           └── setup.js             # Vitest setup (jsdom + RTL matchers)
│
├── .github/workflows/
│   ├── chatwave-backend-py.yml      # Backend CI (ruff + pytest)
│   └── chatwave-frontend-ci.yml     # Frontend CI (Vitest)
│
├── specs/
│   ├── spec.md                      # Full architecture specification
│   └── api-contract.md              # API contract documentation
│
├── .gitignore                       # Git ignore rules
└── skills-lock.json                 # Agent skill metadata (not runtime)
```

---

## 4. Backend Architecture

### 4.1 Application Factory & Lifespan (`app/main.py`)

The app is built via a `create_app()` factory pattern. The lifespan context manager handles startup/shutdown:

**Startup:**
1. `setup_logging()` — configure structlog
2. `validate_required_env()` — fail-fast on misconfigured environment variables (production only)
3. `connect_mongodb()` — initialize Motor client + Beanie ODM for 7 document models

**Shutdown:**
1. `close_mongodb()` — close Motor client
2. `close_qdrant()` — close Qdrant client
3. `close_redis()` — close Redis client

### 4.2 Configuration System (`app/core/config.py`)

Uses `pydantic-settings` (`BaseSettings`). Reads from `.env` file automatically. Key configuration groups:

| Group | Variables |
|-------|-----------|
| Runtime | `APP_ENV`, `BACKEND_PORT`, `API_PREFIX` |
| Security | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`, token expirations |
| Database | `MONGO_URI` (MongoDB Atlas), `QDRANT_URL` + `QDRANT_API_KEY` (Qdrant Cloud), `REDIS_URL` (Redis Cloud) |
| LLM | `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CHAT_MODEL`, `EMBEDDING_MODEL` |
| Langfuse | `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_HOST` |
| CORS | `FRONTEND_URL`, `ADDITIONAL_CORS_ORIGINS` |
| Upload | `MAX_UPLOAD_MB`, `ALLOWED_MIME_TYPES` |
| Agent | `AGENT_MAX_ITERATIONS`, `RETRIEVAL_TOP_K`, `PROMPT_VERSION` |
| Rate Limit | `RATE_LIMIT_ENABLED`, per-route limits |
| Google OAuth | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, redirect URI |

Computed properties: `is_production`, `cors_origins`, `effective_broker_url`, `available_providers`, `available_chat_models`.

### 4.3 Database Connections (`app/core/db.py`)

Three lazy singleton connections:

- **MongoDB**: `AsyncIOMotorClient` via `motor`. Beanie ODM auto-manages collections from document models. Connection failures at startup do NOT abort booting — the health endpoint reports `mongodb: false` so the API stays responsive.
- **Qdrant**: `AsyncQdrantClient` with URL + API key auth. Lazy-initialized on first use.
- **Redis**: `redis.asyncio.Redis.from_url()`. Used for rate limiting + Celery broker.

Health check functions: `ping_mongodb()`, `ping_qdrant()`, `ping_redis()`, `ping_llm()`.

### 4.4 Middleware Stack

Applied in this order (last applied runs first on the request side):

1. **Security Headers** — HSTS (prod), X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
2. **GZip Middleware** — compresses responses ≥ 1024 bytes
3. **CORS Middleware** — configured origins, credentials, exposed X-CSRF-Token header
4. **TrustedHost Middleware** — restricts allowed hosts (prod only)
5. **HTTPS Redirect Middleware** — redirects HTTP → HTTPS (prod only)
6. **RateLimit Middleware** — Redis-backed sliding window per IP+route
7. **RequestLogging Middleware** — structlog every request with method, path, status, duration, user_id
8. **Prometheus Middleware** — record request count + latency histograms

Exception handlers: unified `AppError` → JSON response, catch-all 500 handler.

### 4.5 Route Registry

All routes are registered under `/api` prefix:

| Router | Prefix | Key Methods |
|--------|--------|-------------|
| health | `/api` | `GET /health`, `GET /health/live`, `GET /metrics` |
| auth | `/api/auth` | POST register, login, logout, refresh, change-password; GET csrf-token, me |
| chat | `/api/chat` | POST (answer), GET history, DELETE history, GET stream (SSE), WS /ws |
| upload | `/api/upload` | POST (upload), GET (list), GET /{id}/status, DELETE /{id}, POST /{id}/retry |
| announcements | `/api/announcements` | GET (list), POST (create), GET /stream (SSE), PUT /{id}/read, DELETE /{id} |
| calendar | `/api/calendar` | GET status, GET auth, GET oauth/callback, POST events, GET events, DELETE events, POST sync, DELETE disconnect, POST extract-dates, POST events/bulk |
| admin | `/api/admin` | GET stats, health, activity, quality, users, documents, model, mcp/tools; POST/DELETE users, documents |

---

## 5. API Reference

### 5.1 Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | None | Full readiness: pings MongoDB, Qdrant, Redis, checks LLM config |
| `GET` | `/api/health/live` | None | Simple liveness probe: returns `{"status": "alive"}` |
| `GET` | `/api/metrics` | None | Prometheus metrics in text format |

**Health response:**
```json
{
  "status": "ok" | "degraded",
  "version": "2.0.0",
  "services": {
    "mongodb": true,
    "qdrant": true,
    "redis": true,
    "llm": { "ok": true, "chat_model": "...", "embedding_model": "...", "gateway": "litellm" }
  }
}
```

### 5.2 Authentication

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| `POST` | `/api/auth/register` | No | No | Create account (name, college_id, password, college_name, department, role) |
| `POST` | `/api/auth/login` | No | No | Login with college_id/email + password + role |
| `POST` | `/api/auth/logout` | Yes | Yes | Clear session, invalidate refresh token |
| `POST` | `/api/auth/refresh` | Cookie | No | Rotate access token using refresh token cookie |
| `POST` | `/api/auth/change-password` | Yes | Yes | Change password (old + new) |
| `GET` | `/api/auth/csrf-token` | No | No | Issue CSRF token cookie + X-CSRF-Token header |
| `GET` | `/api/auth/me` | Cookie | No | Return current user info |

**Security design:**
- Access token: JWT, 15-minute expiry, stored in HttpOnly cookie
- Refresh token: JWT, 7-day expiry, stored in HttpOnly cookie, bcrypt hash stored on User document
- CSRF: Double-submit cookie pattern (both cookie and X-CSRF-Token header required for mutations)

### 5.3 Chat

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| `POST` | `/api/chat` | Yes | Yes | Single-turn Q&A (runs LangGraph agent) |
| `GET` | `/api/chat/history` | Yes | No | Paginated chat history (page, limit) |
| `DELETE` | `/api/chat/history` | Yes | Yes | Clear all chat history |
| `GET` | `/api/chat/stream` | Yes | No | SSE streaming chat (question as query param) |
| `WS` | `/api/chat/ws` | Cookie | No | WebSocket bidirectional streaming chat |

**WebSocket protocol (JSON messages):**

Client → Server:
- `{"type": "question", "content": "...", "model": "...", "sessionId": "..."}`
- `{"type": "cancel"}`
- `{"type": "ping"}`

Server → Client:
- `{"type": "ready", "userId": "...", "sessionId": "..."}`
- `{"type": "status", "stage": "searching"|"started"|"answered"|"cancelled"}`
- `{"type": "sources", "sources": [...]}`
- `{"type": "token", "content": "..."}` (streamed in 4-char chunks)
- `{"type": "final", "answer": "...", "traceId": "...", "model": "...", "confidence": "...", "detectedDates": [...]}`
- `{"type": "error", "message": "..."}`
- `{"type": "pong"}`

### 5.4 Upload

| Method | Path | Auth | CSRF | Role | Description |
|--------|------|------|------|------|-------------|
| `POST` | `/api/upload` | Yes | Yes | Faculty/Admin | Upload document (multipart form) |
| `GET` | `/api/upload` | Yes | No | Any | List uploaded documents |
| `GET` | `/api/upload/{id}/status` | Yes | No | Any | Get document ingestion status |
| `DELETE` | `/api/upload/{id}` | Yes | Yes | Uploader/Admin | Delete document |
| `POST` | `/api/upload/{id}/retry` | Yes | Yes | Uploader/Admin | Re-enqueue failed document |

Upload returns `202 Accepted` with `documentId` — ingestion happens async via Celery.

### 5.5 Announcements

| Method | Path | Auth | CSRF | Role | Description |
|--------|------|------|------|------|-------------|
| `GET` | `/api/announcements` | Yes | No | Any | List tenant-scoped announcements |
| `POST` | `/api/announcements` | Yes | Yes | Faculty/Admin | Create announcement |
| `GET` | `/api/announcements/stream` | Yes | No | Any | SSE live stream of new announcements |
| `PUT` | `/api/announcements/{id}/read` | Yes | Yes | Any | Mark announcement as read |
| `DELETE` | `/api/announcements/{id}` | Yes | Yes | Author/Admin | Delete announcement |

Non-admin users see: college_wide announcements (department=null) OR their own department announcements. Admins see all within their tenant.

### 5.6 Calendar

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| `GET` | `/api/calendar/status` | Yes | No | Check Google Calendar connection status |
| `GET` | `/api/calendar/auth` | Yes | No | Get Google OAuth authorization URL |
| `GET` | `/api/calendar/oauth/callback` | No | No | OAuth callback (redirects to frontend) |
| `POST` | `/api/calendar/events` | Yes | Yes | Create Google Calendar event |
| `GET` | `/api/calendar/events` | Yes | No | List Google Calendar events |
| `DELETE` | `/api/calendar/events/{id}` | Yes | Yes | Delete event |
| `POST` | `/api/calendar/sync` | Yes | Yes | Sync Google events to local DB |
| `DELETE` | `/api/calendar/disconnect` | Yes | Yes | Disconnect Google Calendar |
| `POST` | `/api/calendar/extract-dates` | Yes | No | Extract dates from text (NL parsing) |
| `POST` | `/api/calendar/events/bulk` | Yes | Yes | Bulk create events (1-25) |

Calendar service uses direct Google REST API calls via `httpx` — no heavy `google-api-python-client` dependency. OAuth tokens are encrypted with AES-256-GCM (via `cryptography.fernet`) using a key derived from `JWT_SECRET`.

### 5.7 Admin

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| `GET` | `/api/admin/stats` | Admin | No | Dashboard statistics (users, docs, chats, announcements) |
| `GET` | `/api/admin/health` | Admin | No | Full health check |
| `GET` | `/api/admin/activity` | Admin | No | Recent activity (chats + uploads) |
| `GET` | `/api/admin/quality` | Admin | No | AI quality summary (low/high confidence, failed ingestions) |
| `GET` | `/api/admin/users` | Admin | No | List users (paginated, filterable) |
| `POST` | `/api/admin/users` | Admin | Yes | Create user |
| `PUT` | `/api/admin/users/{id}` | Admin | Yes | Update user |
| `DELETE` | `/api/admin/users/{id}` | Admin | Yes | Deactivate user (soft delete) |
| `GET` | `/api/admin/documents` | Admin | No | List all documents |
| `DELETE` | `/api/admin/documents/{id}` | Admin | Yes | Delete document (includes Qdrant vectors) |
| `POST` | `/api/admin/documents/{id}/retry` | Admin | Yes | Retry failed document |
| `GET` | `/api/admin/model` | Admin | No | Get active model + available catalog |
| `POST` | `/api/admin/model` | Admin | Yes | Set runtime model override |
| `DELETE` | `/api/admin/model` | Admin | Yes | Clear model override |
| `GET` | `/api/admin/mcp/tools` | Admin | No | List MCP tool specs |

---

## 6. Data Models (Beanie/MongoDB)

### User
- **Collection:** `users`
- **Fields:** `college_id` (unique), `name`, `username`, `email`, `password` (bcrypt), `role` (student|faculty|admin), `college_name` (tenant key), `department`, `is_active`, `refresh_token_hash`
- **Indexes:** `college_id`, `college_name`, `email`

### DocumentRecord
- **Collection:** `documents`
- **Fields:** `uploader`, `college_name` (tenant), `department`, `filename`, `file_type` (MIME), `size_bytes`, `status` (pending|processing|completed|failed), `chunk_count`, `qdrant_ids` (list of Qdrant point IDs), `embedding_model`, `error_message`, `created_at`, `updated_at`
- **Indexes:** `college_name`, `uploader`, `status`

### Announcement
- **Collection:** `announcements`
- **Fields:** `author`, `author_name`, `college_name` (tenant), `department` (null = college_wide), `title`, `content`, `category` (exam|fee|holiday|event|notice), `scope`, `is_private`, `read_by` (list of user IDs), `created_at`, `updated_at`
- **Indexes:** `college_name`, `department`, `author`

### ChatLog
- **Collection:** `chatlogs`
- **Fields:** `user`, `college_name` (tenant), `question`, `answer`, `sources`, `session_id`, `mode`, `model`, `prompt_version`, `trace_id`, `confidence`, `quality_scores`, `agent_steps`, `tokens_used`, `created_at`
- **Indexes:** `user`, `college_name`, `session_id`

### CalendarEvent
- **Collection:** `calendarevents`
- **Fields:** `user`, `google_event_id`, `title`, `start_time`, `end_time`, `event_date`, `event_description`, `source_chat_log`, `created_at`
- **Indexes:** `user`, `start_time`

### UserGoogleToken
- **Collection:** `usergoogletokens`
- **Fields:** `user` (unique), `access_token` (AES encrypted), `refresh_token` (encrypted), `expires_at`
- **Indexes:** `user` (unique)

### AuditEvent
- **Collection:** `audit_events`
- **Fields:** `ts`, `kind` (tool_call|auth|rate_limit), `tool`, `user_id`, `role`, `college_name`, `ok`, `trace_id`, `inputs`, `outputs_summary`, `error`, `ip`, `path`, `method`
- **Indexes:** `ts`, `(college_name, ts)`, `(user_id, ts)`, `(kind, ts)`

---

## 7. Schemas (Pydantic)

### Auth Schemas

| Schema | Fields |
|--------|--------|
| `RegisterIn` | name, college_id, password (8-128), college_name, department?, role (default "student") |
| `LoginIn` | college_id?, email?, password, role |
| `ChangePasswordIn` | oldPassword, newPassword (8-128) |
| `AuthResponse` | message, user (UserOut) |
| `CsrfResponse` | csrfToken, accessToken |
| `MessageResponse` | message |

### Chat Schemas

| Schema | Fields |
|--------|--------|
| `ChatIn` | question (1-4000), sessionId?, mode (default "college"), model? |
| `SourceOut` | documentId, chunkIndex, title?, page?, score, text |
| `ChatResponse` | answer, sources[], sessionId, traceId?, model?, confidence |

### Admin Schemas

| Schema | Fields |
|--------|--------|
| `AdminUserCreateIn` | name, college_id, password (6+), college_name, department?, role, email? |
| `AdminUserUpdateIn` | role?, is_active?, department?, name? |
| `AdminUserOut` | id, name, college_id, college_name, role, department?, is_active, email?, created_at? |
| `ActivityOut` | type, at, payload |

### Announcement Schemas

| Schema | Fields |
|--------|--------|
| `AnnouncementCreateIn` | title (1-200), content (1+), category (default "notice"), scope (default "college_wide"), is_private (default false), department? |

---

## 8. AI Agent Architecture

### 8.1 LangGraph State Machine (`app/agents/graph.py`)

5-node directed graph with conditional routing:

```
intent_classifier → context_retriever → sufficiency_check ─┬─→ answer_generator → citation_validator → END
                                                           ├─→ clarify → END
                                                           └─→ refuse → END
```

**Node implementations:**

| Node | Function | Description |
|------|----------|-------------|
| `intent_classifier` | 8-token LLM call to label intent | Classifies as `policy_lookup`, `announcement_lookup`, `general`, or `refuse` |
| `context_retriever` | MCP-backed tool call | Call `search_documents` (policy/general) or `get_announcements` (announcement) |
| `sufficiency_check` | Router logic | Checks if sources exist, if clarification already asked, if max iterations reached |
| `answer_generator` | Full LLM completion | Generates answer with system prompt (grounded in college context) |
| `citation_validator` | Post-processing | Sets confidence to "high" if grounded sources exist, "low" otherwise |
| `clarify` | Static response | Returns clarification question when sources are insufficient (first time) |
| `refuse` | Static response | Returns refusal when sources are insufficient (second time) or max iterations hit |

**Loop protection:** `MAX_ITERATIONS` (default 5) prevents infinite loops.

### 8.2 Agent State (`app/agents/state.py`)

```python
class AgentState(BaseModel):
    user_id: str
    role: Literal["student", "faculty", "admin"]
    college_name: str
    department: str | None
    question: str
    session_id: str
    prompt_version: str
    trace_id: str
    iteration: int = 0
    intent: Intent | None = None
    sources: list[dict] = []
    agent_steps: list[dict] = []
    confidence: str = "low"
    answer: str = ""
    tool_calls: list[dict] = []
    refused: bool = False
    clarification: bool = False
    finished: bool = False
    model_override: str | None = None
```

### 8.3 Agent Tools (`app/agents/tools.py`)

Two tools both delegate to the MCP client when available, with direct fallback:

- **`search_documents(ctx, query, top_k=5, trace_id=None)`** — Vector search across tenant-scoped Qdrant collections. Falls back to `retrieval_service.retrieve()`.
- **`get_announcements(ctx, limit=10, trace_id=None)`** — Tenant + department scoped announcement feed. Falls back to direct MongoDB query.

Every tool call is **audited** to: Langfuse event + `audit.log` (JSONL file) + MongoDB `AuditEvent` collection.

### 8.4 Langfuse Observability

The `app/observability/tracing.py` module provides a tracer abstraction:

- **`_NoOpTracer`** — default when Langfuse is not configured (dummy methods)
- **`_LangfuseTracer`** — wraps the Langfuse Python SDK; captures events, spans, generations, scores

Usage in agent graph:
- `intent_classifier`: logs `intent_classified` event with intent label
- `answer_generator`: logs `answer_generated` event with answer length
- `chat_service.answer()`: logs `chat_completed` event with trace_id, tenant, confidence, tool_calls count, model

---

## 9. Services Layer

### `auth_service.py`
- `register()` — validate password strength, check duplicate college_id, hash password, create User, issue tokens
- `login()` — find user by college_id or email, verify password + role, issue tokens
- `logout()` — clear refresh_token_hash, clear cookies
- `refresh_access()` — verify refresh token cookie, check hash match, issue new access token
- `change_password()` — validate strength, verify old password, update hash

### `chat_service.py`
- `answer()` — build `AgentState`, run LangGraph graph, persist `ChatLog`, detect calendar dates
- `list_history()` — paginated chat history for user+tenant
- `clear_history()` — delete all chat logs for user+tenant
- `resolve_model()` — explicit override > runtime registry > settings default

### `upload_service.py`
- `enqueue_upload()` — validate file type/size, create DocumentRecord, write temp file, enqueue Celery task
- `list_documents()` — tenant-scoped document listing
- `get_status()` — document status with chunk_count, error_message
- `remove()` — delete document + Qdrant vectors, ownership check
- `remove_document()` — admin-scoped delete (no ownership check)
- `retry_document()` — reset status to pending (requires re-upload)

### `admin_service.py`
- `stats()` — tenant-scoped counts: users (by role), documents (by status), announcements, chats
- `quality_summary()` — last 7 days: low/high confidence chats, failed ingestions
- `list_users()` — paginated, filterable by role and name/college_id substring
- `create_user()` — validates college_name matches admin's tenant
- `update_user()` — update role, active status, department, name
- `delete_user()` — soft deactivate + invalidate refresh tokens
- `list_documents()` — paginated, filterable by status

### `calendar_service.py`
- **OAuth flow:** `build_auth_url()`, `generate_state()`, `verify_state()`, `exchange_code()`, `store_tokens()`
- **Token management:** `_get_valid_access_token()` (auto-refresh), `_encrypt()`/`_decrypt()` (AES-256-GCM via cryptography.fernet)
- **Calendar API:** `list_events()`, `create_event()`, `delete_event()`, `disconnect()`
- Direct REST calls to Google APIs via `httpx` — no google-api-python-client dependency

### `date_extractor.py`
- Multi-strategy date parsing from unstructured text:
  1. Regex for ISO (`2026-03-15`), dd-MMM-yyyy (`15-Mar-2026`), US (`03/15/2026`), written (`March 15, 2026`)
  2. `dateutil.parser.parse()` with fuzzy mode for natural language
  3. Noise word blocklist
  4. Event label inference via keyword matching
  5. Deduplication by date, keeping highest confidence
- Used by chat service to detect calendar-worthy dates in AI responses

### `model_registry.py`
- Thread-safe in-memory model override storage
- `get_active_chat_model()`, `set_model_override()`, `clear_model_override()`, `get_model_status()`
- Validates model is in available catalog before switching
- Consulted by `chat_service.resolve_model()` on every request

### `retrieval_service.py`
- Qdrant vector search with tenant-scoped collection names (`cw_{college_slug}`)
- Hybrid filter support (keyword + vector search)
- Returns ranked document chunks with scores

### `ingestion_service.py`
- Document parsing (Docling primary, PyMuPDF/python-docx/openpyxl fallbacks)
- Text chunking with configurable strategies
- Embedding generation via LiteLLM
- Qdrant point creation and indexing

---

## 10. Security Architecture

### 10.1 Authentication (JWT)

- **Access token:** 15-minute expiry, stored in `access_token` HttpOnly cookie
- **Refresh token:** 7-day expiry, stored in `refresh_token` HttpOnly cookie
- Both are signed with separate secrets (`JWT_SECRET` and `JWT_REFRESH_SECRET`) using HS256
- Refresh token hash (bcrypt) stored on User document — rotation on every login/logout
- Token payload includes: `sub`, `userId`, `role`, `college_name`, `department`, `college_id`, `type`
- Refresh flow: verify cookie, verify stored hash, issue new access token (refresh token stays the same)

### 10.2 CSRF Double-Submit

- All mutating requests (POST, PUT, DELETE) require CSRF verification
- `csrf_token` cookie set on login/register (HttpOnly=false — JS-readable)
- `X-CSRF-Token` header must match cookie value
- Token is HMAC-signed with `CSRF_SECRET` to prevent prediction
- CSRF middleware in `app/api/deps.py` — `verify_csrf()` dependency

### 10.3 Role-Based Access Control

Three role levels enforced via FastAPI dependencies:

```python
require_student()        # Any authenticated user
require_faculty_or_admin()  # Faculty or admin
require_admin()          # Admin only
```

These are used as `Depends()` on route handlers. The `require_roles(*roles)` factory provides flexible role checking.

### 10.4 Tenant Isolation

Every data query is scoped by `college_name`. The `TenantContext` dataclass carries the authenticated user's tenant info and is passed to all services and agent tools. Cross-tenant access attempts raise `TenantIsolationError` (403).

```python
@dataclass(frozen=True)
class TenantContext:
    user_id: str
    role: str
    college_name: str
    department: str | None
    college_id: str
```

### 10.5 Rate Limiting

Redis-backed sliding-window counter algorithm:
- 120 req/min default
- 10 req/min for auth routes
- 30 req/min for chat routes
- 20 req/min for upload routes
- Bypassed for health, docs, metrics endpoints
- Fail-open: if Redis is down, requests are allowed through
- Uses sorted set with timestamp scores; trims old entries each request
- Returns `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` headers

### 10.6 Password Policy

Enforced on registration and password change:
- Minimum 8 characters, maximum 128
- At least 1 uppercase, 1 lowercase, 1 digit, 1 special character
- Common password blocklist (30+ entries)
- Bcrypt hashing with 12 rounds

---

## 11. Guardrails & Audit

### `app/guardrails/audit.py`

Every agent tool call is recorded to three destinations:

1. **Langfuse** — structured event via tracer
2. **`audit.log`** — append-only JSONL file (sync, thread-safe)
3. **MongoDB `AuditEvent` collection** — async, best-effort

`audit_tool_call()` records: tool name, user_id, role, college_name, ok/fail, inputs (scrubbed), outputs summary, trace_id.
`audit_event()` records: generic events (auth, rate limit, etc.)

Sensitive fields (`password`, `token`, `access_token`, `refresh_token`, `secret`) are redacted from logged inputs.

### `app/guardrails/injection.py`

Detects prompt injection attempts in user queries (pattern matching for common jailbreak techniques).

### `app/guardrails/output.py`

Validates AI output against content policies before sending to the user.

---

## 12. Observability

### 12.1 Prometheus Metrics (`app/observability/metrics.py`)

Custom registry with:
- `http_requests_total` — counter (method, path, status labels)
- `http_request_duration_seconds` — histogram (method, path labels; buckets 5ms-10s)
- `agent_runs_total` — counter (model, outcome labels)
- `websocket_connections_active` — gauge
- `rate_limited_requests_total` — counter (route label)

Path normalization replaces UUIDs with `{id}` to prevent label cardinality explosion. All metrics exposed at `/api/metrics`.

### 12.2 Structured Logging (`app/core/logging.py`)

- Uses `structlog` with ISO timestamps, log levels, and colored console output
- `RequestLoggingMiddleware` logs every request: method, path, status, duration_ms, user_id, client IP
- Health/liveness/metrics endpoints are excluded from logging to reduce noise
- In development, debug-level logging is enabled

### 12.3 Langfuse Tracing (`app/observability/tracing.py`)

Optional Langfuse integration:
- If `LANGFUSE_SECRET_KEY` + `LANGFUSE_PUBLIC_KEY` are set, `_LangfuseTracer` is initialized
- Otherwise, `_NoOpTracer` silently swallows all calls
- Minimal public API: `log_event()`, `span()`, `generation()`, `score()`
- Events captured: intent classification, answer generation, chat completion, tool calls, uploads

---

## 13. Background Workers (Celery)

### `app/workers/celery_app.py`

Celery app configured with:
- Broker: Redis (from `REDIS_URL` or `CELERY_BROKER_URL`)
- Backend: Redis (from `REDIS_URL` or `CELERY_RESULT_BACKEND`)
- JSON serialization (cross-worker safe)
- Task acks late, prefetch multiplier 1, max 3 retries with 10s delay

### `app/workers/ingestion_tasks.py`

The `ingest_document` task:
1. Receives: document_id, file_path, college_name, department, mime_type, filename
2. Parses document using Docling/PyMuPDF
3. Chunks text
4. Generates embeddings via LiteLLM
5. Indexes vectors into Qdrant
6. Updates DocumentRecord status to "completed" (or "failed" on error)

Run the worker: `uv run celery -A app.workers.celery_app.celery_app worker -l info`

---

## 14. MCP (Model Context Protocol)

### `app/mcp/server.py`

Defines two MCP tools using FastMCP:
- `mcp_search_documents(query, user_id, role, college_name, department, top_k=5, trace_id=None)` — tenant-scoped vector search
- `mcp_get_announcements(user_id, role, college_name, department, limit=10, trace_id=None)` — tenant-scoped announcement feed

### `app/mcp/client.py`

Thin client that the LangGraph agent uses to invoke MCP tools:
- `call_mcp_tool()` — dispatches to the correct server function
- `list_mcp_tools()` — returns tool specs for admin introspection
- `as_langgraph_tools()` — converts to LangGraph-compatible format
- In-process implementation (no serialization round-trip), but the API matches what a remote MCP-over-SSE client would use

---

## 15. Event System

### `app/events/announcement_bus.py`

Lightweight in-process pub/sub for fanning out announcement events to SSE subscribers:

- `AnnouncementBus` maintains a per-tenant dict of `asyncio.Queue` objects
- `subscribe(tenant)` — returns a queue for receiving events
- `unsubscribe(tenant, queue)` — removes queue on client disconnect
- `publish(tenant, event)` — fan-out to all subscribers in that tenant
- Each queue has maxsize=64 to prevent memory leaks

**Note:** In a multi-worker deployment, this should be backed by Redis pub/sub. For single-worker dev/portfolio, the in-memory bus is sufficient.

---

## 16. Frontend Architecture

### Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2 | UI framework |
| Vite | 7.3 | Build tool + dev server |
| React Router | 7.13 | Client-side routing |
| TanStack Query | 5.101 | Server state management |
| Axios | 1.13 | HTTP client |
| Tailwind CSS | 3.4 | Utility-first CSS |
| Framer Motion | 12.36 | Animations |
| Lucide React | 0.577 | Icons |
| Three.js | 0.128 | 3D background |
| Vitest | 2.1 | Unit tests |
| React Testing Library | 16.0 | Component tests |
| Playwright | 1.58 | E2E tests |

### Key Components

| Component | Description |
|-----------|-------------|
| `ChatWindow` | WebSocket-powered chat interface with streaming token display |
| `ChatMessage` | Renders AI messages with source citations + calendar buttons |
| `CalendarButton` | "Add to Google Calendar" button for detected dates |
| `BulkDatePicker` | Multi-date calendar picker for bulk event creation |
| `AdminDashboard` | Admin panel with stats, users, documents, model switcher |
| `ModelSwitcher` | Dropdown to switch AI model at runtime |
| `DocumentTable` | Document listing with status indicators |
| `GoogleCalendarSection` | OAuth connect/disconnect + event list |
| `AnnouncementFeed` | Live SSE-powered announcement stream |
| `ThreeBackground` | Animated 3D particle background |

### Custom Hooks

| Hook | Description |
|------|-------------|
| `useChatStream` | WebSocket connection with auto-reconnect, cancel support, token buffering |
| `useCalendarIntegration` | Google Calendar OAuth flow + event CRUD |
| `useAnnouncementStream` | SSE subscription for real-time announcements |

### Frontend Route Structure

- `/login` — Login/Register page
- `/student` — Student dashboard (chat + announcements)
- `/faculty` — Faculty dashboard (chat + upload + announcements)
- `/admin` — Admin dashboard (users, documents, stats, model)
- `/settings` — Account settings (profile, password, calendar)

### Vite Proxy Configuration

```js
// frontend/vite.config.js
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
}
```

During development, the frontend proxies all `/api` requests to the FastAPI backend. In production, a reverse proxy (nginx) would handle this.

---

## 17. Cloud Infrastructure

All infrastructure services are fully cloud-managed — no local Docker required.

| Service | Provider | Configuration |
|---------|----------|---------------|
| **MongoDB** | MongoDB Atlas (M0+ cluster) | `MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/chatwave?retryWrites=true&w=majority` |
| **Qdrant** | Qdrant Cloud | `QDRANT_URL=https://<cluster>.aws.cloud.qdrant.io` + `QDRANT_API_KEY` |
| **Redis** | Redis Cloud (or any managed Redis) | `REDIS_URL=redis://default:<pass>@<host>:<port>` |
| **LLM** | Gemini (via LiteLLM) | `GEMINI_API_KEY` — also supports Anthropic Claude and OpenAI GPT-4o |

**Authentication:** MongoDB Atlas requires IP allowlist. Add your current public IP in Atlas → Network Access → Add IP Address.

---

## 18. Testing

### Backend Tests (pytest)

12 test files in `backend_py/app/tests/`:

| File | Coverage |
|------|----------|
| `test_auth.py` | Registration, login, logout, refresh, change password, token validation |
| `test_agent_graph.py` | LangGraph agent state machine, node execution, routing |
| `test_audit.py` | Audit logging (tool calls, event recording, scrubbing) |
| `test_date_extractor.py` | Date extraction from text (regex, natural language, edge cases) |
| `test_evals.py` | Evaluation dataset runners |
| `test_guardrails.py` | Injection detection, output validation |
| `test_ingestion.py` | Document ingestion pipeline |
| `test_rbac.py` | Role-based access control enforcement |
| `test_retrieval.py` | Vector search and retrieval |
| `test_tenant_isolation.py` | Cross-tenant data leak prevention |

Test configuration:
- `conftest.py` provides: `event_loop` (session-scoped), `db_session` (per-test Beanie init), `client` (ASGI test client)
- Tests requiring MongoDB use `@requires_db` marker — auto-skips if MongoDB is unreachable
- Test env vars override: `APP_ENV=test`, with fallback secrets in `_TEST_OVERRIDES`

**Run:** `cd backend_py && uv run pytest`

### Frontend Tests (Vitest + React Testing Library)

Test files in `frontend/src/`:
- `components/Chat/__tests__/` — ChatWindow, ChatMessage component tests
- `hooks/__tests__/` — useChatStream, useCalendarIntegration hook tests
- `services/__tests__/` — API service tests

**Run:** `cd frontend && npm run test:run`

### E2E Tests (Playwright)

Configured via `@playwright/test` in frontend devDependencies.

---

## 19. Local Development Setup

### Prerequisites
- Python 3.12+ / uv
- Node.js 20+ / npm
- Cloud service URLs (MongoDB Atlas, Qdrant Cloud, Redis Cloud)

### Backend

```bash
cd backend_py
uv sync --all-extras
cp .env.example .env
# Edit .env with your cloud URIs and API keys
uv run uvicorn app.main:app --reload --port 8000

# In another terminal (for document ingestion):
uv run celery -A app.workers.celery_app.celery_app worker -l info

# Optional: Flower monitoring
uv run celery -A app.workers.celery_app.celery_app flower
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev   # http://localhost:5173
```

### Quick Verification

```bash
# Health check
curl http://localhost:8000/api/health
# Expected: {"status":"ok"|"degraded","services":{"mongodb":true,"qdrant":true,"redis":true,"llm":{"ok":true}}}

# API docs
open http://localhost:8000/docs

# Frontend
open http://localhost:5173
```

---

## 20. CI/CD

### Backend CI (`.github/workflows/chatwave-backend-py.yml`)
- Trigger: push to main, pull requests to main
- Steps: Checkout → Install uv → `uv sync --all-extras` → `ruff check .` → `uv run pytest`

### Frontend CI (`.github/workflows/chatwave-frontend-ci.yml`)
- Trigger: push to main, pull requests to main
- Steps: Checkout → Setup Node → `npm ci` → `npm run build` → `npm run test:run`

---

## 21. Key Technical Decisions & Trade-offs

| Decision | Rationale |
|----------|-----------|
| **FastAPI over Express** | Async Python pattern-match for AI/LLM libraries (LangGraph, LiteLLM, LlamaIndex); unified type system with Pydantic |
| **Beanie ODM over raw Motor** | Document-model mapping with automatic schema validation, similar to Mongoose |
| **LangGraph over LangChain Agent** | Explicit state machine gives predictable, debuggable agent behavior with hard loop limits |
| **MCP for agent tools** | Industry standard (2026) — same tools callable from Claude Desktop |
| **Celery over background tasks** | Long-running document ingestion (30s+) must survive server restart; Redis broker for reliability |
| **LiteLLM for model gateway** | Single interface for Gemini, Claude, GPT-4o; runtime model switching without code changes |
| **Google Calendar via raw httpx** | Avoids 30MB google-api-python-client dependency; explicit REST calls are interview-friendly |
| **Redis rate limiter over in-memory** | Survives server restarts, consistent across workers, atomic sorted-set operations |
| **Cloud infrastructure over Docker** | Zero local infrastructure management; scales trivially; eliminates Docker complexity |
| **Double-submit CSRF over SameSite** | SameSite=None breaks in some browser contexts; double-submit is battle-tested for cookie-based SPA auth |
| **Fernet encryption for OAuth tokens** | JWT_SECRET-derived key (no additional secret); deterministic encryption for searchability |
| **In-memory announcement bus over Redis pub/sub** | Single-worker deployment; avoids unnecessary Redis dependency for announcements |
