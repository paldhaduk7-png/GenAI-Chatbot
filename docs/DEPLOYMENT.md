# Deployment Readiness & Production Guide

This guide covers deploying **GenAI-Chatbot** based on its verified FastAPI, Next.js, Neon PostgreSQL (`pgvector`), and Cloudinary architecture.

---

## 1. Deployment Readiness Overview

### Backend (FastAPI)
- **Production Mode**: Set `ENVIRONMENT=production`. Startup validation in `app/config.py` enforces that `JWT_SECRET_KEY` is non-empty, not the development default, and at least 32 characters long.
- **Logging**: With `ENVIRONMENT=production` (or `LOG_FORMAT=json`), logs emit single-line JSON with `X-Request-ID`, `duration_ms`, and defensive secret redaction.
- **Timeouts & Retries**: Configured via `MISTRAL_TIMEOUT_SECONDS` (30s), `GEMINI_TIMEOUT_SECONDS` (30s), `CLOUDINARY_TIMEOUT_SECONDS` (30s), `LLM_MAX_RETRIES` (2), `CLOUDINARY_MAX_RETRIES` (2), and `DB_CONNECT_TIMEOUT_SECONDS` (10s).
- **Rate Limiting**: `slowapi` defaults to `memory://`. For multi-worker or multi-instance production deployments, provision Redis and set `RATE_LIMIT_STORAGE_URL=redis://...`.
- **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2` (~80–120 MB) is downloaded on first embedding use and cached in `~/.cache/huggingface/hub`. Ensure sufficient container memory and disk/cache persistence.

### Frontend (Next.js)
- **Production Build**: `npm run build` compiles with Turbopack and validates TypeScript.
- **API Configuration**: Set `NEXT_PUBLIC_API_URL` at build/runtime to the HTTPS URL of your deployed FastAPI backend, and optionally `NEXT_PUBLIC_API_TIMEOUT_MS` (default `45000` ms).
- **Authentication**: Uses `localStorage` JWT bearer tokens (`Authorization: Bearer <token>`). Serve both frontend and backend over **HTTPS** in production.

### Database (Neon PostgreSQL + pgvector)
- **Connection Pooling**: `app/db/session.py` configures `pool_pre_ping=True`, `pool_recycle=300`, `pool_size=10`, `max_overflow=20`, `pool_timeout=30`, and `connect_timeout=10` (compatible with Neon's `-pooler` endpoint).
- **Migrations & Indexes**: Startup automatically creates missing tables and runs idempotent SQL migrations in `backend/app/db/migrations/` (enabling `vector` extension and creating `document_chunks_embedding_hnsw_idx`).

### External Services
- **Mistral AI** (`MISTRAL_API_KEY`): Primary chat LLM.
- **Google Gemini** (`GOOGLE_API_KEY` or `GEMINI_API_KEY`): Fallback chat LLM.
- **Cloudinary** (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`): Authenticated raw PDF storage.
- **Redis** (`RATE_LIMIT_STORAGE_URL`): Recommended when running multiple Uvicorn/Gunicorn workers.

---

## 2. Step-by-Step Deployment Guide

### Step 1: Prepare Database & External Services
1. Provision a **Neon PostgreSQL** project and copy its pooled `postgresql://...?sslmode=require` connection string.
2. Obtain API keys for **Mistral AI**, **Google Gemini**, and **Cloudinary**.
3. *(Recommended for multi-worker)* Provision a managed **Redis** instance for `RATE_LIMIT_STORAGE_URL`.

### Step 2: Deploy Backend
1. Set environment variables in your hosting platform (e.g., Render, Railway, Fly.io, AWS/GCP):
   - `ENVIRONMENT=production`
   - `DATABASE_URL=<neon-postgresql-url>`
   - `JWT_SECRET_KEY=<64-char-random-hex>` (generate via `python -c "import secrets; print(secrets.token_hex(32))"`)
   - `CORS_ORIGINS=https://your-frontend-domain.com`
   - `MISTRAL_API_KEY`, `GOOGLE_API_KEY`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `RATE_LIMIT_STORAGE_URL=redis://...` (if using multiple workers)
2. Install dependencies: `pip install -r requirements.txt`
3. Start command (from `backend/`):
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
   *(If running multiple workers, ensure `RATE_LIMIT_STORAGE_URL` points to Redis.)*

### Step 3: Deploy Frontend
1. Set build/runtime environment variables (e.g., Vercel, Render, Node server):
   - `NEXT_PUBLIC_API_URL=https://your-backend-domain.com`
   - `NEXT_PUBLIC_API_TIMEOUT_MS=45000`
2. Build and start (from `frontend/`):
   ```bash
   npm ci
   npm run build
   npm run start
   ```

### Step 4: Post-Deployment Verification
1. Check backend health: `GET https://your-backend-domain.com/health` → expect HTTP `200` and an `X-Request-ID` response header.
2. Verify Swagger docs or register/login from the frontend over HTTPS.
3. Send a test chat message (verify `provider` badge renders), upload a small PDF, and run a RAG query with citations.

---

## 3. Security & Operational Checklist

- [ ] **Strong JWT Secret**: `JWT_SECRET_KEY` is unique, non-default, and `>= 32` characters (`ENVIRONMENT=production`).
- [ ] **Required API Keys**: `MISTRAL_API_KEY`, `GOOGLE_API_KEY`, and Cloudinary credentials are set in secret storage (never in Git).
- [ ] **CORS Origins**: `CORS_ORIGINS` is restricted to the exact production frontend HTTPS origin(s) (no `*`).
- [ ] **HTTPS Enforced**: Both frontend and backend are served exclusively over HTTPS.
- [ ] **Database Connectivity**: `DATABASE_URL` uses SSL (`sslmode=require`) and `pgvector` extension + HNSW index are active.
- [ ] **Redis for Rate Limiting**: `RATE_LIMIT_STORAGE_URL` uses `redis://...` when running `> 1` backend worker.
- [ ] **Logging & Privacy**: `LOG_FORMAT=auto` (or `json`) in production; no prompts, PDF text, tokens, or keys appear in logs.
- [ ] **Request IDs**: `X-Request-ID` is present on success and error responses (`expose_headers` includes `X-Request-ID`).
- [ ] **Error Sanitization**: Global exception handler and upload routes return generic messages without stack traces or SQL details.
- [ ] **Upload Limits**: 10 MB PDF size limit, MIME/magic-byte validation, and Cloudinary `authenticated` delivery mode remain enabled.
- [ ] **Authentication**: Registration enforces `>= 8` chars with letter + digit; protected routes enforce Bearer JWT + user ownership.
- [ ] **Rate Limits**: `RATE_LIMITING_ENABLED=True` with appropriate per-endpoint limits.
- [ ] **Retry Handling**: Bounded retries (`LLM_MAX_RETRIES=2`, `CLOUDINARY_MAX_RETRIES=2`) and timeouts (`30.0`s) are active.
- [ ] **Health Checks**: Platform health check targets `GET /health`.
- [ ] **Environment Hygiene**: `.env` and `.env.local` are excluded from version control.
- [ ] **Production Build**: `frontend` passes `npm run build` and both test suites pass before release.
