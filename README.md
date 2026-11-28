# GenAI-Chatbot

A full-stack, production-hardened GenAI chatbot built with **FastAPI**, **Next.js**, **LangChain**, and **Neon PostgreSQL (pgvector)**. It supports authenticated multi-turn conversations, automatic primary-to-fallback LLM routing (**Mistral AI → Google Gemini**), PDF document ingestion with **Cloudinary** storage, and Retrieval-Augmented Generation (**RAG**) with inline source citations.

---

## Key Features

- **Multi-Provider Chat with Automatic Fallback**: Uses Mistral AI (`open-mistral-7b`) as the primary LLM and automatically falls back to Google Gemini (`gemini-3.5-flash-lite`) on transient failures, rate limits, timeouts, or quota errors—returning the active `provider` in every response.
- **JWT Authentication & Password Hardening**: Registration, login, and protected endpoints powered by `PyJWT` (`HS256`) and `bcrypt` password hashing, enforcing 8+ character passwords with at least one letter and one digit.
- **Persistent Conversation Management**: Full conversation history stored in PostgreSQL with auto-generated titles, renaming, deletion, and pinning (up to 7 pinned chats per user).
- **PDF Upload & RAG Document Chat**:
  - Validates PDF extension, MIME type, `%PDF` signature, and 10 MB max upload size.
  - Stores raw PDFs securely in **Cloudinary** under `authenticated` delivery mode with compensating cleanup on failure.
  - Extracts page-level text via `PyPDFLoader`, splits text with `RecursiveCharacterTextSplitter` (chunk size `1000`, overlap `200`), and generates 384-dimensional embeddings using `sentence-transformers/all-MiniLM-L6-v2`.
  - Performs cosine similarity vector search in **Neon PostgreSQL (`pgvector` + HNSW index)** strictly isolated by `user_id` and optional `document_id`, returning citations (`document_filename`, `page_number`, `chunk_id`, `similarity_score`).
- **Security, Reliability & Observability (Phase 6)**:
  - Explicit CORS origin/method/header allowlists and production JWT secret enforcement.
  - Endpoint-specific rate limiting via `slowapi` (with optional Redis backend for multi-worker deployments).
  - Bounded exponential-backoff retries with jitter, `Retry-After` header support, and explicit SDK timeouts.
  - Structured JSON logging (production) / readable console logging (development) with `contextvars`-isolated `X-Request-ID` tracing and secret redaction.

---

## Technology Stack

### Backend
- **Framework**: FastAPI, Uvicorn
- **Language**: Python 3.11+ (verified on Python 3.14)
- **LLM & RAG**: LangChain (`langchain-core`, `langchain-mistralai`, `langchain-google-genai`, `langchain-community`, `langchain-text-splitters`)
- **Embeddings**: `sentence-transformers` (`all-MiniLM-L6-v2`, 384 dimensions)
- **Database & Vector Search**: SQLAlchemy 2.0+, PostgreSQL (Neon), `psycopg2-binary`, `pgvector`
- **PDF & Storage**: `pypdf`, `cloudinary`
- **Security & Rate Limiting**: `PyJWT[crypto]`, `bcrypt`, `pydantic-settings`, `slowapi`, `redis`

### Frontend
- **Framework**: Next.js 16.4.3 (App Router, Turbopack), React 19.3.0
- **Language**: TypeScript 5
- **Styling & UI**: Tailwind CSS v4, `lucide-react`, `sonner`
- **HTTP Client**: Axios (`src/lib/api.ts`)
- **Testing**: Vitest, React Testing Library, `@testing-library/jest-dom`, `jsdom`

---

## Architecture

```text
User (Browser)
  │
  ▼
Next.js Frontend (React 19, Axios + X-Request-ID + Bearer JWT)
  │  HTTP / JSON (CORS + 45s default / 90s upload timeout)
  ▼
FastAPI Backend (main.py)
  ├─ RequestContextMiddleware (X-Request-ID validation/generation + lifecycle logging)
  ├─ CORSMiddleware (Explicit origin/method/header whitelist)
  ├─ SlowAPIMiddleware (Rate limiting per IP / authenticated user)
  │
  ├─► /api/auth/*          ──► JWT (HS256) + bcrypt + PostgreSQL (users)
  ├─► /api/conversations/* ──► Ownership-scoped CRUD + PostgreSQL (conversations, messages)
  ├─► /api/documents/*     ──► PDF validation → Cloudinary (raw/authenticated)
  │                              → PyPDFLoader → Splitter → all-MiniLM-L6-v2
  │                              → PostgreSQL + pgvector HNSW (documents, document_chunks)
  └─► /api/chat            ──► Optional RAG (retrieval_service + rag_service LCEL)
                                 → llm_service (bounded retries + timeout)
                                     ├─ Primary: Mistral AI
                                     └─ Fallback: Google Gemini
```

---

## Project Structure

```text
GenAI-Chatbot/
├── README.md                          # Project overview, setup, and environment reference
├── run.bat                            # Windows convenience script to start backend & frontend
├── docs/
│   ├── API.md                         # REST API endpoints, rate limits, and error contracts
│   ├── DEPLOYMENT.md                  # Production readiness, deployment guide & checklist
│   ├── PHASE_1_BACKEND.md             # Phase 1 notes
│   ├── PHASE_2.md                     # Phase 2 notes
│   └── PHASE-3-README.md              # Phase 3 notes
├── backend/
│   ├── main.py                        # FastAPI app, lifespan, middleware, global error handler
│   ├── requirements.txt               # Python dependencies
│   ├── .env.example                   # Backend environment template
│   └── app/
│       ├── config.py                  # Pydantic Settings & validation
│       ├── core/
│       │   ├── deps.py                # Auth dependency & SlowAPI rate limiter
│       │   ├── logging.py             # Structured JSON/dev logging & X-Request-ID contextvars
│       │   ├── retry.py               # Bounded retry policy, Retry-After, DB read retries
│       │   └── security.py            # bcrypt hashing & JWT creation/verification
│       ├── db/
│       │   ├── models.py              # User, Conversation, Message, Document, DocumentChunk
│       │   ├── session.py             # SQLAlchemy engine, Neon pool settings & get_db
│       │   └── migrations/            # Idempotent SQL migrations & run_migrations.py
│       ├── routes/                    # auth.py, chat.py, conversations.py, documents.py
│       ├── schemas/                   # Pydantic request/response schemas
│       └── services/                  # llm_service, rag_service, retrieval_service, etc.
└── frontend/
    ├── package.json                   # Next.js scripts & Vitest dependencies
    ├── .env.local.example             # Frontend environment template
    ├── vitest.config.mts              # Vitest + jsdom + v8 coverage configuration
    ├── vitest.setup.ts                # Global test mocks & jest-dom setup
    └── src/
        ├── app/                       # App Router pages (/, /login, /register)
        ├── components/                # Chat, Document, Layout, and UI dialog components
        ├── contexts/                  # AuthContext
        ├── hooks/                     # useChat, useDocuments, useAuth, useDebounce
        ├── lib/api.ts                 # Axios client, interceptors & API functions
        ├── types/                     # TypeScript interfaces
        └── __tests__/                 # Vitest unit, integration & reliability tests
```

---

## Local Setup Guide (Windows PowerShell)

### Prerequisites
- **Python**: 3.11+
- **Node.js**: 20+ and `npm`
- **PostgreSQL**: Neon PostgreSQL (or PostgreSQL 15+ with the `vector` / `pgvector` extension enabled)
- **External Accounts**: Mistral API key, Google Gemini API key, and Cloudinary credentials

### 1. Backend Setup

```powershell
cd backend

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
Copy-Item .env.example .env
# Edit backend/.env with your DATABASE_URL, MISTRAL_API_KEY, GOOGLE_API_KEY, and Cloudinary credentials

# Start FastAPI development server (http://127.0.0.1:8000)
python -m uvicorn main:app --reload --port 8000
```

Interactive OpenAPI/Swagger documentation is available at `http://127.0.0.1:8000/docs`.

### 2. Database Setup & Migrations

On startup, `main.py` automatically runs `Base.metadata.create_all(bind=engine)` and `apply_migrations()`, which executes the idempotent SQL files in `backend/app/db/migrations/`:
- `001_create_users_and_add_user_id.sql`: Creates `users` table and adds `user_id` ownership foreign keys and indexes.
- `002_create_documents_and_chunks.sql`: Enables `CREATE EXTENSION IF NOT EXISTS vector`, creates `documents` and `document_chunks` (`vector(384)`), and creates the HNSW cosine similarity index (`document_chunks_embedding_hnsw_idx`).

To run and verify migrations manually:

```powershell
cd backend
python -m app.db.migrations.run_migrations
```

### 3. Frontend Setup

```powershell
cd frontend

# Install dependencies
npm install

# Configure environment variables
Copy-Item .env.local.example .env.local

# Start Next.js development server (http://localhost:3000)
npm run dev
```

*(Optional)* On Windows, you can launch both servers simultaneously using `run.bat` from the repository root.

---

## Environment Variables Reference

Never commit `.env` or `.env.local` files containing real credentials.

| Variable | Component | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `ENVIRONMENT` | Backend | No | `development` | Runtime mode (`development`, `production`, `staging`, `test`). |
| `LOG_LEVEL` | Backend | No | `INFO` | Root logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |
| `LOG_FORMAT` | Backend | No | `auto` | Log format (`auto`, `json`, `text`). `auto` emits JSON in production/staging. |
| `DATABASE_URL` | Backend | **Yes** | `""` | PostgreSQL/Neon connection string (`postgresql://...`). |
| `MISTRAL_API_KEY` | Backend | **Yes** | `""` | API key for primary Mistral AI provider. |
| `MISTRAL_MODEL` | Backend | No | `open-mistral-7b` | Mistral chat model identifier. |
| `GOOGLE_API_KEY` | Backend | Recommended | `""` | API key for Gemini fallback (`GEMINI_API_KEY` also supported). |
| `GEMINI_MODEL` | Backend | No | `gemini-3.5-flash-lite` | Google Gemini fallback model identifier. |
| `JWT_SECRET_KEY` | Backend | **Prod Yes** | `dev-jwt-secret-key-change-in-production` | HS256 signing key. Required, non-default, and `>= 32` chars in production. |
| `JWT_ALGORITHM` | Backend | No | `HS256` | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Backend | No | `30` | JWT expiration duration in minutes. |
| `CORS_ORIGINS` | Backend | No | `["http://localhost:3000","http://127.0.0.1:3000"]` | Allowed frontend origins (comma-separated or JSON array). |
| `CLOUDINARY_CLOUD_NAME` / `CLOUD_NAME` | Backend | **Yes** (uploads) | `""` | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` / `API_KEY` | Backend | **Yes** (uploads) | `""` | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` / `API_SECRET` | Backend | **Yes** (uploads) | `""` | Cloudinary API secret. |
| `EMBEDDING_MODEL_NAME` | Backend | No | `sentence-transformers/all-MiniLM-L6-v2` | Hugging Face embedding model name. |
| `EMBEDDING_DIMENSION` | Backend | No | `384` | Vector embedding dimension (must match `vector(384)` schema). |
| `RATE_LIMITING_ENABLED` | Backend | No | `True` | Enables or disables SlowAPI rate limiting. |
| `RATE_LIMIT_STORAGE_URL` | Backend | Prod Recommended | `memory://` | Rate-limit counter backend (`memory://` or `redis://...`). |
| `RATE_LIMIT_DEFAULT` | Backend | No | `120/minute` | Default rate limit for authenticated CRUD routes. |
| `RATE_LIMIT_AUTH_LOGIN` | Backend | No | `10/minute` | Per-IP rate limit for `POST /api/auth/login`. |
| `RATE_LIMIT_AUTH_REGISTER` | Backend | No | `10/minute` | Per-IP rate limit for `POST /api/auth/register`. |
| `RATE_LIMIT_CHAT` | Backend | No | `30/minute` | Rate limit for `POST /api/chat`. |
| `RATE_LIMIT_DOCUMENT_UPLOAD` | Backend | No | `20/minute` | Rate limit for `POST /api/documents/upload`. |
| `RATE_LIMIT_DOCUMENT_SEARCH` | Backend | No | `60/minute` | Rate limit for `POST /api/documents/search`. |
| `LLM_MAX_RETRIES` | Backend | No | `2` | Bounded retries (`0–5`) after initial LLM attempt. |
| `LLM_INITIAL_RETRY_DELAY` | Backend | No | `0.5` | Initial exponential backoff delay in seconds. |
| `LLM_MAX_RETRY_DELAY` | Backend | No | `8.0` | Maximum retry backoff cap in seconds. |
| `LLM_RETRY_JITTER` | Backend | No | `True` | Enables equal jitter on LLM retry delays. |
| `MISTRAL_TIMEOUT_SECONDS` | Backend | No | `30.0` | Per-attempt timeout for Mistral API calls. |
| `GEMINI_TIMEOUT_SECONDS` | Backend | No | `30.0` | Per-attempt timeout for Gemini fallback calls. |
| `CLOUDINARY_TIMEOUT_SECONDS` | Backend | No | `30.0` | Timeout for Cloudinary upload/destroy calls. |
| `CLOUDINARY_MAX_RETRIES` | Backend | No | `2` | Bounded retries (`0–5`) for transient Cloudinary errors. |
| `DB_CONNECT_TIMEOUT_SECONDS` | Backend | No | `10` | PostgreSQL TCP connection timeout in seconds. |
| `DB_STATEMENT_TIMEOUT_MS` | Backend | No | `15000` | Configured statement timeout value (ms) in settings. |
| `DB_READ_MAX_RETRIES` | Backend | No | `1` | Bounded retries (`0–3`) for idempotent DB reads. |
| `NEXT_PUBLIC_API_URL` | Frontend | No | `http://127.0.0.1:8000` | Base URL of the FastAPI backend. |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | Frontend | No | `45000` | Default Axios request timeout in milliseconds (uploads use `>= 90000`). |

---

## Testing & Quality Assurance

### Backend Tests (`pytest`)
Uses an isolated in-memory SQLite database and mocks external LLM and Cloudinary calls:
```powershell
cd backend
python -m pytest -v
```
*Last verified result*: **96 passed, 0 failed**.

### Frontend Tests (`Vitest` & React Testing Library)
```powershell
cd frontend
npm run test:run        # Run all 13 suites (81 tests)
npm run test:coverage   # Run tests with v8 coverage report
```
*Last verified result*: **13 test files passed, 81 tests passed, 0 failed**.

### Frontend TypeScript & Production Build
```powershell
cd frontend
npm run build
```
*Last verified result*: **Exited with code 0** (TypeScript + Turbopack + 8/8 static routes).

---

## Additional Documentation
- [API Reference](file:///c:/Users/baps/OneDrive/Desktop/GenAI-Chatbot/docs/API.md)
- [Deployment Readiness & Guide](file:///c:/Users/baps/OneDrive/Desktop/GenAI-Chatbot/docs/DEPLOYMENT.md)
