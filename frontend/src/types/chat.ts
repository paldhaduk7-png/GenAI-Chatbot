/**
 * Core TypeScript definitions for the GenAI-Chatbot application.
 * Centralizing types here prevents duplication across components, hooks, and API services.
 */

/**
 * Preserved source citation metadata for a retrieved document chunk.
 */
export interface RAGSource {
  document_id: string;
  document_filename: string;
  page_number?: number | null;
  chunk_id: string;
  similarity_score?: number | null;
}

/**
 * Represents a single message in the UI state.
 * - `id`: Unique identifier for list keys.
 * - `role`: "user" or "assistant" (must match backend expectation).
 * - `content`: Text message content.
 * - `provider`: Tracks whether Mistral (primary) or Gemini (fallback) answered.
 * - `sources`: Source chunk citations returned from RAG execution.
 * - `has_sufficient_context`: Flag indicating if relevant chunks were retrieved.
 * - `document_id`: Optional ID of the document queried for this message.
 */
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: "mistral" | "gemini";
  sources?: RAGSource[];
  has_sufficient_context?: boolean | null;
  document_id?: string | null;
}

/**
 * Message schema expected by the FastAPI backend at POST /api/chat.
 */
export interface ApiChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Request payload schema for POST /api/chat.
 */
export interface ChatApiRequest {
  conversation_id?: string | null;
  messages: ApiChatMessage[];
  document_id?: string | null;
  use_rag?: boolean;
}

/**
 * Response schema returned by the FastAPI backend at POST /api/chat.
 */
export interface ChatApiResponse {
  conversation_id?: string;
  role: "assistant";
  content: string;
  provider: "mistral" | "gemini";
  sources?: RAGSource[];
  has_sufficient_context?: boolean | null;
}

/**
 * Represents a saved conversation session summary (e.g. for sidebar list).
 */
export interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Represents an individual persisted message belonging to a conversation.
 */
export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  provider?: "mistral" | "gemini";
  created_at: string;
}

/**
 * Detailed conversation representation including its full chronological messages.
 */
export interface ConversationDetail {
  id: string;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  messages: ConversationMessage[];
}

/**
 * Response schema returned upon conversation deletion.
 */
export interface ConversationDeleteResponse {
  id: string;
  message: string;
}
