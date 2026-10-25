import axios from "axios";
import { ApiChatMessage, ChatApiResponse } from "@/types/chat";

// Re-export for convenience
export type { ApiChatMessage, ChatApiResponse };

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
 * Sends the full conversation history to the FastAPI backend.
 * 
 * @param messages Ordered list of user and assistant messages.
 * @returns The assistant's reply and the provider (Mistral or Gemini) that served the response.
 */
export async function sendChatMessage(
  messages: ApiChatMessage[]
): Promise<ChatApiResponse> {
  const response = await apiClient.post<ChatApiResponse>("/api/chat", {
    messages,
  });
  return response.data;
}
