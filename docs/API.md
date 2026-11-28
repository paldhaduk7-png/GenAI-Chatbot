# GenAI-Chatbot API Reference

Interactive Swagger UI is served at `/docs` and ReDoc at `/redoc` when the FastAPI server is running.

---

## Common Headers & Behaviors

- **Authentication**: Protected endpoints require `Authorization: Bearer <access_token>`. Missing or invalid tokens return `401 Unauthorized`.
- **Request Tracing (`X-Request-ID`)**:
  - Clients may send an alphanumeric/safe `X-Request-ID` header (max 64 chars, matching `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`).
  - Missing, invalid, or oversized IDs are replaced with a server-generated UUID4.
  - Every HTTP response (including `4xx`/`5xx` errors and `429` rate-limit rejections) returns `X-Request-ID`.
- **Rate Limiting**: Exceeding an endpoint limit returns `429 Too Many Requests` with a sanitized JSON detail message.
- **Sanitized Errors**: Internal exceptions, file paths, SQL details, and API keys are never returned to clients.

---

## 1. Health Endpoint

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | None | Exempt | Returns `{"status": "ok", "message": "GenAI Chatbot backend is running"}`. |

---

## 2. Authentication (`/api/auth`)

| Method | Path | Auth | Rate Limit | Status | Description |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | None | `10/minute` (per IP) | `201` | Registers a new user. Password requires `>= 8` chars, at least 1 letter (`A-Z`/`a-z`), and at least 1 digit (`0-9`). Returns `409` if email exists, `422` on validation error. |
| `POST` | `/api/auth/login` | None | `10/minute` (per IP) | `200` | Authenticates email/password and returns `{"access_token": "...", "token_type": "bearer"}`. Returns `401` on invalid credentials. |
| `GET` | `/api/auth/me` | Bearer | `120/minute` | `200` | Returns the authenticated user's public profile (`id`, `email`, `full_name`, `created_at`). |

---

## 3. Chat (`/api/chat`)

| Method | Path | Auth | Rate Limit | Status | Description |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/chat` | Bearer | `30/minute` | `200` | Sends user message(s), restores conversation history, invokes Mistral (with Gemini fallback), persists messages atomically, and returns assistant reply. |

### Request Body (`ChatRequest`)
```json
{
  "messages": [{ "role": "user", "content": "Summarize the Q3 report." }],
  "conversation_id": "optional-uuid",
  "document_id": "optional-document-uuid",
  "use_rag": true
}
```
- When `use_rag` is `true` and `document_id` is provided, the endpoint verifies document ownership (`404` if not found) and runs pgvector semantic retrieval + LCEL RAG generation.

### Response Body (`ChatResponse`)
```json
{
  "conversation_id": "uuid",
  "role": "assistant",
  "content": "...",
  "provider": "mistral",
  "sources": [
    {
      "document_id": "uuid",
      "document_filename": "report.pdf",
      "page_number": 2,
      "chunk_id": "uuid",
      "similarity_score": 0.912345
    }
  ],
  "has_sufficient_context": true
}
```
- Returns `400` if no user message is provided, `404` if `conversation_id` or `document_id` is not owned/found, `503` if both LLM providers or DB commit fail.

---

## 4. Conversations (`/api/conversations`)

All endpoints require Bearer authentication and enforce user ownership (`404` if not found or owned by another user). Default rate limit: `120/minute`.

| Method | Path | Status | Description |
| --- | --- | --- | --- |
| `GET` | `/api/conversations` | `200` | Lists user conversations sorted by `pinned DESC, updated_at DESC`. |
| `POST` | `/api/conversations` | `201` | Creates a new conversation (`{"title": "..."}`, optional). |
| `GET` | `/api/conversations/{conversation_id}` | `200` | Returns conversation details and chronological `messages`. |
| `PATCH` | `/api/conversations/{conversation_id}` | `200` | Updates conversation `title`. |
| `PATCH` | `/api/conversations/{conversation_id}/pin` | `200` | Toggles `pinned` status. Enforces a maximum of **7** pinned conversations (`400` if exceeded). |
| `DELETE` | `/api/conversations/{conversation_id}` | `200` | Deletes the conversation and its messages. |

---

## 5. Documents & Vector Search (`/api/documents`)

All endpoints require Bearer authentication and enforce user ownership.

| Method | Path | Rate Limit | Status | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/api/documents/upload` | `20/minute` | `201` | `multipart/form-data` (`file`). Validates `.pdf`, MIME type, `%PDF` header, and `<= 10 MB` (`413` if oversized). Uploads to Cloudinary, extracts text, chunks, embeds (384-dim), and indexes in pgvector. Cleans up temp files and Cloudinary assets on failure (`422`/`502`). |
| `GET` | `/api/documents` | `120/minute` | `200` | Lists all documents owned by the user (`created_at DESC`). |
| `GET` | `/api/documents/{document_id}` | `120/minute` | `200` | Returns metadata and processing status (`pending`, `processing`, `completed`, `failed`). |
| `DELETE` | `/api/documents/{document_id}` | `120/minute` | `200` | Deletes the document, its `document_chunks`, and the Cloudinary asset. |
| `POST` | `/api/documents/search` | `60/minute` | `200` | Semantic vector search across the user's chunks (`query`, optional `document_id`, `top_k`). |
