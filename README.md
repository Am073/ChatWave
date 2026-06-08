# ChatWave — Multi-tenant RAG Institutional Chatbot

ChatWave is a production-grade, multi-tenant RAG (Retrieval-Augmented Generation) institutional chatbot system built on a modern MERN stack. Designed for educational institutions, ChatWave allows students and faculty to search and interact with institutional knowledge bases (syllabi, schedules, regulations, documents) scoped dynamically to their college and department.

---

## 🚀 Key Features

*   **Multi-Tenant Architecture:** Complete data and vector isolation. Vector collections are dynamically scoped per tenant (`chatwave_{college_name_slug}`).
*   **Asynchronous Ingestion Pipeline:** Uses Node.js `worker_threads` to parse and chunk PDFs (`pdf-parse`), Word documents (`mammoth`), Excel sheets (`xlsx`), and Images (OCR via `node-tesseract-ocr`) in the background without blocking the Express event loop. Includes a robust, jittered exponential backoff retry system to gracefully manage external API rate limits (HTTP 429) during large file embeddings ingestion.
*   **Dual Chat Interface:**
    *   **REST API:** Lightweight stateless QA.
    *   **WebSocket Gateway:** Live streaming tokens with real-time citations and sources.
*   **Smart Calendar Integration:** Automatically extracts academic events (dates, exams, deadlines) from RAG conversations and syncs them directly to the user's Google Calendar.
*   **Announcement System:** Department-level and college-wide notification feeds with strict tenant isolation.
*   **Admin Control Panel:** Complete user administration (CRUD/moderation), knowledge base control, system health dashboard (live connection checking), and recent activity feed.

---

## 🛠️ Technology Stack

*   **Frontend:** React 19, Vite, Tailwind CSS, TanStack React Query v5, Framer Motion, Three.js (interactive canvas background).
*   **Backend:** Node.js, Express.js (v5), Socket.io (WebSocket gateway), Multer (memory storage file uploads).
*   **Database:** MongoDB, Mongoose (object mapping, query caching).
*   **Vector Engine:** Qdrant Cloud (dense vector similarity searches, dynamic collections).
*   **LLM Provider:** Google Gemini API (`@google/generative-ai` SDK) utilizing configurable models (e.g., `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-3.5-flash`) and `models/embedding-001` for text embeddings.

---

## 🔒 Security Design

*   **Authentication:** Session tokens are stored in secure, `HttpOnly`, and `SameSite=Lax` cookies (15m expiration for access tokens, 7d for refresh tokens).
*   **Double-Submit CSRF Protection:** Mutating REST routes require a custom `X-CSRF-Token` header that matches the decrypted `csrf_token` cookie.
*   **Role-Based Access Control (RBAC):** Strict middleware gating access to `student`, `faculty`, and `admin` routes.
*   **Rate Limiting:** IP-level limits on endpoints (100 req/min) and strict limits on authentication routes (10 req/15min).

---

## 📁 Repository Structure

```
chatwave/
├── .github/workflows/   # CI/CD workflows (GitHub Actions)
├── backend/
│   ├── src/
│   │   ├── config/      # Settings and Database configuration
│   │   ├── controllers/ # Route handler controllers
│   │   ├── middlewares/ # Auth, CSRF, Rate Limiting, Uploads
│   │   ├── models/      # Mongoose schemas (User, Document, ChatLog, etc.)
│   │   ├── providers/   # Gemini and Qdrant client wrappers
│   │   ├── routes/      # REST API route mappings
│   │   ├── services/    # Calendar sync, retrieval, socket services
│   │   ├── utils/       # Ingestion parsers (PDF, DOCX, OCR) and chunker
│   │   └── workers/     # Ingestion worker thread
│   ├── tests/           # Integration tests and Load testing suite
│   ├── app.js           # Express app setup
│   └── server.js        # Bootstrapper
├── frontend/
│   ├── src/
│   │   ├── components/  # Layout, Chat, Admin, Upload elements
│   │   ├── context/     # React state Context (Auth)
│   │   ├── hooks/       # React Query and WS hooks
│   │   ├── pages/       # Login, Dashboard, Admin views
│   │   └── services/    # Axios API service instances
│   ├── package.json
│   └── vite.config.js
```

---

## 🧪 Verification & QA

### Integration Tests
Run the comprehensive suite of 17 integration tests testing endpoints, role permissions, RAG flows, and websocket streaming:
```bash
cd backend
npm install
npm test
```

### Load Testing
Run high-concurrency autocannon stress tests verifying event loop stability and WebSocket round-trip efficiency:
```bash
cd backend
node tests/load-runner.js
```

---

## 📄 License
This project is licensed under the MIT License.
