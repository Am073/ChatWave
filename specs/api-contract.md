# API Contract

The FastAPI backend should initially preserve current frontend-facing routes where practical.

## Compatibility Rules

- Preserve `/api/*` prefix.
- Preserve response shape where frontend depends on it.
- Add new metadata fields without breaking existing fields.
- Keep auth cookie behavior compatible where possible.
- Version new agent/quality APIs if they are not v1-compatible.

## Core Routes

| Capability | Method | Path | Notes |
|------------|--------|------|-------|
| Register | `POST` | `/api/auth/register` | Create user |
| Login | `POST` | `/api/auth/login` | Set secure auth cookies or return compatible auth response |
| Logout | `POST` | `/api/auth/logout` | Clear auth state |
| Current user | `GET` | `/api/auth/me` | Return authenticated user |
| Chat | `POST` | `/api/chat` | Return answer and sources |
| Chat history | `GET` | `/api/chat/history` | Return user chat history |
| Clear chat history | `DELETE` | `/api/chat/history` | Clear user history |
| Stream chat | `GET/POST` | `/api/chat/stream` | SSE or fetch-streaming endpoint |
| Upload document | `POST` | `/api/upload` | Upload and enqueue ingestion |
| List documents | `GET` | `/api/upload` | Tenant-scoped document list |
| Document status | `GET` | `/api/upload/{id}/status` | Poll ingestion status |
| Delete document | `DELETE` | `/api/upload/{id}` | Delete document and vectors |
| List announcements | `GET` | `/api/announcements` | Role/department scoped |
| Create announcement | `POST` | `/api/announcements` | Faculty/admin only |
| Admin stats | `GET` | `/api/admin/stats` | Admin only |
| Admin health | `GET` | `/api/admin/health` | Admin only |
| Health | `GET` | `/api/health` | Public or protected depending on deployment |

## Chat Response

Baseline response:

```json
{
  "answer": "string",
  "sources": [
    {
      "documentId": "string",
      "chunkIndex": 0,
      "title": "string",
      "page": 1,
      "score": 0.92,
      "text": "short excerpt"
    }
  ],
  "sessionId": "string",
  "traceId": "string",
  "model": "string",
  "confidence": "high"
}
```

Compatibility note:

- Existing frontend may only require `answer` and `sources`.
- New fields should be optional for older UI flows.

## Streaming Event Types

Recommended event shapes:

```json
{ "type": "status", "stage": "retrieving" }
{ "type": "tool_call", "tool": "search_documents" }
{ "type": "chunk", "text": "partial answer" }
{ "type": "sources", "sources": [] }
{ "type": "final", "traceId": "trace-id", "model": "model-name" }
{ "type": "error", "message": "safe error message" }
```

## Auth For Streaming

Preferred:

- Same-site secure cookie auth, or
- `fetch` streaming with `Authorization`/CSRF headers.

Avoid:

- Long-lived tokens in query parameters.

