/**
 * Core TypeScript definitions for the GenAI-Chatbot application.
 * Centralizing types here prevents duplication across components, hooks, and API services.
 */

/**
 * Represents a single message in the UI state.
 * - `id`: Unique identifier for list keys.
 * - `role`: "user" or "assistant" (must match backend expectation).
 * - `content`: Text message content.
 * - `provider`: Tracks whether Mistral (primary) or Gemini (fallback) answered.
 */
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: "mistral" | "gemini";
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
}

/**
 * Response schema returned by the FastAPI backend at POST /api/chat.
 */
export interface ChatApiResponse {
  conversation_id?: string;
  role: "assistant";
  content: string;
  provider: "mistral" | "gemini";
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
