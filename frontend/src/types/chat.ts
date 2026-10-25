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
 * Response schema returned by the FastAPI backend at POST /api/chat.
 */
export interface ChatApiResponse {
  role: "assistant";
  content: string;
  provider: "mistral" | "gemini";
}
