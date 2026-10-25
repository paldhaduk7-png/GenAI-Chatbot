"use client";

import { useState } from "react";
import axios from "axios";
import { Message, ApiChatMessage } from "@/types/chat";
import { sendChatMessage } from "@/lib/api";

/**
 * Custom React Hook: useChat
 * 
 * Encapsulates all chat-related business logic, state management, and API calls:
 * - Message history management (user and assistant messages).
 * - Controlled input state.
 * - Loading indicator state during active backend requests.
 * - Human-friendly error handling with error extraction and retry support.
 * - Mobile sidebar visibility state.
 */
export function useChat() {
  // Active conversation history
  const [messages, setMessages] = useState<Message[]>([]);

  // Current typed input
  const [input, setInput] = useState("");

  // Loading flag for in-flight backend requests
  const [isLoading, setIsLoading] = useState(false);

  // User-facing error message (sanitized, no internal stack traces or secrets)
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mobile sidebar drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  /**
   * Resets the active chat session:
   * Clears messages, input text, error notices, and closes the mobile sidebar.
   */
  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setErrorMessage(null);
    setIsSidebarOpen(false);
  };

  /**
   * Dismisses any active error notification banner.
   */
  const dismissError = () => {
    setErrorMessage(null);
  };

  /**
   * Centralized API Request Executor:
   * Formats the conversation history into the FastAPI schema, dispatches the request,
   * appends the AI reply (with provider tracking), and handles any network or server errors.
   * 
   * @param conversation Full conversation array to send as context.
   */
  const executeChatRequest = async (conversation: Message[]) => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      // Map to backend schema: { role: "user" | "assistant", content: string }
      const apiPayload: ApiChatMessage[] = conversation.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Call the API service via Axios
      const response = await sendChatMessage(apiPayload);

      // Add assistant response with provider badge metadata
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.content,
        provider: response.provider,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      console.error("Chat API request error:", err);

      let userFriendlyError =
        "Failed to communicate with the AI backend. Please verify the server is running.";

      if (axios.isAxiosError(err)) {
        if (!err.response) {
          // Backend server unreachable or offline
          userFriendlyError =
            "Cannot connect to the backend server. Please verify that FastAPI is running on http://127.0.0.1:8000.";
        } else if (err.code === "ECONNABORTED") {
          // Request timed out
          userFriendlyError =
            "The request timed out while waiting for the AI response. Please try again.";
        } else {
          // HTTP error response from FastAPI
          const status = err.response.status;
          const detail = err.response.data?.detail;

          if (status === 503) {
            userFriendlyError =
              typeof detail === "string"
                ? detail
                : "Both primary (Mistral) and fallback (Gemini) AI providers are currently unavailable. Please try again later.";
          } else if (status === 500) {
            userFriendlyError =
              typeof detail === "string" && !detail.includes("Traceback")
                ? detail
                : "An internal server error occurred while processing your request. Please check backend logs.";
          } else if (status === 422 || status === 400) {
            userFriendlyError =
              typeof detail === "string"
                ? detail
                : "The request could not be processed due to invalid message format.";
          } else {
            userFriendlyError =
              typeof detail === "string"
                ? detail
                : `Backend returned an error (HTTP ${status}). Please try again.`;
          }
        }
      } else if (err instanceof Error) {
        userFriendlyError = err.message;
      }

      setErrorMessage(userFriendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Message Submission Handler:
   * Validates user input, adds user message to state, and initiates the API call.
   */
  const sendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedText = input.trim();
    if (!trimmedText || isLoading) return;

    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedText,
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setInput("");

    executeChatRequest(updatedMessages);
  };

  /**
   * Retry Handler:
   * Re-sends the active conversation history after a failed request.
   */
  const handleRetry = () => {
    if (messages.length === 0 || isLoading) return;
    executeChatRequest(messages);
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    errorMessage,
    isSidebarOpen,
    setIsSidebarOpen,
    sendMessage,
    handleRetry,
    handleNewChat,
    dismissError,
  };
}
