import axios from "axios";
import {
  ApiChatMessage,
  ChatApiRequest,
  ChatApiResponse,
  Conversation,
  ConversationDetail,
  ConversationDeleteResponse,
} from "@/types/chat";

// Re-export for convenience
export type {
  ApiChatMessage,
  ChatApiRequest,
  ChatApiResponse,
  Conversation,
  ConversationDetail,
  ConversationDeleteResponse,
};

/**
 * Base URL for the FastAPI backend.
 * Reads NEXT_PUBLIC_API_URL from environment variables if defined,
 * otherwise defaults to the local FastAPI development port (http://127.0.0.1:8000).
 */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/**
 * Pre-configured Axios instance for backend API communication.
 * - `baseURL`: Points to the FastAPI root.
 * - `timeout`: 45 seconds to accommodate LLM response generation and provider fallback.
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 45000,
});

/**
 * Sends messages to the FastAPI backend at POST /api/chat.
 * 
 * @param messages Ordered list of user and assistant messages.
 * @param conversationId Optional existing conversation session UUID.
 * @returns Assistant reply with conversation_id and provider metadata.
 */
export async function sendChatMessage(
  messages: ApiChatMessage[],
  conversationId?: string | null
): Promise<ChatApiResponse> {
  const payload: ChatApiRequest = {
    messages,
    ...(conversationId ? { conversation_id: conversationId } : {}),
  };

  const response = await apiClient.post<ChatApiResponse>("/api/chat", payload);
  return response.data;
}

/**
 * Fetches all saved conversations ordered by updated_at (newest first).
 */
export async function fetchConversations(): Promise<Conversation[]> {
  const response = await apiClient.get<Conversation[]>("/api/conversations");
  return response.data;
}

/**
 * Fetches a single conversation with its full chronological messages.
 */
export async function fetchConversation(
  conversationId: string
): Promise<ConversationDetail> {
  const response = await apiClient.get<ConversationDetail>(
    `/api/conversations/${encodeURIComponent(conversationId)}`
  );
  return response.data;
}

/**
 * Updates the title of an existing conversation.
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<Conversation> {
  const response = await apiClient.patch<Conversation>(
    `/api/conversations/${encodeURIComponent(conversationId)}`,
    { title }
  );
  return response.data;
}

/**
 * Toggles the pinned status of a conversation.
 */
export async function toggleConversationPin(
  conversationId: string
): Promise<Conversation> {
  const response = await apiClient.patch<Conversation>(
    `/api/conversations/${encodeURIComponent(conversationId)}/pin`
  );
  return response.data;
}

/**
 * Deletes a conversation and all its associated messages from PostgreSQL.
 */
export async function deleteConversation(
  conversationId: string
): Promise<ConversationDeleteResponse> {
  const response = await apiClient.delete<ConversationDeleteResponse>(
    `/api/conversations/${encodeURIComponent(conversationId)}`
  );
  return response.data;
}
