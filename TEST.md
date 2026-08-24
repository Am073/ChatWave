# ChatWave — Complete Test Plan

> **122 test cases** covering backend API, frontend UI, and RAG verification.
> Designed for execution in **Antigravity IDE** or any test runner.

---

## Prerequisites

```bash
# 1. Start backend server
cd backend_py
uv run uvicorn app.main:app --reload --port 8000

# 2. Start Celery worker (for document ingestion tests)
cd backend_py
uv run celery -A app.workers.celery_app.celery_app worker -l info

# 3. Start frontend
cd frontend
npm run dev

# 4. Install Playwright (for Part B)
cd frontend
npm install -D @playwright/test
npx playwright install chromium
```

**Test files:** any small PDF (a 2-page sample works best for quick ingestion runs).

**Test accounts (seed with `cd backend_py && uv run python -m scripts.seed_db`):**
| Role | College ID | Password | College | Department |
|---|---|---|---|---|
| Student | CW-STUDENT | Password@123 | ChatWave College | Computer Science |
| Faculty | CW-FACULTY | Password@123 | ChatWave College | Computer Science |
| Admin | CW-ADMIN | Password@123 | ChatWave College | Administration |

---

## Part A — Backend API Tests (68 tests)

**Base URL:** `http://localhost:8000/api`
**Auth flow:** Every mutating request needs:
1. `GET /auth/csrf-token` → get `csrf_token` cookie + `X-CSRF-Token` header value
2. Include both: `Cookie: csrf_token=...` + `Header: X-CSRF-Token: ...`

---

### A1: Health & Connectivity (4 tests)

| # | Method | Endpoint | Payload | Expected Status | Expected Response |
|---|---|---|---|---|---|
| 1 | GET | `/health` | — | 200 | `{"status":"ok","services":{"mongodb":true,"qdrant":true,"redis":true,"llm":{...}}}` |
| 2 | GET | `/health/live` | — | 200 | `{"status":"alive"}` |
| 3 | GET | `/metrics` | — | 200 | Content-Type: text/plain, body contains `http_requests_total` |
| 4 | GET | `/` | — | 200 | `{"name":"ChatWave v2","version":"2.0.0"}` |

---

### A2: Auth — Register 3 Accounts (5 tests)

| # | Method | Endpoint | Payload | Expected Status | Expected Response |
|---|---|---|---|---|---|
| 5 | POST | `/auth/register` | `{"name":"Alice Student","college_id":"STU001","password":"StrongP@ss123","college_name":"TestU","department":"CS","role":"student"}` | 201 | `{"message":"Registration successful","user":{...}}`, cookies: access_token, refresh_token, csrf_token |
| 6 | POST | `/auth/register` | `{"name":"Bob Faculty","college_id":"FAC001","password":"StrongP@ss123","college_name":"TestU","department":"CS","role":"faculty"}` | 201 | Same structure |
| 7 | POST | `/auth/register` | `{"name":"Carol Admin","college_id":"ADM001","password":"StrongP@ss123","college_name":"TestU","department":"CS","role":"admin"}` | 201 | Same structure |
| 8 | POST | `/auth/register` | Same college_id as STU001 | 409 | `{"detail":"User with this College ID already exists"}` |
| 9 | POST | `/auth/register` | `{"password":"abc",...}` (weak) | 422 | Validation error detail |

---

### A3: Auth — Login & Session (8 tests)

| # | Method | Endpoint | Payload | Expected Status | Expected Response |
|---|---|---|---|---|---|
| 10 | POST | `/auth/login` | `{"college_id":"STU001","password":"StrongP@ss123","role":"student"}` | 200 | `{"message":"Login successful","user":{...}}`, cookies set |
| 11 | POST | `/auth/login` | `{"college_id":"STU001","password":"wrong","role":"student"}` | 401 | `{"detail":"Invalid College ID or password"}` |
| 12 | POST | `/auth/login` | `{"college_id":"STU001","password":"StrongP@ss123","role":"admin"}` | 401 | `{"detail":"Incorrect role selected for this account"}` |
| 13 | GET | `/auth/me` | — (auth cookie) | 200 | User profile: `{"_id":"...","name":"Alice Student","college_id":"STU001","role":"student","college_name":"TestU","department":"CS"}` |
| 14 | POST | `/auth/refresh` | — (refresh cookie) | 200 | `{"message":"Token refreshed successfully"}`, new access_token cookie |
| 15 | POST | `/auth/change-password` | `{"oldPassword":"StrongP@ss123","newPassword":"NewP@ss456"}` | 200 | `{"message":"Password changed. Please sign in again."}` |
| 16 | POST | `/auth/login` | `{"college_id":"STU001","password":"StrongP@ss123","role":"student"}` (old pw) | 401 | Rejected |
| 17 | POST | `/auth/logout` | — (auth + CSRF) | 200 | `{"message":"Logout successful"}`, cookies cleared |

---

### A4: CSRF Enforcement (2 tests)

| # | Method | Endpoint | Payload | Expected Status | Expected Response |
|---|---|---|---|---|---|
| 18 | POST | `/chat` | No X-CSRF-Token header | 403 | `{"detail":"CSRF token invalid or missing"}` |
| 19 | POST | `/chat` | No csrf_token cookie | 403 | `{"detail":"CSRF token invalid or missing"}` |

---

### A5: Rate Limiting (1 test)

| # | Method | Endpoint | Steps | Expected Status | Expected Response |
|---|---|---|---|---|---|
| 20 | POST | `/auth/login` | Send 15 rapid login attempts (bad password) | 429 | `{"detail":"Rate limit exceeded"}` (after 10 requests) |

---

### A6: Student Chat — HTTP (6 tests)

| # | Method | Endpoint | Payload | Expected Status | Expected Response |
|---|---|---|---|---|---|
| 21 | POST | `/chat` | `{"question":"What is 2+2?","mode":"general"}` | 200 | `{"answer":"...","sources":[],"confidence":"high","traceId":"..."}` — **sources empty** |
| 22 | POST | `/chat` | `{"question":"Tell me about TestU","mode":"college"}` | 200 | `{"answer":"...","sources":[...],"confidence":"...","traceId":"..."}` — sources may be empty if no docs |
| 23 | GET | `/chat/stream?question=Hi` | — (SSE) | 200 | SSE events: `event:started`, `event:sources`, `event:token` (multiple), `event:final` |
| 24 | GET | `/chat/history` | `?page=1&limit=20` | 200 | `{"logs":[...],"total":N,"page":1,"limit":20}` |
| 25 | GET | `/chat/history` | `?before=<ISO-timestamp>&limit=5` | 200 | `{"logs":[...],"has_more":true/false,"next_cursor":"..."}` |
| 26 | DELETE | `/chat/history` | — (auth + CSRF) | 200 | `{"message":"Chat history cleared"}` |

---

### A7: Student Chat — WebSocket (6 tests)

**Connect:** `ws://localhost:8000/api/chat/ws` with `Cookie: access_token=<jwt>`

| # | Message Sent | Expected Response Frames | Assertions |
|---|---|---|---|
| 27 | `{"type":"question","content":"Hello","mode":"general"}` | `ready` → `started` → `answered` → `sources:[]` → `token`* → `final` | General mode: no sources |
| 28 | `{"type":"question","content":"Tell me about my college","mode":"college"}` | Same sequence | College mode: sources may be present |
| 29 | `{"type":"cancel"}` (mid-stream) | `cancelling` → `cancelled` | Bot message stops, `isDone: true` |
| 30 | `{"type":"ping"}` | `{"type":"pong"}` | Immediate response |
| 31 | Connect with no auth cookie | Server sends close `4401` | Connection rejected |
| 32 | `{"type":"question","content":""}` | `{"type":"error","message":"Question cannot be empty"}` | Validation error |

---

### A8: Student Announcements — Read-only (3 tests)

| # | Method | Endpoint | Expected Status | Expected Response |
|---|---|---|---|---|
| 33 | GET | `/announcements` | 200 | Array (possibly empty: `[]`) |
| 34 | PUT | `/announcements/{id}/read` | 200 | `{"message":"Marked as read"}` (idempotent: call twice, same result) |
| 35 | GET | `/announcements/stream` | 200 (SSE) | `event:ready`, heartbeat `event:ping` every 25s |

---

### A9: Student Document — Read-only + Forbidden (3 tests)

| # | Method | Endpoint | Expected Status | Expected Response |
|---|---|---|---|---|
| 36 | GET | `/upload` | 200 | Array of documents |
| 37 | POST | `/upload` | 403 | `{"detail":"Faculty or admin role required"}` |
| 38 | POST | `/announcements` | 403 | `{"detail":"Faculty or admin role required"}` |

---

### A10: Faculty Announcements (5 tests)

**Login as faculty first:** `POST /auth/login` with `college_id:"FAC001", role:"faculty"`

| # | Method | Endpoint | Payload | Expected Status | Expected Response |
|---|---|---|---|---|---|
| 39 | POST | `/announcements` | `{"title":"Exam Schedule","content":"Midterms start next week","scope":"college_wide","category":"academic"}` | 201 | Announcement object with `_id`, `author`, `title`, `college_name` |
| 40 | POST | `/announcements` | `{"title":"CS Lab","content":"Lab moved","scope":"department","department":"CS"}` | 201 | Scoped to CS |
| 41 | POST | `/announcements` | `{"title":"Math Lab","content":"...","scope":"department","department":"Math"}` | 403 | `{"detail":"Faculty can only post in their own department"}` |
| 42 | DELETE | `/announcements/{id}` | — (own announcement) | 200 | `{"message":"Announcement deleted"}` |
| 43 | DELETE | `/announcements/{id}` | — (login as different faculty) | 403 | `{"detail":"Only author or admin may delete"}` |

---

### A11: Faculty Document Upload (5 tests)

**Upload the PDF:** `POST /upload` with multipart form:
```
file: <zero to one by Peter theil.pdf>
scope: college_wide
```

| # | Method | Endpoint | Payload | Expected Status | Expected Response |
|---|---|---|---|---|---|
| 44 | POST | `/upload` | Multipart: file + scope="college_wide" | 202 | `{"documentId":"...","status":"pending","message":"..."}` |
| 45 | GET | `/upload` | — | 200 | Array contains uploaded document |
| 46 | GET | `/upload/{id}/status` | — | 200 | `{"status":"pending"}` or `{"status":"processing"}` or `{"status":"completed"}` |
| 47 | DELETE | `/upload/{id}` | — | 200 | `{"message":"Document deleted"}` |
| 48 | POST | `/upload/{id}/retry` | — | 200 | Reset to pending |

---

### A12: Admin Stats, Health, Quality (4 tests)

**Login as admin:** `POST /auth/login` with `college_id:"ADM001", role:"admin"`

| # | Method | Endpoint | Expected Status | Expected Response |
|---|---|---|---|---|
| 49 | GET | `/admin/stats` | 200 | `{"totalUsers":3,"totalStudents":1,"totalFaculty":1,"totalAdmins":1,"totalDocuments":N,"totalAnnouncements":N,"totalChats":N}` |
| 50 | GET | `/admin/activity?limit=20` | 200 | `{"activities":[{"type":"chat",...},{"type":"document",...}]}` |
| 51 | GET | `/admin/health` | 200 | Same as `/health` response |
| 52 | GET | `/admin/quality` | 200 | `{"window_days":7,"total_chats":N,"low_confidence_chats":N,...}` |

---

### A13: Admin User Management (7 tests)

| # | Method | Endpoint | Payload | Expected Status | Expected Response |
|---|---|---|---|---|---|
| 53 | GET | `/admin/users?page=1&limit=20` | — | 200 | `{"total":3,"users":[...],"page":1,"limit":20}` |
| 54 | GET | `/admin/users?q=STU` | — | 200 | Filtered: only STU001 |
| 55 | GET | `/admin/users?role=student` | — | 200 | Only student users |
| 56 | POST | `/admin/users` | `{"name":"Dave User","college_id":"USR001","password":"StrongP@ss123","college_name":"TestU","department":"CS","role":"student"}` | 201 | `{"message":"User created","id":"..."}` |
| 57 | PUT | `/admin/users/{id}` | `{"name":"Dave Updated"}` | 200 | `{"message":"User updated"}` |
| 58 | DELETE | `/admin/users/{id}` | — | 200 | `{"message":"User deactivated"}` (soft delete) |
| 59 | POST | `/auth/login` | `{"college_id":"USR001","password":"StrongP@ss123","role":"student"}` | 401 | `{"detail":"Account is inactive"}` |

---

### A14: Admin Document Management (2 tests)

| # | Method | Endpoint | Expected Status | Expected Response |
|---|---|---|---|---|
| 60 | GET | `/admin/documents?page=1&limit=50` | 200 | `{"total":N,"documents":[...],"page":1}` |
| 61 | DELETE | `/admin/documents/{id}` | 200 | `{"message":"Document deleted"}` |

---

### A15: Admin Model Management (3 tests)

| # | Method | Endpoint | Payload | Expected Status | Expected Response |
|---|---|---|---|---|---|
| 62 | GET | `/admin/model` | — | 200 | `{"default_model":"gemini/gemini-3.6-flash","active_model":"gemini/gemini-3.6-flash","available":[...],"allow_runtime_switch":true}` |
| 63 | POST | `/admin/model` | `{"model":"gemini/gemini-2.5-flash"}` | 200 | active_model becomes `gemini/gemini-2.5-flash` (Redis-backed override) |
| 64 | DELETE | `/admin/model` | — | 200 | override cleared; active_model back to default |

---

### A16: Admin Announcements — Cross-dept (1 test)

| # | Method | Endpoint | Payload | Expected Status | Expected Response |
|---|---|---|---|---|---|
| 65 | POST | `/announcements` | `{"title":"Math Notice","content":"...","scope":"department","department":"Math"}` | 201 | Admin can post to any dept |

---

### A17: Security — Tenant Isolation + ReDoS (3 tests)

| # | Method | Endpoint | Steps | Expected Status | Expected Response |
|---|---|---|---|---|---|
| 66 | GET | `/admin/users` | Register user under "OtherU" college, login as OtherU admin | 200 | Only OtherU users returned (no TestU users) |
| 67 | GET | `/admin/users?q=(a+)+$` | — | 200 | No crash, safe results |
| 68 | GET | `/admin/users?q=<200 chars>` | — | 200 | Query truncated to 64 chars |

---

## Part B — Frontend Playwright Tests (51 tests)

**Base URL:** `http://localhost:5173`
**Browser:** Chromium

---

### B1: Auth Pages (7 tests)

| # | Test Name | Steps | Assertions |
|---|---|---|---|
| 69 | Login page renders | Navigate to `/login` | Input fields for college_id, password, role selector, Login button, "Sign up" link visible |
| 70 | Register page renders | Navigate to `/register` | All fields: name, college_id, password, college_name, department, role dropdown, Submit button |
| 71 | Full register flow | Fill all fields with unique college_id → click Submit | Redirected to `/{role}` dashboard (e.g., `/student`) |
| 72 | Login flow | Fill college_id + password + role → click Login | Redirected to `/{role}` dashboard |
| 73 | Login error | Fill wrong password → click Login | Error toast/message visible |
| 74 | Auth redirect | Navigate to `/student` (not logged in) | Redirected to `/login` |
| 75 | Role guard | Login as student → navigate to `/admin` | Redirected back to `/student` |

---

### B2: Student Dashboard — Chat + 🎓/🌐 Toggle (14 tests) ⭐

| # | Test Name | Steps | Assertions |
|---|---|---|---|
| 76 | Chat tab active by default | Login as student → load `/student` | ChatWindow component visible, connection status "Online" |
| 77 | Empty state | No messages | "How can I help you today?" heading + suggestion chips visible |
| 78 | 🎓 College mode default | Check toggle state | "College" button has blue highlight (active), status text: "Answers from your college only" |
| 79 | 🌐 General mode switch | Click "General" button | Toggle switches to green highlight, status text: "General AI mode" |
| 80 | Send in General mode | Type "What is Python?" with 🌐 active → Enter | Streaming tokens appear, search status: "Thinking..." |
| 81 | Send in College mode | Switch to 🎓 → type "Tell me about my college" → Enter | Search status: "Searching knowledge base..." |
| 82 | Toggle mid-session | Send college question → switch to general → send another | Mode changes reflected in status text, each uses correct mode |
| 83 | Cancel streaming | Click cancel button while answer is streaming | Bot message stops, marked as complete |
| 84 | Chat history persistence | Send messages → refresh page → check chat | Messages restored from localStorage + API history |
| 85 | Clear chat | Click 🗑 Clear button | All messages removed, localStorage cleared |
| 86 | Infinite scroll | Scroll up in chat with history | Older messages load with "Loading older messages..." indicator |
| 87 | Reconnect banner | Stop backend server while connected | "⚠️ Connection lost. Reconnecting to ChatWave..." banner appears |
| 88 | Reconnect failed | Keep server down for 5 reconnect attempts | "Connection lost. Please refresh or try reconnecting." + Reconnect button |
| 89 | Retry connect | Click Reconnect button | Counter resets, reconnection attempt starts |

---

### B3: Student Dashboard — Announcements (4 tests)

| # | Test Name | Steps | Assertions |
|---|---|---|---|
| 90 | Switch to announcements tab | Click "Announcements" in topbar | AnnouncementsPage component rendered |
| 91 | No announcements empty state | No announcements exist | "📭 No announcements yet" visible |
| 92 | Sidebar live feed | New announcement posted (via API) | Appears in sidebar, unread badge (red dot) appears on bell icon |
| 93 | Mark as read | Click on unread announcement card | Visual state changes, unread count decrements |

---

### B4: Student Dashboard — Settings (3 tests)

| # | Test Name | Steps | Assertions |
|---|---|---|---|
| 94 | Open settings modal | Click ⚙ gear icon in topbar | SettingsModal opens as overlay |
| 95 | Change password | Fill old password + new password → click Save | Success toast/message shown |
| 96 | Calendar section | View SettingsModal | Google Calendar section with Connect/Disconnect button visible |

---

### B5: Faculty Dashboard — Upload + Announcements (8 tests) ⭐

| # | Test Name | Steps | Assertions |
|---|---|---|---|
| 97 | Faculty Dashboard renders | Login as faculty → load `/faculty` | Welcome bar: "Faculty Portal", Upload Document panel + Broadcast Center panel |
| 98 | Upload PDF | Click upload area → select `zero to one by Peter theil.pdf` → click Upload button | Upload starts, Processing queue shows document with spinning status indicator |
| 99 | File validation error | Try uploading a .txt file (unsupported) | Error message: "Unsupported file type" |
| 100 | Processing status | Wait 5s after upload | Status updates: pending → processing → completed (if Celery running) |
| 101 | Uploaded documents list | Check upload panel below file picker | Uploaded file listed with filename, size, status |
| 102 | Post announcement | Fill title + content → set scope → click Post | Announcement created, appears in list below |
| 103 | Department scope post | Set department to "CS" in announcement form | Announcement scoped to CS department |
| 104 | Settings modal | Click ⚙ gear icon | SettingsModal opens |

---

### B6: Admin Dashboard — Full Suite (12 tests) ⭐

| # | Test Name | Steps | Assertions |
|---|---|---|---|
| 105 | Overview tab renders | Login as admin → load `/admin` | 5 StatCards (Students, Faculty, Documents, Announcements, Queries) + ActivityFeed + SystemHealth + ModelSwitcher |
| 106 | Stats cards populated | Check StatCard values | Numeric values displayed (not dashes) |
| 107 | Activity feed loads | Check ActivityFeed section | Recent chat/document activities listed |
| 108 | System health indicators | Check SystemHealth section | MongoDB, Qdrant, Redis, LLM status dots (green/red) |
| 109 | Upload tab — upload PDF | Switch to "Upload" tab → select PDF → Upload | Processing queue appears with document |
| 110 | Post tab — post announcement | Switch to "Post" tab → fill title + content → Post | Announcement created |
| 111 | Users tab — user table | Switch to "Users" tab | UserTable renders with search bar + user rows |
| 112 | Create user via UI | Click "Create User" → fill form → submit | New user appears in table |
| 113 | Delete user via UI | Click delete icon on a user row | User removed/deactivated |
| 114 | Knowledge Base tab | Switch to "Knowledge Base" tab | DocumentTable shows all uploaded documents |
| 115 | Model switcher | Change model in ModelSwitcher dropdown | Confirmation, model updated |
| 116 | Tab navigation | Click all 5 tabs (Overview, Users, Knowledge Base, Upload, Post) | Each tab renders correct content, no errors |

---

### B7: Cross-cutting UI (3 tests)

| # | Test Name | Steps | Assertions |
|---|---|---|---|
| 117 | 3D background renders | Load any dashboard | Three.js `<canvas>` element present in DOM |
| 118 | Mobile bottom nav | Resize viewport to 375px width | BottomNav bar appears at bottom of screen |
| 119 | Role-appropriate avatars | Load student, faculty, admin dashboards | Student: blue-teal gradient, Faculty: purple gradient, Admin: purple-amber gradient |

---

## Part C — RAG Verification (3 tests)

*Requires Celery worker running for document ingestion to complete.*

| # | Test Name | Steps | Assertions |
|---|---|---|---|
| 120 | Document ingestion completes | Upload `zero to one by Peter theil.pdf` via faculty, poll status | Status: `pending` → `processing` → `completed`, chunk_count > 0 |
| 121 | RAG query in College mode | Ask "What does Peter Thiel say about competition?" with 🎓 College mode | Answer contains relevant content about competition, `sources[]` includes the uploaded filename |
| 122 | Same query in General mode | Switch to 🌐 General mode, ask same question | Answer provided, `sources[]` is empty (RAG skipped) |

---

## Quick Test Scripts

### Python API Test Runner

```python
"""ChatWave API Test Runner — paste into Antigravity IDE or run standalone."""
import httpx, json, asyncio, os

BASE = "http://localhost:8000/api"
PDF = r"C:\Users\aksha\Desktop\chatWave\zero to one by Peter theil.pdf"

passed, failed, errors = 0, 0, []

class Client:
    def __init__(self):
        self.c = httpx.AsyncClient(base_url=BASE, follow_redirects=True)
        self.cookies = {}

    async def csrf(self):
        r = await self.c.get("/auth/csrf-token")
        ct = r.cookies.get("csrf_token")
        self.cookies["csrf_token"] = ct
        self._csrf_header = r.json().get("csrfToken", "")
        return self

    async def get(self, path, **kw):
        kw.setdefault("cookies", {}).update(self.cookies)
        return await self.c.get(path, **kw)

    async def post(self, path, **kw):
        kw.setdefault("cookies", {}).update(self.cookies)
        kw.setdefault("headers", {})["X-CSRF-Token"] = self._csrf_header
        return await self.c.post(path, **kw)

    async def put(self, path, **kw):
        kw.setdefault("cookies", {}).update(self.cookies)
        kw.setdefault("headers", {})["X-CSRF-Token"] = self._csrf_header
        return await self.c.put(path, **kw)

    async def delete(self, path, **kw):
        kw.setdefault("cookies", {}).update(self.cookies)
        kw.setdefault("headers", {})["X-CSRF-Token"] = self._csrf_header
        return await self.c.delete(path, **kw)

async def test(name, func):
    global passed, failed
    try:
        await func()
        print(f"  ✅ {name}")
        passed += 1
    except Exception as e:
        print(f"  ❌ {name}: {e}")
        failed += 1
        errors.append((name, str(e)))

async def run():
    global passed, failed
    client = Client()
    await client.csrf()

    print("\n═══ A1: Health & Connectivity ═══")
    async def t1():
        r = await client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["services"]["mongodb"] is True
    await test("A1.1 Health check", t1)

    async def t2():
        r = await client.get("/health/live")
        assert r.status_code == 200
        assert r.json()["status"] == "alive"
    await test("A1.2 Liveness", t2)

    async def t3():
        r = await client.get("/metrics")
        assert r.status_code == 200
        assert "text/plain" in r.headers.get("content-type", "")
    await test("A1.3 Prometheus metrics", t3)

    async def t4():
        r = await client.get("/")
        assert r.status_code == 200
        assert r.json()["name"] == "ChatWave v2"
    await test("A1.4 Root endpoint", t4)

    print("\n═══ A2: Register Accounts ═══")
    stu_payload = {"name":"Alice Student","college_id":"STU001","password":"StrongP@ss123","college_name":"TestU","department":"CS","role":"student"}
    fac_payload = {"name":"Bob Faculty","college_id":"FAC001","password":"StrongP@ss123","college_name":"TestU","department":"CS","role":"faculty"}
    adm_payload = {"name":"Carol Admin","college_id":"ADM001","password":"StrongP@ss123","college_name":"TestU","department":"CS","role":"admin"}

    async def t5():
        r = await client.post("/auth/register", json=stu_payload)
        assert r.status_code in (201, 409), f"Got {r.status_code}: {r.text}"
        if r.status_code == 201:
            assert "user" in r.json()
    await test("A2.1 Register student", t5)

    async def t6():
        r = await client.post("/auth/register", json=fac_payload)
        assert r.status_code in (201, 409)
    await test("A2.2 Register faculty", t6)

    async def t7():
        r = await client.post("/auth/register", json=adm_payload)
        assert r.status_code in (201, 409)
    await test("A2.3 Register admin", t7)

    async def t8():
        r = await client.post("/auth/register", json=stu_payload)
        assert r.status_code == 409
    await test("A2.4 Duplicate register → 409", t8)

    async def t9():
        r = await client.post("/auth/register", json={"name":"X","college_id":"WEAK","password":"abc","college_name":"TestU","role":"student"})
        assert r.status_code == 422
    await test("A2.5 Weak password → 422", t9)

    print("\n═══ A3: Login & Session ═══")
    async def t10():
        r = await client.post("/auth/login", json={"college_id":"STU001","password":"StrongP@ss123","role":"student"})
        assert r.status_code == 200
        assert "access_token" in r.cookies
    await test("A3.1 Login student", t10)

    async def t11():
        r = await client.post("/auth/login", json={"college_id":"STU001","password":"wrong","role":"student"})
        assert r.status_code == 401
    await test("A3.2 Wrong password → 401", t11)

    async def t12():
        r = await client.post("/auth/login", json={"college_id":"STU001","password":"StrongP@ss123","role":"admin"})
        assert r.status_code == 401
    await test("A3.3 Wrong role → 401", t12)

    async def t13():
        r = await client.get("/auth/me")
        assert r.status_code == 200
        assert r.json()["name"] == "Alice Student"
    await test("A3.4 GET /me", t13)

    async def t14():
        r = await client.post("/auth/refresh")
        assert r.status_code == 200
    await test("A3.5 Token refresh", t14)

    # Continue with remaining tests...
    print("\n═══ (Continue test cases A4-A17 following the table above) ═══")

    print(f"\n{'='*50}")
    print(f"Results: {passed} passed, {failed} failed, {passed+failed} total")
    if errors:
        print("\nFailures:")
        for name, err in errors:
            print(f"  - {name}: {err}")

if __name__ == "__main__":
    asyncio.run(run())
```

---

### Playwright Test Template

```typescript
// tests/chatwave.spec.ts — Run with: npx playwright test tests/chatwave.spec.ts
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('B2: Student Chat + Mode Toggle', () => {
  test.beforeEach(async ({ page }) => {
    // Login as student
    await page.goto(`${BASE}/login`);
    await page.fill('input[placeholder*="college" i], input[type="text"]', 'STU001');
    await page.fill('input[type="password"]', 'StrongP@ss123');
    // Select student role
    const roleSelect = page.locator('select, [role="listbox"]').first();
    if (await roleSelect.isVisible()) await roleSelect.selectOption('student');
    await page.click('button[type="submit"], button:has-text("Login")');
    await page.waitForURL('**/student', { timeout: 10000 });
  });

  test('76: Chat tab active by default', async ({ page }) => {
    await expect(page.locator('text=ChatWave AI')).toBeVisible();
  });

  test('77: Empty state shows suggestions', async ({ page }) => {
    await expect(page.locator('text=How can I help you today')).toBeVisible();
  });

  test('78: College mode is default', async ({ page }) => {
    const collegeBtn = page.locator('button:has-text("College")');
    await expect(collegeBtn).toHaveClass(/bg-cw-blue/); // active state
    await expect(page.locator('text=Answers from your college only')).toBeVisible();
  });

  test('79: Switch to General mode', async ({ page }) => {
    await page.click('button:has-text("General")');
    await expect(page.locator('text=General AI mode')).toBeVisible();
  });

  test('80: Send message in General mode', async ({ page }) => {
    await page.click('button:has-text("General")');
    await page.fill('input[placeholder*="Ask anything"]', 'What is 2+2?');
    await page.press('input[placeholder*="Ask anything"]', 'Enter');
    await expect(page.locator('text=Thinking...')).toBeVisible({ timeout: 5000 });
  });

  test('85: Clear chat', async ({ page }) => {
    await page.click('button:has-text("Clear")');
    await expect(page.locator('text=How can I help you today')).toBeVisible();
  });
});

test.describe('B5: Faculty Upload + Announcements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="text"]', 'FAC001');
    await page.fill('input[type="password"]', 'StrongP@ss123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/faculty', { timeout: 10000 });
  });

  test('97: Faculty Dashboard renders', async ({ page }) => {
    await expect(page.locator('text=Faculty Portal')).toBeVisible();
    await expect(page.locator('text=Upload Document')).toBeVisible();
    await expect(page.locator('text=Broadcast Center')).toBeVisible();
  });
});
```

---

## Execution Order

1. **Start servers** (backend + frontend)
2. **Run Part A** (Python API tests) — all 68 tests
3. **Run Part B** (Playwright) — all 51 tests
4. **Run Part C** (RAG verification) — 3 tests (after ingestion completes)

**Expected total time:** ~15 minutes (Part A: 5min, Part B: 8min, Part C: 2min)

---

*Generated for Antigravity IDE execution. See `backend_py/app/tests/` for existing unit tests.*
