# Phase 2: Conversation Management Documentation

## 1. Phase 2 Overview

Phase 2 transitions the **GenAI-Chatbot** application from a purely ephemeral, stateless chat application into a fully persistent, multi-turn conversational AI platform backed by **Neon Serverless PostgreSQL**.

In Phase 1, chat messages were maintained solely in browser React state—refreshing the page or closing the tab discarded the entire session, and the backend relied on the frontend to transmit the full history in every request. 

In Phase 2, the application gains **server-side persistence**, **session lifecycle management**, and **database-driven context restoration**:
- Every conversation session and message is persistently stored in PostgreSQL.
- Users can view, reopen, rename, pin, and delete past conversations from an interactive sidebar.
- Multi-turn conversation context is restored directly from PostgreSQL when generating AI responses.
- The dual-provider architecture (**Mistral AI** primary with automatic failover to **Google Gemini**) is fully preserved, with provider attribution tracked per message.

---

## 2. Objectives and Implemented Features

### Primary Objectives
1. **Database Foundation**: Establish a production-grade relational database schema for chat sessions and message histories with serverless connection pooling.
2. **Session Lifecycle Management**: Expose dedicated REST API endpoints to list, retrieve, rename, pin/unpin, and delete conversations with cascading message cleanup.
3. **Contextual Chat Integration**: Update `POST /api/chat` to bind messages to persistent conversation sessions, automatically restore historical turns from PostgreSQL, and commit messages within safe database transactions.
4. **Frontend Conversation Navigation**: Replace static placeholders with a dynamic sidebar supporting active conversation highlighting, pinned item sorting, inline title editing, and deletion confirmation.

### Implemented Feature Summary

| Component | Implemented Capability |
| :--- | :--- |
| **Database** | Normalized connection strings (`postgres://` -> `postgresql://`), pre-ping connection recycling for Neon compute sleep, UUID primary keys, and cascade deletion. |
| **Backend REST API** | Endpoints for session listing, detail retrieval, title renaming with validation, pin toggling, and deletion. |
| **Chat Persistence** | `POST /api/chat` accepts optional `conversation_id`, auto-creates sessions on first turn, restores DB context for LLM generation, and commits user + assistant messages atomically. |
| **Transaction Safety** | LLM failures automatically trigger `db.rollback()`, ensuring incomplete user messages or partial turns are never committed to the database. |
| **Duplicate Prevention** | Avoids re-inserting historical messages if client sends full turn history with an existing conversation ID. |
| **Frontend Sidebar** | Dynamic conversation list, pinned-first sorting, active selection state, inline renaming form (`Enter` to save, `Escape` to cancel), and delete confirmation dialogs. |
| **Race-Condition Guard** | Request-token tracking in `useChat` prevents delayed LLM responses from overwriting a newly selected conversation. |

---

## 3. Technologies Used

### Backend Stack
- **FastAPI**: Asynchronous web framework for high-performance REST APIs.
- **SQLAlchemy 2.x**: Declarative ORM managing session lifecycles, queries, and schema abstractions.
- **psycopg2-binary**: PostgreSQL adapter optimized for C-level speed and connection stability.
- **Neon Serverless PostgreSQL**: Cloud relational database with autoscaling and branchable compute.
- **Pydantic v2**: Strict schema validation for incoming JSON payloads and serialization.
- **LangChain (`langchain-core`, `langchain-mistralai`, `langchain-google-genai`)**: LLM orchestration with Mistral AI primary and Gemini fallback.

### Frontend Stack
- **Next.js 16 (App Router) & React 19**: Modern React framework with server/client boundaries.
- **TypeScript 5**: Strict end-to-end typing across components, hooks, and API payloads.
- **Tailwind CSS v4 & shadcn/ui**: Modern utility-first styling with responsive design and dark mode.
- **Axios**: HTTP client configured with a 45-second timeout and centralized base URL resolution.
- **Lucide React**: Modern icon set for pinned badges, action buttons, and status indicators.

---

## 4. Database Architecture

The database architecture employs two tables connected by a one-to-many relationship defined in `backend/app/db/models.py`.

### 4.1 `conversations` Table
Stores high-level metadata for each chat session.

| Column | Type | Constraints / Modifiers | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | Primary Key, Indexed | 36-character UUID string generated via `uuid.uuid4()`. |
| `title` | `VARCHAR(255)` | `NOT NULL`, Default `"New Conversation"` | Descriptive conversation title (derived from first prompt or user-edited). |
| `pinned` | `BOOLEAN` | `NOT NULL`, Default `False` | Pin flag to display priority conversations at the top of the sidebar. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL`, `server_default=func.now()` | Session creation timestamp in UTC. |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL`, `server_default=func.now()` | Last modification timestamp in UTC, auto-updated on edits and new messages. |

**Indexes**:
- `ix_conversations_id`: Primary key index.
- `ix_conversations_updated_at`: Fast ordering for recent conversation retrieval.
- `ix_conversations_pinned_updated_at`: Composite index for pinned-first ordering.

### 4.2 `messages` Table
Stores each individual turn (user prompt or AI assistant response) within a session.

| Column | Type | Constraints / Modifiers | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | Primary Key, Indexed | 36-character UUID string generated via `uuid.uuid4()`. |
| `conversation_id` | `VARCHAR(36)` | Foreign Key, `NOT NULL`, Indexed | References `conversations.id` with `ON DELETE CASCADE`. |
| `role` | `VARCHAR(20)` | `NOT NULL` | Role identifier: `"user"` or `"assistant"`. |
| `content` | `TEXT` | `NOT NULL` | Plaintext content of the message turn. |
| `provider` | `VARCHAR(50)` | Nullable | Provider that generated the response: `"mistral"`, `"gemini"`, or `NULL` for user messages. |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL`, `server_default=func.now()` | Creation timestamp in UTC. |

**Indexes**:
- `ix_messages_id`: Primary key index.
- `ix_messages_conversation_id`: Fast filtering of messages by parent session.
- `ix_messages_conversation_created_at`: Composite index for chronological message ordering.

### 4.3 Relationship & Cascading Deletion
- **Relationship**: Defined in SQLAlchemy using `relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at.asc()")`.
- **Database-Level Integrity**: The foreign key includes `ondelete="CASCADE"`. When a conversation is deleted, PostgreSQL automatically removes all associated messages in a single atomic transaction without leaving orphaned records.

---

## 5. Backend API Endpoints

All endpoints are mounted on the FastAPI application in `backend/main.py`.

### 5.1 `GET /health`
Verifies backend service availability.
- **Method**: `GET`
- **URL**: `/health`
- **Response `200 OK`**:
```json
{
  "status": "ok",
  "message": "GenAI Chatbot backend is running"
}
```

### 5.2 `POST /api/chat`
Handles AI chat turns with PostgreSQL persistence and provider fallback.
- **Method**: `POST`
- **URL**: `/api/chat`
- **Request Body**:
```json
{
  "conversation_id": "b183d78d-6a00-4522-a176-7c7de0798ee4",
  "messages": [
    { "role": "user", "content": "What is the capital of France?" }
  ]
}
```
*(Note: `conversation_id` is optional. If omitted, a new conversation is automatically created).*
- **Response `200 OK`**:
```json
{
  "conversation_id": "b183d78d-6a00-4522-a176-7c7de0798ee4",
  "role": "assistant",
  "content": "The capital of France is Paris.",
  "provider": "mistral"
}
```
- **Error Responses**:
  - `400 Bad Request`: If no valid user message is found in the payload.
  - `404 Not Found`: If `conversation_id` does not exist in PostgreSQL.
  - `503 Service Unavailable`: If both Mistral and Gemini providers are unavailable.

### 5.3 `GET /api/conversations`
Retrieves all conversation sessions for the sidebar list.
- **Method**: `GET`
- **URL**: `/api/conversations`
- **Response `200 OK`**:
```json
[
  {
    "id": "b183d78d-6a00-4522-a176-7c7de0798ee4",
    "title": "What is the capital of France?",
    "pinned": false,
    "created_at": "2026-10-25T11:58:33.123456Z",
    "updated_at": "2026-10-25T11:58:35.789012Z"
  }
]
```

### 5.4 `POST /api/conversations`
Creates an empty conversation session explicitly.
- **Method**: `POST`
- **URL**: `/api/conversations`
- **Request Body (Optional)**:
```json
{
  "title": "Project Architecture"
}
```
- **Response `201 Created`**:
```json
{
  "id": "d98124fa-4b82-4fa1-83cb-98612fe34a01",
  "title": "Project Architecture",
  "pinned": false,
  "created_at": "2026-10-25T12:00:00.000000Z",
  "updated_at": "2026-10-25T12:00:00.000000Z"
}
```

### 5.5 `GET /api/conversations/{conversation_id}`
Retrieves conversation metadata along with its full chronological message history.
- **Method**: `GET`
- **URL**: `/api/conversations/{conversation_id}`
- **Response `200 OK`**:
```json
{
  "id": "b183d78d-6a00-4522-a176-7c7de0798ee4",
  "title": "What is the capital of France?",
  "pinned": false,
  "created_at": "2026-10-25T11:58:33.123456Z",
  "updated_at": "2026-10-25T11:58:35.789012Z",
  "messages": [
    {
      "id": "f8a123bc-1111-2222-3333-444455556666",
      "conversation_id": "b183d78d-6a00-4522-a176-7c7de0798ee4",
      "role": "user",
      "content": "What is the capital of France?",
      "provider": null,
      "created_at": "2026-10-25T11:58:33.200000Z"
    },
    {
      "id": "c9b456de-2222-3333-4444-555566667777",
      "conversation_id": "b183d78d-6a00-4522-a176-7c7de0798ee4",
      "role": "assistant",
      "content": "The capital of France is Paris.",
      "provider": "mistral",
      "created_at": "2026-10-25T11:58:35.700000Z"
    }
  ]
}
```
- **Error `404 Not Found`**: Returned if the ID does not match any stored session.

### 5.6 `PATCH /api/conversations/{conversation_id}`
Updates a conversation's title.
- **Method**: `PATCH`
- **URL**: `/api/conversations/{conversation_id}`
- **Request Body**:
```json
{
  "title": "European Geography"
}
```
- **Response `200 OK`**: Returns updated `ConversationResponse`.
- **Error Responses**:
  - `422 Unprocessable Entity`: If `title` is blank or empty.
  - `404 Not Found`: If conversation does not exist.

### 5.7 `PATCH /api/conversations/{conversation_id}/pin`
Toggles the pinned status of a conversation (`false` -> `true` -> `false`).
- **Method**: `PATCH`
- **URL**: `/api/conversations/{conversation_id}/pin`
- **Request Body**: None
- **Response `200 OK`**: Returns updated `ConversationResponse` with modified `pinned` boolean.

### 5.8 `DELETE /api/conversations/{conversation_id}`
Deletes the conversation and cascade-deletes all associated messages.
- **Method**: `DELETE`
- **URL**: `/api/conversations/{conversation_id}`
- **Response `200 OK`**:
```json
{
  "id": "b183d78d-6a00-4522-a176-7c7de0798ee4",
  "message": "Conversation deleted successfully"
}
```

---

## 6. Frontend Integration

The frontend architecture is modular, using custom React hooks and dedicated components.

### 6.1 `useChat` Custom Hook (`frontend/src/hooks/use-chat.ts`)
Encapsulates all client-side business logic and state:
- **`currentConversationId`**: Holds the UUID of the active conversation, or `null` for a new unsaved chat.
- **`conversations`**: Array of `Conversation` objects for the sidebar.
- **`selectConversation(id)`**: Fetches details via `fetchConversation(id)` and populates the message viewport. Uses a request token counter (`requestIdRef`) to disregard stale responses if the user clicks between chats quickly.
- **`deleteConversation(id)`**: Performs an optimistic UI update, calls the API, and resets the chat to blank if the active chat was deleted.
- **`togglePin(id)`**: Optimistically toggles the pin state and reloads the sorted order.
- **`renameConversation(id, newTitle)`**: Dispatches the title update to the backend.
- **`handleNewChat()`**: Clears the active chat and resets `currentConversationId` to `null` without deleting saved sessions.

### 6.2 Axios API Client (`frontend/src/lib/api.ts`)
- Configured with `NEXT_PUBLIC_API_URL` (defaults to `http://127.0.0.1:8000`).
- Provides type-safe functions: `sendChatMessage()`, `fetchConversations()`, `fetchConversation()`, `updateConversationTitle()`, `toggleConversationPin()`, and `deleteConversation()`.

### 6.3 Conversation Sidebar (`frontend/src/components/layout/chat-sidebar.tsx`)
- Displays conversation count badge.
- Pinned sessions appear at the top marked with an amber pin icon.
- Hover actions include **Pin/Unpin**, **Inline Rename** (with auto-focus input, `Enter` save, `Escape` cancel), and **Delete** (with `window.confirm` protection).
- Full responsiveness: slides in on mobile devices with a backdrop click-to-dismiss overlay.

### 6.4 Layout Integration (`frontend/src/components/chat/chat-container.tsx`)
- Integrates `ChatSidebar`, `ChatHeader`, `ChatMessages`, and `ChatInput`.
- Passes the active conversation title to `ChatHeader` so the header displays the session name dynamically.

---

## 7. Chat Persistence and Context Restoration

### Why Messages Persist After Page Refresh
1. **No Client-Only Storage**: Messages are never stored in temporary browser memory like `localStorage` or `sessionStorage`.
2. **PostgreSQL Single Source of Truth**:
   - When the user sends a message, FastAPI saves the user prompt and assistant response to Neon PostgreSQL.
   - When the page is reloaded, `useEffect` in `useChat` immediately invokes `fetchConversations()`, fetching all saved sessions.
   - When the user selects a conversation, `selectConversation(id)` invokes `fetchConversation(id)`, retrieving all historical messages from PostgreSQL in chronological order.

### How Context Restoration Works in Multi-Turn Conversations
When a user sends a follow-up message:
1. The frontend transmits `{ conversation_id: "...", messages: [...] }`.
2. The backend looks up the conversation in PostgreSQL and queries all previously saved messages:
   ```python
   existing_db_messages = db.scalars(
       select(DbMessage)
       .where(DbMessage.conversation_id == conversation.id)
       .order_by(DbMessage.created_at.asc())
   ).all()
   ```
3. The backend reconstructs the LangChain context (`HumanMessage` and `AIMessage` objects) from the database history, and appends the new user message.
4. The LLM receives the complete prior conversation context, allowing it to remember previously stated facts, instructions, or codes.
5. The assistant reply is written to PostgreSQL, keeping the thread intact for future turns.

---

## 8. Complete Application Workflow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Next.js UI (ChatContainer)
    participant Hook as useChat Hook
    participant API as Axios Client (lib/api.ts)
    participant Backend as FastAPI (/api/chat)
    participant DB as Neon PostgreSQL
    participant LLM as LangChain (Mistral / Gemini)

    User->>UI: Types message & clicks Send
    UI->>Hook: sendMessage(input)
    Hook->>Hook: Optimistically append user message to UI state
    Hook->>API: sendChatMessage(messages, conversationId)
    API->>Backend: POST /api/chat { conversation_id, messages }
    
    alt conversation_id is absent
        Backend->>DB: Create new Conversation & flush ID
    else conversation_id is present
        Backend->>DB: Verify Conversation exists (404 if missing)
    end
    
    Backend->>DB: Fetch historical messages for conversation
    DB-->>Backend: Return existing messages
    Backend->>Backend: Reconstruct LLM context (history + latest user message)
    
    alt Primary Provider: Mistral AI
        Backend->>LLM: ChatMistralAI.invoke(context)
        LLM-->>Backend: Success response + provider="mistral"
    else Fallback: Google Gemini (on quota/rate limit/outage)
        Backend->>LLM: ChatGoogleGenerativeAI.invoke(context)
        LLM-->>Backend: Success response + provider="gemini"
    end
    
    Backend->>DB: Insert latest User Message
    Backend->>DB: Insert Assistant Reply with provider metadata
    Backend->>DB: Update Conversation updated_at timestamp & COMMIT
    Backend-->>API: 200 OK { conversation_id, role: "assistant", content, provider }
    API-->>Hook: Return ChatApiResponse
    Hook->>Hook: Append assistant message & bind conversation_id
    Hook->>API: fetchConversations() (refresh sidebar list)
    API->>Backend: GET /api/conversations
    Backend->>DB: SELECT * FROM conversations ORDER BY updated_at DESC
    DB-->>Backend: Return conversation rows
    Backend-->>API-->>Hook: Update conversations state
    Hook-->>UI: Re-render message viewport and updated sidebar
    UI-->>User: Display assistant response with provider badge
```

---

## 9. Database Entity Relationship Diagram

```mermaid
erDiagram
    CONVERSATIONS ||--o{ MESSAGES : "has many"

    CONVERSATIONS {
        VARCHAR_36 id PK "UUID unique identifier"
        VARCHAR_255 title "Descriptive title of session"
        BOOLEAN pinned "Pinned status flag"
        TIMESTAMP created_at "Creation timestamp (UTC)"
        TIMESTAMP updated_at "Last updated timestamp (UTC)"
    }

    MESSAGES {
        VARCHAR_36 id PK "UUID unique identifier"
        VARCHAR_36 conversation_id FK "References conversations(id) ON DELETE CASCADE"
        VARCHAR_20 role "'user' or 'assistant'"
        TEXT content "Message body text"
        VARCHAR_50 provider "'mistral', 'gemini', or NULL"
        TIMESTAMP created_at "Creation timestamp (UTC)"
    }
```

---

## 10. Relevant Project Structure

```
GenAI-Chatbot/
├── docs/
│   ├── PHASE_1_BACKEND.md              # Phase 1 documentation
│   └── PHASE_2.md                      # Phase 2 documentation (this file)
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py                   # Environment variable loader
│   │   ├── db/
│   │   │   ├── __init__.py             # Exports Base, models, engine, get_db
│   │   │   ├── models.py               # Conversation and Message SQLAlchemy models
│   │   │   └── session.py              # Engine setup, URL normalization, sessionmaker
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── chat.py                 # POST /api/chat with DB persistence & LLM fallback
│   │   │   └── conversations.py        # Conversation CRUD & pin endpoints
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── chat.py                 # Pydantic models for chat requests/responses
│   │   │   └── conversation.py         # Pydantic models for conversation CRUD
│   │   └── services/
│   │       ├── __init__.py
│   │       └── llm_service.py          # Mistral -> Gemini fallback orchestrator
│   ├── .env                            # Local backend secrets (git-ignored)
│   ├── main.py                         # FastAPI startup lifespan & router registration
│   └── requirements.txt                # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx              # Root HTML wrapper
│   │   │   ├── page.tsx                # Mounts ChatContainer
│   │   │   └── globals.css             # Tailwind base styles
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── chat-container.tsx  # Layout container combining sidebar, header, and chat
│   │   │   │   ├── chat-input.tsx      # Textarea form
│   │   │   │   ├── chat-message.tsx    # Message bubble with Markdown formatting
│   │   │   │   ├── chat-messages.tsx   # Scrollable message viewport & welcome screen
│   │   │   │   ├── provider-badge.tsx  # Mistral vs Gemini provider indicator
│   │   │   │   └── typing-indicator.tsx# Animated dot loader
│   │   │   └── layout/
│   │   │       ├── chat-header.tsx     # Dynamic conversation title & status indicator
│   │   │       └── chat-sidebar.tsx    # Scrollable sessions list with pin, rename, delete
│   │   ├── hooks/
│   │   │   └── use-chat.ts             # React state hook for chat & conversation CRUD
│   │   ├── lib/
│   │   │   ├── api.ts                  # Axios client for chat & conversation endpoints
│   │   │   └── utils.ts                # Tailwind class merge helper
│   │   └── types/
│   │       └── chat.ts                 # TypeScript interfaces for API & UI state
│   ├── package.json                    # Frontend dependencies & build scripts
│   └── tsconfig.json                   # TypeScript configuration
├── run.bat                             # One-click startup script for backend & frontend
└── README.md                           # Repository overview
```

---

## 11. Environment Variables

Store all sensitive keys in `backend/.env`. Never commit credentials to version control.

### `backend/.env`
```env
# Primary LLM Provider (Mistral AI)
MISTRAL_API_KEY=your_mistral_api_key_here
MISTRAL_MODEL=open-mistral-7b

# Fallback LLM Provider (Google Gemini)
GOOGLE_API_KEY=your_google_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite

# Database Connection (Neon Serverless PostgreSQL)
# Supports both postgres:// and postgresql:// prefixes with sslmode=require
DATABASE_URL=postgresql://neondb_owner:your_password@ep-sample-pool.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### `frontend/.env.local` (Optional)
```env
# Base URL pointing to the FastAPI backend API
# If running locally, defaults automatically to http://127.0.0.1:8000
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

---

## 12. Setup and Run Instructions

### 12.1 Automated Startup (Windows)
Run the bundled batch script from the project root:
```cmd
run.bat
```
This launches two separate terminal windows:
- **Backend**: FastAPI running on `http://127.0.0.1:8000` (API documentation at `http://127.0.0.1:8000/docs`).
- **Frontend**: Next.js running on `http://localhost:3000`.

### 12.2 Manual Backend Setup
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

### 12.3 Manual Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```

---

## 13. Testing and Verification Results

The implementation underwent full automated test suites verifying API responses, Next.js build compilation, and live Neon PostgreSQL persistence.

### 13.1 Frontend TypeScript & Build Compilation
- **Command**: `npm run build`
- **TypeScript Check**: Completed in 4.9s with **0 errors**.
- **Page Optimization**: Compiled 4 static routes (`/`, `/_not-found`) with zero bundle warnings.

### 13.2 Conversation Management API Test Suite

| Test Case | Method & Endpoint | Expected Behavior | Observed Result |
| :--- | :--- | :--- | :---: |
| **List Sessions** | `GET /api/conversations` | Returns list ordered by `updated_at DESC` | `200 OK` (Verified) |
| **Create Session** | `POST /api/conversations` | Creates conversation row in PostgreSQL | `201 Created` (Verified) |
| **Fetch Details** | `GET /api/conversations/{id}` | Retrieves session and chronological messages | `200 OK` (Verified) |
| **Unknown Session** | `GET /api/conversations/invalid-id` | Returns 404 when ID does not exist | `404 Not Found` (Verified) |
| **Rename Session** | `PATCH /api/conversations/{id}` | Updates `title` in PostgreSQL | `200 OK` (Verified) |
| **Empty Title Check**| `PATCH /api/conversations/{id}` | Rejects empty strings with validation error | `422 Unprocessable` (Verified) |
| **Pin / Unpin** | `PATCH /api/conversations/{id}/pin`| Toggles `pinned` flag (`False -> True -> False`) | `200 OK` (Verified) |
| **Delete Session** | `DELETE /api/conversations/{id}` | Removes conversation and cascade-deletes messages | `200 OK` (Verified) |

### 13.3 Chat Persistence & Context Recall Test Suite

| Test Case | Scenario | Expected Behavior | Observed Result |
| :--- | :--- | :--- | :---: |
| **New Chat Session** | `POST /api/chat` (no `conversation_id`) | Auto-creates session, saves user prompt and AI response | `200 OK`, assigned new UUID, persisted 2 messages. |
| **Invalid Session** | `POST /api/chat` (`invalid-uuid`) | Rejects missing session with 404 | `404 Not Found` (Verified) |
| **Context Recall** | `POST /api/chat` (turn 2 with secret code query) | Restores turn 1 from PostgreSQL, LLM recalls secret code | `200 OK`, LLM recalled `"PHOENIX-99"`. |
| **Duplicate Prevention**| `POST /api/chat` (full history sent in payload) | Only inserts newest user turn; avoids re-inserting history | Exactly 6 messages in DB, zero duplicates. |
| **Safe Rollback** | `POST /api/chat` (simulated LLM outage) | Transaction rolls back, leaving no orphan user messages | DB rolled back completely (no partial records). |

---

## 14. Future Improvements / Phase 3 Roadmap

The completion of Phase 2 establishes the database and conversation layer. The following features are planned for subsequent phases:

1. **User Authentication & Authorization**:
   - Introduce Multi-tenant support with JWT or OAuth2 (e.g. NextAuth or Supabase Auth).
   - Add a `user_id` foreign key to `conversations` to isolate user chat histories.
2. **Retrieval-Augmented Generation (RAG)**:
   - Connect ChromaDB or pgvector to index uploaded PDF/text documents.
   - Inject semantically retrieved knowledge chunks into the prompt context prior to calling Mistral or Gemini.
3. **Streaming Responses**:
   - Transition from standard JSON completion to Server-Sent Events (SSE) or WebSockets so responses stream token-by-token in real-time.
4. **Message Regeneration and Forking**:
   - Allow users to edit past messages and re-branch conversations from any arbitrary turn in the thread.
5. **Conversation Export**:
   - Allow users to export chat transcripts in Markdown, PDF, or JSON format.
