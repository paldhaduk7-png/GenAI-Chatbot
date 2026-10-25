# Phase 3: User Authentication & Multi-Tenant Data Isolation Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Authentication Workflow Diagrams](#4-authentication-workflow-diagrams)
   - [A. User Registration Flow](#a-user-registration-flow)
   - [B. User Login & Token Issuance Flow](#b-user-login--token-issuance-flow)
   - [C. Authenticated Chat & Message Flow](#c-authenticated-chat--message-flow)
   - [D. Multi-Tenant Conversation Isolation](#d-multi-tenant-conversation-isolation)
   - [E. Logout & Session Termination Flow](#e-logout--session-termination-flow)
5. [Database Schema & Entity Relationships](#5-database-schema--entity-relationships)
   - [Entity Relationship Diagram](#entity-relationship-diagram)
   - [Models Detail](#models-detail)
   - [Legacy Data Handling](#legacy-data-handling)
6. [API Reference](#6-api-reference)
   - [Authentication Endpoints](#authentication-endpoints)
   - [Protected Chat & Conversation Endpoints](#protected-chat--conversation-endpoints)
7. [Security Measures & Best Practices](#7-security-measures--best-practices)
8. [Environment Configuration](#8-environment-configuration)
9. [Testing & Verification](#9-testing--verification)
10. [Project Structure](#10-project-structure)
11. [Known Limitations & Future Hardening](#11-known-limitations--future-hardening)
12. [Summary](#12-summary)

---

## 1. Project Overview

Phase 3 introduces **User Authentication**, **Session Authorization**, and **Multi-Tenant Data Isolation** to the **GenAI-Chatbot** platform. 

Building upon Phase 1 (dual-provider Mistral/Gemini fallback orchestration) and Phase 2 (PostgreSQL conversation persistence, pinning, and renaming), Phase 3 ensures that every user account operates within a completely private, isolated workspace:

- **Identity Management**: Secure user account registration and password authentication.
- **Cryptographic Security**: Passwords hashed using industry-standard `bcrypt` with unique salts; stateless authorization via signed JSON Web Tokens (`PyJWT`, `HS256`).
- **Strict Data Isolation**: Every conversation and message turn is bound to an authenticated user (`user_id`). Users can only query, rename, pin, delete, or append messages to conversations they own.
- **Probing Resistance**: Non-owned conversation lookups respond with HTTP `404 Not Found` rather than `403 Forbidden`, preventing attackers from enumerating or confirming valid conversation UUIDs.
- **Seamless Frontend Experience**: Cyberpunk-themed login and registration interfaces, global session state management via React Context (`AuthContext`), automatic JWT attachment via Axios request interceptors, and non-destructive session timeout handling.
- **Backward Compatibility**: Pre-Phase-3 legacy conversations (`user_id = NULL`) remain safely intact in PostgreSQL but are quarantined from authenticated users' dashboards.

---

## 2. Technology Stack

| Component | Technology | Version / Specification | Role in Phase 3 |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Next.js App Router | 16.x / React 19 / TypeScript 5 | Component rendering, protected routing, client-side state hydration |
| **Styling & UI** | Tailwind CSS v4 & Lucide Icons | Modern Cyber-Neon Theme | Responsive forms, glowing ambient elements, modals, spinners |
| **Notifications** | Sonner | 2.x | Cyber-styled toast notifications for feedback and error alerts |
| **HTTP Client** | Axios | 1.x | Bearer token injection, automatic 401 interception, API communication |
| **Backend Framework**| FastAPI | 0.115+ (Python 3.11+) | REST API routing, dependency injection (`Depends`), security middleware |
| **ORM / Data Layer** | SQLAlchemy | 2.0+ (Mappers 2.0 syntax) | Relational modeling, multi-tenant scoped querying, cascading operations |
| **Database Engine** | Neon Serverless PostgreSQL| PostgreSQL 16+ | ACID relational storage, foreign key constraints, indexing |
| **Password Hashing** | bcrypt | 4.0+ | Salting and hashing passwords via native C-bindings |
| **Token Management** | PyJWT | 2.8+ (`PyJWT[crypto]`) | Cryptographic signing, HMAC-SHA256, expiration claims verification |
| **Data Validation** | Pydantic & Pydantic-Settings | 2.x (`BaseModel`, `BaseSettings`)| Strict payload validation, email normalization, safe response schemas |
| **Testing** | Pytest & FastAPI TestClient | 8.x (`httpx` / Starlette) | End-to-end integration and security regression test suites |

---

## 3. Architecture Overview

Phase 3 enforces security and data boundaries across all tiers of the application:

```mermaid
flowchart TD
    subgraph Client ["Frontend Tier (Next.js 16 + React 19)"]
        LoginPage["Login Page (/login)"]
        RegPage["Register Page (/register)"]
        Dashboard["Protected Dashboard (/)"]
        AuthCtx["AuthContext & useAuth Hook"]
        AxiosClient["Axios Client (lib/api.ts)"]
        Storage[("Browser localStorage")]

        LoginPage -->|Submit Credentials| AuthCtx
        RegPage -->|Submit Details| AuthCtx
        Dashboard -->|Check State| AuthCtx
        AuthCtx <-->|Get/Set Token| Storage
        AuthCtx -->|Invoke API| AxiosClient
    end

    subgraph Backend ["Backend Tier (FastAPI + Python 3.11)"]
        AuthRouter["Auth Router (/api/auth)"]
        ChatRouter["Chat Router (/api/chat)"]
        ConvRouter["Conversations Router (/api/conversations)"]
        Deps["Auth Dependency (get_current_user)"]
        SecurityUtils["Security Utils (bcrypt + PyJWT)"]

        AxiosClient -->|POST /api/auth/register| AuthRouter
        AxiosClient -->|POST /api/auth/login| AuthRouter
        AxiosClient -->|GET /api/auth/me| AuthRouter
        AxiosClient -->|POST /api/chat + Bearer| ChatRouter
        AxiosClient -->|CRUD /api/conversations + Bearer| ConvRouter

        AuthRouter --> SecurityUtils
        ChatRouter --> Deps
        ConvRouter --> Deps
        Deps --> SecurityUtils
    end

    subgraph Persistence ["Persistence Tier (Neon PostgreSQL + SQLAlchemy)"]
        DB[(Neon PostgreSQL)]
        TUsers["users Table"]
        TConvs["conversations Table (user_id FK)"]
        TMsgs["messages Table (conversation_id FK)"]

        Deps -->|Lookup user by sub claim| TUsers
        AuthRouter -->|Create & verify user| TUsers
        ConvRouter -->|Filter WHERE user_id == user.id| TConvs
        ChatRouter -->|Verify owner & persist turns| TConvs
        TConvs --- TMsgs
        TUsers --- TConvs
        DB --- TUsers
    end
```

### Component Responsibilities

1. **Frontend Authentication Pages (`/login`, `/register`)**: Provide client-side form validation (length, regex, matching passwords), visual feedback (show/hide password, submitting spinners), and redirection logic.
2. **`AuthContext` & `useAuth` (`frontend/src/contexts/auth-context.tsx`)**: Central state manager tracking `user`, `token`, `isAuthenticated`, and `isLoading`. Subscribes to Axios 401 events to clear stale sessions cleanly.
3. **Axios Client (`frontend/src/lib/api.ts`)**: 
   - **Request Interceptor**: Extracts JWT from `localStorage` and injects `Authorization: Bearer <token>`.
   - **Response Interceptor**: Captures 401 Unauthorized responses to invoke session termination callbacks without triggering infinite loops.
4. **FastAPI Authentication Router (`backend/app/routes/auth.py`)**: Exposes `/register`, `/login`, and `/me`. Handles credential verification, duplicate prevention, and user profile serialization.
5. **Security Utilities (`backend/app/core/security.py`)**: Encapsulates `hash_password`, `verify_password`, `create_access_token`, and `decode_access_token`.
6. **Authentication Dependency (`backend/app/core/deps.py`)**: Implements `get_current_user` using `HTTPBearer(auto_error=False)`. Validates token structure, expiration, and loads the active user from the database.
7. **Database Models (`backend/app/db/models.py`)**: Defines `User`, `Conversation`, and `Message` models with foreign key constraints, indexes, and cascading relationships.
8. **Ownership Enforcement (`backend/app/routes/conversations.py` & `chat.py`)**: Filters all conversation lookups, mutations, and message queries by `Conversation.user_id == current_user.id`.

---

## 4. Authentication Workflow Diagrams

### A. User Registration Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Browser)
    participant Form as Register Page (React)
    participant API as Backend (POST /api/auth/register)
    participant DB as Neon PostgreSQL

    User->>Form: Enters Full Name, Email, Password, Confirm Password
    Form->>Form: Client validation (Email format, Password >= 8 chars, Passwords match)
    alt Client Validation Fails
        Form-->>User: Show inline validation errors
    else Validation Passes
        Form->>API: POST /api/auth/register {full_name, email, password}
        API->>API: Normalize email (strip & lowercase) + Pydantic validation
        API->>DB: Query SELECT User WHERE email = normalized_email
        alt Email Already Registered
            DB-->>API: Existing user found
            API-->>Form: HTTP 409 Conflict ("Account already exists")
            Form-->>User: Show error toast & highlight email field
        else Email Is Available
            API->>API: bcrypt.hashpw(password, bcrypt.gensalt())
            API->>DB: INSERT INTO users (id, email, full_name, hashed_password)
            DB-->>API: Commit successful
            API-->>Form: HTTP 201 Created (UserOut: id, email, full_name, created_at)
            Form-->>User: Show success toast & redirect to /login
        end
    end
```

---

### B. User Login & Token Issuance Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Browser)
    participant Form as Login Page (React)
    participant Context as AuthContext
    participant API as Backend (POST /api/auth/login)
    participant DB as Neon PostgreSQL

    User->>Form: Enters Email & Password
    Form->>Form: Client validation (valid email format, non-empty password)
    Form->>Context: login({email, password})
    Context->>API: POST /api/auth/login {email, password}
    API->>DB: SELECT User WHERE email = normalized_email
    alt User Not Found OR Password Invalid
        API->>API: verify_password(plain, hashed) == False
        API-->>Context: HTTP 401 Unauthorized ("Incorrect email or password")
        Context-->>Form: Propagate error
        Form-->>User: Show error toast (Generic message prevents user enumeration)
    else Credentials Valid
        API->>API: create_access_token({"sub": user.id, "email": user.email})
        API-->>Context: HTTP 200 OK {access_token, token_type: "bearer"}
        Context->>Context: setAuthToken(access_token) in localStorage
        Context->>API: GET /api/auth/me (Authorization: Bearer <token>)
        API->>DB: SELECT User WHERE id = sub
        DB-->>API: Return User row
        API-->>Context: HTTP 200 OK (UserOut profile)
        Context->>Context: Set user state, isAuthenticated = true
        Context-->>Form: Success
        Form-->>User: Redirect to Chat Dashboard (/)
    end
```

---

### C. Authenticated Chat & Message Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Authenticated User
    participant Frontend as Next.js Dashboard
    participant Interceptor as Axios Interceptor
    participant ChatAPI as FastAPI (POST /api/chat)
    participant Deps as get_current_user
    participant DB as Neon PostgreSQL
    participant LLM as LLM Orchestrator (Mistral / Gemini)

    User->>Frontend: Submits message: "Explain quantum computing"
    Frontend->>Interceptor: sendChatMessage(messages, conversation_id)
    Interceptor->>Interceptor: Inject header "Authorization: Bearer <jwt_token>"
    Interceptor->>ChatAPI: POST /api/chat {conversation_id, messages}
    ChatAPI->>Deps: Validate Bearer token
    alt Token Missing or Expired
        Deps-->>ChatAPI: Raises HTTPException(401)
        ChatAPI-->>Interceptor: HTTP 401 Unauthorized
        Interceptor->>Frontend: Clear token & invoke logout handler
    else Token Valid
        Deps-->>ChatAPI: Returns authenticated User instance
        alt conversation_id provided
            ChatAPI->>DB: SELECT Conversation WHERE id = conversation_id AND user_id = user.id
            alt Not Found or Belongs to Another User
                DB-->>ChatAPI: None
                ChatAPI-->>Frontend: HTTP 404 Not Found
            else Ownership Verified
                DB-->>ChatAPI: Conversation record
            end
        else conversation_id omitted
            ChatAPI->>DB: INSERT INTO conversations (user_id = user.id, title = snippet)
            DB-->>ChatAPI: Generates new conversation.id
        end
        ChatAPI->>DB: Load existing messages for context
        ChatAPI->>LLM: generate_chat_response(messages)
        LLM-->>ChatAPI: AI Response content + provider tag
        ChatAPI->>DB: INSERT user message & assistant message
        ChatAPI->>DB: UPDATE conversation updated_at = NOW()
        DB-->>ChatAPI: Commit transaction
        ChatAPI-->>Frontend: HTTP 200 OK {conversation_id, role, content, provider}
        Frontend-->>User: Render AI message turn with provider badge
    end
```

---

### D. Multi-Tenant Conversation Isolation

```mermaid
flowchart TD
    subgraph UserA_Space ["User A (Alice - ID: usr_aaa)"]
        ClientA["Alice's Browser (JWT: sub=usr_aaa)"]
        ListA["GET /api/conversations"]
        GetA["GET /api/conversations/conv_123"]
    end

    subgraph UserB_Space ["User B (Bob - ID: usr_bbb)"]
        ClientB["Bob's Browser (JWT: sub=usr_bbb)"]
        ListB["GET /api/conversations"]
        AttackB["GET /api/conversations/conv_123"]
    end

    subgraph Backend_Security ["FastAPI Security Boundary"]
        FilterA["WHERE user_id = 'usr_aaa'"]
        FilterB["WHERE user_id = 'usr_bbb'"]
    end

    subgraph Database ["PostgreSQL Relational Layer"]
        C1["Conversation conv_123 (user_id = 'usr_aaa')"]
        C2["Conversation conv_456 (user_id = 'usr_bbb')"]
        CLegacy["Legacy Conversation conv_999 (user_id = NULL)"]
    end

    ClientA --> ListA --> FilterA --> C1
    ClientA --> GetA --> FilterA -->|200 OK| C1

    ClientB --> ListB --> FilterB --> C2
    ClientB --> AttackB --> FilterB -->|404 Not Found (Zero Leakage)| C1

    FilterA -.->|Filtered out (user_id != 'usr_aaa')| CLegacy
    FilterB -.->|Filtered out (user_id != 'usr_bbb')| CLegacy
```

---

### E. Logout & Session Termination Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Authenticated User
    participant Sidebar as ChatSidebar
    participant Dialog as LogoutDialog (Modal)
    participant Context as AuthContext
    participant Storage as localStorage
    participant Router as Next.js Router

    User->>Sidebar: Clicks Sign out icon button in profile footer
    Sidebar->>Dialog: Opens confirmation dialog (Cyber-styled alert)
    User->>Dialog: Confirms "Sign out"
    Dialog->>Context: logout()
    Context->>Storage: localStorage.removeItem("genai_chat_access_token")
    Context->>Context: Reset state (user = null, token = null, isAuthenticated = false)
    Context->>Router: Redirects to /login
    Router-->>User: Renders Login Page
```

---

## 5. Database Schema & Entity Relationships

### Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ conversations : "owns (1:N)"
    conversations ||--o{ messages : "contains (1:N)"

    users {
        string(36) id PK "UUID string"
        string(255) email UK "Normalized, unique, indexed"
        string(255) hashed_password "bcrypt hash"
        string(100) full_name "Display name"
        timestamp created_at "UTC timezone-aware"
        timestamp updated_at "UTC timezone-aware"
    }

    conversations {
        string(36) id PK "UUID string"
        string(36) user_id FK "Nullable for legacy; indexed; ON DELETE CASCADE"
        string(255) title "Session title"
        boolean pinned "Max 7 pinned per user"
        timestamp created_at "UTC timezone-aware"
        timestamp updated_at "UTC timezone-aware, indexed"
    }

    messages {
        string(36) id PK "UUID string"
        string(36) conversation_id FK "indexed; ON DELETE CASCADE"
        string(20) role "'user' | 'assistant'"
        text content "Message body"
        string(50) provider "'mistral' | 'gemini' | null"
        timestamp created_at "UTC timezone-aware"
    }
```

### Models Detail

#### 1. `User` Model (`users` table)
- **`id`**: `String(36)`, Primary Key, UUIDv4.
- **`email`**: `String(255)`, Unique, Indexed, Not Nullable. Stored lowercase.
- **`hashed_password`**: `String(255)`, Not Nullable. Bcrypt salted hash string (starts with `$2b$`).
- **`full_name`**: `String(100)`, Not Nullable. User's full or display name.
- **`created_at` / `updated_at`**: `DateTime(timezone=True)`, server default `func.now()`.
- **Relationships**: `conversations` (1:N) with `cascade="all, delete-orphan"`. Deleting a user automatically removes all their conversations and messages.

#### 2. `Conversation` Model (`conversations` table)
- **`id`**: `String(36)`, Primary Key, UUIDv4.
- **`user_id`**: `String(36)`, Foreign Key referencing `users.id` with `ondelete="CASCADE"`. **Nullable** (`nullable=True`) to preserve legacy records.
- **`title`**: `String(255)`, Not Nullable, defaults to `"New Conversation"`.
- **`pinned`**: `Boolean`, Not Nullable, defaults to `False`. Max 7 pinned per user enforced in application logic.
- **`created_at` / `updated_at`**: `DateTime(timezone=True)`.
- **Indexes**: `ix_conversations_user_id`, `ix_conversations_updated_at`, `ix_conversations_pinned_updated_at`.

#### 3. `Message` Model (`messages` table)
- **`id`**: `String(36)`, Primary Key, UUIDv4.
- **`conversation_id`**: `String(36)`, Foreign Key referencing `conversations.id` with `ondelete="CASCADE"`.
- **`role`**: `String(20)`, `'user'` or `'assistant'`.
- **`content`**: `Text`, Not Nullable.
- **`provider`**: `String(50)`, records `'mistral'` or `'gemini'` for attribution.
- **`created_at`**: `DateTime(timezone=True)`.

### Legacy Data Handling

Pre-Phase-3 records in the `conversations` table have `user_id = NULL`. 
- **Non-destructive migration**: The database migration (`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id VARCHAR(36)`) purposefully preserved existing rows without assigning artificial dummy users.
- **Isolation guarantee**: All API queries in `conversations.py` and `chat.py` explicitly condition on `Conversation.user_id == current_user.id`. Consequently, `user_id IS NULL` rows are excluded from user queries, preventing unauthenticated legacy leakage while retaining data integrity.

---

## 6. API Reference

### Authentication Endpoints

#### 1. Register Account
- **Endpoint**: `POST /api/auth/register`
- **Authentication**: None (Public)
- **Status Codes**: `201 Created`, `409 Conflict`, `422 Unprocessable Entity`
- **Request Body**:
```json
{
  "email": "alex.mercer@example.com",
  "password": "SecurePassword123!",
  "full_name": "Alex Mercer"
}
```
- **Response Body (`201 Created`)**:
```json
{
  "id": "e4b2d5a1-7c98-4b21-89d2-9b2e7c10f3a4",
  "email": "alex.mercer@example.com",
  "full_name": "Alex Mercer",
  "created_at": "2026-10-25T15:30:00Z",
  "updated_at": "2026-10-25T15:30:00Z"
}
```
*(Notice: Password hashes are strictly excluded from the schema).*

---

#### 2. User Login
- **Endpoint**: `POST /api/auth/login`
- **Authentication**: None (Public)
- **Status Codes**: `200 OK`, `401 Unauthorized`, `422 Unprocessable Entity`
- **Request Body**:
```json
{
  "email": "alex.mercer@example.com",
  "password": "SecurePassword123!"
}
```
- **Response Body (`200 OK`)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```
- **Error Response (`401 Unauthorized`)**:
```json
{
  "detail": "Incorrect email or password."
}
```

---

#### 3. Current User Profile
- **Endpoint**: `GET /api/auth/me`
- **Authentication**: Bearer Token Required (`Authorization: Bearer <token>`)
- **Status Codes**: `200 OK`, `401 Unauthorized`
- **Request Body**: None
- **Response Body (`200 OK`)**:
```json
{
  "id": "e4b2d5a1-7c98-4b21-89d2-9b2e7c10f3a4",
  "email": "alex.mercer@example.com",
  "full_name": "Alex Mercer",
  "created_at": "2026-10-25T15:30:00Z",
  "updated_at": "2026-10-25T15:30:00Z"
}
```

---

### Protected Chat & Conversation Endpoints

All endpoints below require `Authorization: Bearer <token>`. Unauthenticated requests return `401 Unauthorized`.

| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/chat` | Send prompt turn, trigger LLM fallback, store history | `200`, `400`, `401`, `404` |
| `GET` | `/api/conversations` | List authenticated user's conversations (pinned first) | `200`, `401` |
| `POST` | `/api/conversations` | Create empty conversation assigned to active user | `201`, `401` |
| `GET` | `/api/conversations/{id}`| Fetch specific conversation with full message history | `200`, `401`, `404` |
| `PATCH`| `/api/conversations/{id}`| Update conversation title | `200`, `400`, `401`, `404` |
| `PATCH`| `/api/conversations/{id}/pin`| Toggle pin status (maximum 7 pinned per user) | `200`, `400`, `401`, `404` |
| `DELETE`| `/api/conversations/{id}`| Permanently delete conversation and its messages | `200`, `401`, `404` |

#### Endpoint Details

- **`POST /api/chat`**:
  - Request: `{"conversation_id": "...", "messages": [{"role": "user", "content": "Hello"}]}`
  - Response: `{"conversation_id": "...", "role": "assistant", "content": "Hi!", "provider": "mistral"}`
  - Note: Omitting `conversation_id` automatically provisions a conversation owned by the authenticated user. Providing a `conversation_id` owned by another user yields `404 Not Found`.

- **`PATCH /api/conversations/{id}/pin`**:
  - Response: `{"id": "...", "title": "...", "pinned": true, ...}`
  - Note: If user already has 7 pinned conversations and attempts to pin an 8th, returns `400 Bad Request` with detail: `"You can pin up to 7 conversations. Please unpin one first."`

- **`DELETE /api/conversations/{id}`**:
  - Response: `{"id": "...", "message": "Conversation deleted successfully"}`

---

## 7. Security Measures & Best Practices

1. **Password Salting and Hashing**:
   - Implemented via `bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())`.
   - Protects against rainbow tables and collision attacks. Passwords cannot be decrypted or retrieved in plaintext.
2. **Cryptographic JWT Tokens**:
   - Tokens signed with HMAC-SHA256 (`HS256`) using a 256-bit or greater secret key.
   - Strict expiration enforcement via the `'exp'` claim (30 minutes default).
   - Validated on every protected request via PyJWT with `options={"require": ["exp"]}`.
3. **Generic Authentication Failures**:
   - In `POST /api/auth/login`, both non-existent emails and wrong passwords return the identical message: `"Incorrect email or password."`
   - Prevents timing and user enumeration attacks.
4. **Data Isolation via Foreign Keys & Scoped Queries**:
   - Conversations are tied directly to `users.id` via a foreign key constraint.
   - Every lookup query explicitly filters `Conversation.user_id == current_user.id`.
5. **Anti-Probing via HTTP 404 (Not 403)**:
   - When User B requests a conversation belonging to User A, the system returns `404 Not Found` rather than `403 Forbidden`.
   - This ensures attackers cannot determine whether a specific conversation ID exists in the system.
6. **Safe User Schemas**:
   - `UserOut` Pydantic model is used for all public user serialization.
   - `hashed_password` is never included in the schema, guaranteeing that hashes cannot leak via API responses.
7. **Frontend Route Guards vs. Backend Authority**:
   - Next.js client-side route guards redirect unauthenticated users to `/login` to ensure clean UX.
   - The backend never trusts the client: all security policies and data boundaries are independently enforced by FastAPI dependencies and database constraints.
8. **Token Storage Architecture**:
   - **Current Implementation**: Tokens are stored in browser `localStorage` under `genai_chat_access_token`.
   - **Trade-off Analysis**: `localStorage` offers simplicity and seamless persistence across page reloads in client-side Next.js applications, but is vulnerable to token theft if a Cross-Site Scripting (XSS) vulnerability exists.
   - **Recommendation**: For production environments requiring PCI/HIPAA compliance, migrate to `HttpOnly`, `Secure`, `SameSite=Lax` cookies.

---

## 8. Environment Configuration

### Required Variables

Create and configure a `.env` file in the `backend/` directory based on `backend/.env.example`.

```ini
# =============================================================================
# AI Providers Configuration
# =============================================================================
MISTRAL_API_KEY=your_mistral_api_key_here
MISTRAL_MODEL=open-mistral-7b

GOOGLE_API_KEY=your_google_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite

# =============================================================================
# Database Configuration (Neon PostgreSQL)
# =============================================================================
DATABASE_URL=postgresql://user:password@ep-example-endpoint.neon.tech/neondb?sslmode=require

# =============================================================================
# JWT Authentication & Cryptography
# =============================================================================
JWT_SECRET_KEY=generate_a_secure_random_hex_string_32_bytes_or_more
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Frontend Configuration (`frontend/.env.local` optional)

```ini
# Base URL of the FastAPI Backend
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

> [!CAUTION]
> Never commit `.env` or `.env.local` to source control. Ensure they are listed in `.gitignore`. Use strong, randomly generated keys for `JWT_SECRET_KEY` in production (e.g., generated with `openssl rand -hex 32`).

---

## 9. Testing & Verification

Phase 3 is backed by a comprehensive end-to-end integration and security test suite located at:
`backend/tests/test_phase3_auth_and_ownership.py`

### Running the Test Suite

From the `backend/` directory with your virtual environment activated:

```powershell
python -m pytest tests/test_phase3_auth_and_ownership.py -v
```

### Verified Test Results

The test suite executes 11 comprehensive automated tests against the live database and AI service fallback:

| Test Case | Scope | Verified Result |
| :--- | :--- | :---: |
| `test_registration_validation` | Validates email formatting, min password length (8), whitespace rejections | **PASSED** |
| `test_valid_registration_and_password_hashing` | Verifies account creation, `UserOut` schema, and bcrypt hash prefix `$2b$` | **PASSED** |
| `test_duplicate_registration_rejected` | Confirms duplicate email registration returns HTTP 409 Conflict | **PASSED** |
| `test_login_success_and_failures` | Tests invalid passwords, non-existent users (401), and valid JWT issuance | **PASSED** |
| `test_current_user_token_validation` | Tests valid tokens, missing tokens, malformed strings, and expired tokens | **PASSED** |
| `test_user_a_creates_and_retrieves_own_conversation` | Verifies foreign key assignment (`user_id`) on conversation creation | **PASSED** |
| `test_user_b_cannot_access_or_mutate_user_a_conversation` | Enforces 404 on cross-tenant GET, PATCH, PIN, DELETE, and chat appends | **PASSED** |
| `test_conversation_listing_isolation` | Confirms User A and User B lists contain only their respective sessions | **PASSED** |
| `test_legacy_conversations_not_exposed` | Validates that legacy `user_id = NULL` records are never returned to users | **PASSED** |
| `test_pinned_conversations_limit_per_user` | Confirms the 7-pin limit is enforced per user without blocking other users | **PASSED** |
| `test_chat_message_flow_and_ownership` | Verifies end-to-end chat turn, AI fallback, history persistence & cascade delete | **PASSED** |

**Execution Summary**: `11 passed in 217.43s` (including live LLM API calls and Neon DB transactions).

### Frontend Verification

Next.js TypeScript and production bundle validation:

```powershell
cd frontend
npm run build
```

**Build Status**: **PASSED** with 0 errors (`Route (app): /`, `/login`, `/register`).

---

## 10. Project Structure

Below is an overview of the key Phase 3 files:

```
GenAI-Chatbot/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py               # Authentication dependency (get_current_user)
│   │   │   └── security.py           # Bcrypt hashing & PyJWT token utilities
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   │   ├── 001_create_users_and_add_user_id.sql # Idempotent DDL migration
│   │   │   │   └── run_migrations.py # Python migration executor
│   │   │   ├── __init__.py
│   │   │   ├── models.py             # User, Conversation, Message SQLAlchemy models
│   │   │   └── session.py            # Database engine and connection session
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py               # /api/auth routes (register, login, me)
│   │   │   ├── chat.py               # Protected /api/chat route
│   │   │   └── conversations.py      # Protected /api/conversations CRUD routes
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py               # Pydantic schemas (UserRegister, UserLogin, UserOut)
│   │   │   ├── chat.py               # Chat request/response schemas
│   │   │   └── conversation.py       # Conversation request/response schemas
│   │   ├── services/
│   │   │   └── llm_service.py        # LangChain Mistral & Gemini fallback engine
│   │   └── config.py                 # Pydantic Settings with JWT configurations
│   ├── tests/
│   │   └── test_phase3_auth_and_ownership.py # Complete 11-test security suite
│   ├── .env.example                  # Environment template with placeholders
│   ├── main.py                       # FastAPI application & router registration
│   └── requirements.txt              # Backend dependencies (FastAPI, PyJWT, bcrypt, etc.)
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/
│   │   │   │   └── page.tsx          # Cyber-neon Login page
│   │   │   ├── register/
│   │   │   │   └── page.tsx          # Cyber-neon Register page
│   │   │   ├── layout.tsx            # Root layout wrapping AuthProvider & Toaster
│   │   │   └── page.tsx              # Protected Dashboard route
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── chat-header.tsx   # Header bar
│   │   │   │   └── chat-sidebar.tsx  # Sidebar with user profile badge & sign-out trigger
│   │   │   └── ui/
│   │   │       └── logout-dialog.tsx # Cyberpunk confirmation modal for sign-out
│   │   ├── contexts/
│   │   │   └── auth-context.tsx      # AuthContext & AuthProvider implementation
│   │   ├── hooks/
│   │   │   ├── use-auth.ts           # useAuth hook
│   │   │   └── use-chat.ts           # useChat hook with auth integration
│   │   ├── lib/
│   │   │   └── api.ts                # Axios instance, token interceptor & auth APIs
│   │   └── types/
│   │       └── auth.ts               # User, Token, and Auth TypeScript definitions
│   └── package.json
│
└── docs/
    ├── PHASE_1_BACKEND.md            # Phase 1 documentation
    ├── PHASE_2.md                    # Phase 2 documentation
    └── PHASE-3-README.md             # This Phase 3 documentation
```

---

## 11. Known Limitations & Future Hardening

1. **Client-Side Token Storage**:
   - *Current State*: Access tokens are stored in `localStorage` under `genai_chat_access_token`.
   - *Limitation*: While standard for simple SPAs, `localStorage` is accessible to client scripts and vulnerable to token exfiltration if an XSS attack occurs.
   - *Future Hardening*: Switch to secure, `HttpOnly` session cookies set via backend `Set-Cookie` response headers.
2. **Token Refresh Rotation**:
   - *Current State*: Tokens expire after a fixed duration (30 minutes default). There is no refresh token mechanism; users must re-authenticate when the token expires.
   - *Future Hardening*: Implement a dual-token strategy (`access_token` with short lifetime + rotating `refresh_token` stored securely in the database).
3. **Legacy Orphaned Records**:
   - *Current State*: Conversations created in Phase 1 & 2 have `user_id = NULL`. They are completely hidden from authenticated users to maintain security.
   - *Future Hardening*: Provide an administrative CLI command or migration script to assign orphaned legacy sessions to a designated administrator or primary account.

---

## 12. Summary

Phase 3 establishes an enterprise-ready security foundation for the **GenAI-Chatbot** application:
- **Zero Cross-Tenant Leakage**: Complete isolation between users with 404 anti-probing defenses.
- **Robust Authentication**: Cryptographically salted passwords and signed JWT access tokens.
- **Unified User Experience**: Cohesive cyber-neon user interface across login, registration, active sessions, and sign-out.
- **Verified Resilience**: All 11 automated security tests pass consistently against Neon PostgreSQL and live AI fallback providers.
