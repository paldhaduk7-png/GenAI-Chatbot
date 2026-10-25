"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Message, ApiChatMessage, Conversation } from "@/types/chat";
import {
  sendChatMessage,
  fetchConversations,
  fetchConversation,
  updateConversationTitle,
  toggleConversationPin,
  deleteConversation as deleteConversationApi,
} from "@/lib/api";

/**
 * Custom React Hook: useChat
 * 
 * Encapsulates chat business logic, active message state, and PostgreSQL conversation management:
 * - Active session message management and controlled input state.
 * - Current conversation session tracking (`currentConversationId`).
 * - Conversation listing, selection, deletion, pinning, and renaming.
 * - In-flight backend request handling with race-condition prevention.
 * - Human-friendly sanitized error handling with retry support.
 * - Mobile sidebar visibility state.
 */
export function useChat() {
  // Active conversation history
  const [messages, setMessages] = useState<Message[]>([]);

  // Current active conversation ID (null indicates an unsaved new chat)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // List of all user conversations retrieved from PostgreSQL
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Loading flag for fetching conversation lists
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // Current typed input
  const [input, setInput] = useState("");

  // Loading flag for in-flight LLM requests or conversation loads
  const [isLoading, setIsLoading] = useState(false);

  // User-facing error message (sanitized)
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sidebar open/closed state (true by default for desktop)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Toggle sidebar between open and full page view
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  // Request token counter to guard against race conditions and stale async overwrites
  const requestIdRef = useRef<number>(0);

  /**
   * Fetches all conversations from PostgreSQL.
   * Guarantees conversations state is always an array.
   */
  const loadConversations = useCallback(async () => {
    try {
      setIsLoadingConversations(true);
      const list = await fetchConversations();
      setConversations(Array.isArray(list) ? list : []);
    } catch (err: unknown) {
      console.error("Failed to load conversations:", err);
      setConversations((prev) => (Array.isArray(prev) ? prev : []));
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  // Load conversations on component mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  /**
   * Resets the active chat session:
   * Clears messages, active conversation ID, input text, errors, and closes mobile sidebar.
   */
  const handleNewChat = useCallback(() => {
    // Invalidate any in-flight async request
    requestIdRef.current += 1;
    setCurrentConversationId(null);
    setMessages([]);
    setInput("");
    setErrorMessage(null);
    setIsSidebarOpen(false);
  }, []);

  /**
   * Dismisses any active error notification banner.
   */
  const dismissError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  /**
   * Selects an existing conversation, fetches its messages from PostgreSQL,
   * and loads them into active state.
   */
  const selectConversation = useCallback(
    async (conversationId: string) => {
      if (conversationId === currentConversationId && !isLoading) {
        setIsSidebarOpen(false);
        return;
      }

      const reqId = ++requestIdRef.current;
      setErrorMessage(null);
      setIsLoading(true);
      setCurrentConversationId(conversationId);
      setIsSidebarOpen(false);

      try {
        const detail = await fetchConversation(conversationId);

        // Guard against stale asynchronous response if user switched chats quickly
        if (requestIdRef.current !== reqId) return;

        // Map persisted database messages to UI Message interface
        const loadedMessages: Message[] = detail.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          provider: m.provider,
        }));

        setMessages(loadedMessages);
      } catch (err: unknown) {
        if (requestIdRef.current !== reqId) return;
        console.error("Failed to load conversation details:", err);
        setErrorMessage("Could not load the requested conversation. Please try again.");
      } finally {
        if (requestIdRef.current === reqId) {
          setIsLoading(false);
        }
      }
    },
    [currentConversationId, isLoading]
  );

  /**
   * Deletes a conversation from PostgreSQL and updates the local conversation list.
   * If the currently active conversation is deleted, resets the chat to a blank session.
   */
  const deleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        // Optimistically update conversation list
        setConversations((prev) =>
          Array.isArray(prev) ? prev.filter((c) => c.id !== conversationId) : []
        );

        if (currentConversationId === conversationId) {
          handleNewChat();
        }

        await deleteConversationApi(conversationId);
      } catch (err: unknown) {
        console.error("Failed to delete conversation:", err);
        setErrorMessage("Failed to delete conversation from database.");
        // Refresh list on error to ensure sync
        loadConversations();
      }
    },
    [currentConversationId, handleNewChat, loadConversations]
  );

  /**
   * Toggles the pinned status of a conversation.
   */
  const togglePin = useCallback(
    async (conversationId: string) => {
      // Find the target conversation
      const target = conversations.find((c) => c.id === conversationId);
      if (target && !target.pinned) {
        const pinnedCount = conversations.filter((c) => c.pinned).length;
        if (pinnedCount >= 7) {
          setErrorMessage("You can pin up to 7 conversations. Please unpin one first.");
          return;
        }
      }

      try {
        // Optimistically update pinned state
        setConversations((prev) =>
          Array.isArray(prev)
            ? prev.map((c) =>
                c.id === conversationId ? { ...c, pinned: !c.pinned } : c
              )
            : []
        );

        await toggleConversationPin(conversationId);
        // Refresh conversations to preserve updated order
        loadConversations();
      } catch (err: unknown) {
        console.error("Failed to toggle pin:", err);
        const errorWithResponse = err as { response?: { data?: { detail?: string } } };
        const detail = errorWithResponse?.response?.data?.detail || "Failed to update pinned status.";
        setErrorMessage(detail);
        loadConversations();
      }
    },
    [conversations, loadConversations]
  );

  /**
   * Renames a conversation's title.
   */
  const renameConversation = useCallback(
    async (conversationId: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) return;

      try {
        // Optimistically update title
        setConversations((prev) =>
          Array.isArray(prev)
            ? prev.map((c) =>
                c.id === conversationId ? { ...c, title: trimmed } : c
              )
            : []
        );

        await updateConversationTitle(conversationId, trimmed);
      } catch (err: unknown) {
        console.error("Failed to rename conversation:", err);
        setErrorMessage("Failed to rename conversation.");
        loadConversations();
      }
    },
    [loadConversations]
  );

  /**
   * Centralized API Request Executor:
   * Dispatches the chat payload to the backend, binds conversation_id,
   * appends the AI reply, and updates conversation sessions in PostgreSQL.
   */
  const executeChatRequest = useCallback(
    async (conversation: Message[]) => {
      const reqId = ++requestIdRef.current;
      setErrorMessage(null);
      setIsLoading(true);

      try {
        // Map to backend schema: { role: "user" | "assistant", content: string }
        const apiPayload: ApiChatMessage[] = conversation.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        // Send request with active conversation ID (or null for new session)
        const response = await sendChatMessage(apiPayload, currentConversationId);

        // Guard against stale response if user switched chats while generating
        if (requestIdRef.current !== reqId) return;

        // Add assistant response with provider badge metadata
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.content,
          provider: response.provider,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // If this was a new conversation, record the assigned ID
        if (response.conversation_id && !currentConversationId) {
          setCurrentConversationId(response.conversation_id);
        }

        // Refresh conversation list to show newly created or updated conversation
        loadConversations();
      } catch (err: unknown) {
        if (requestIdRef.current !== reqId) return;
        console.error("Chat API request error:", err);

        let userFriendlyError =
          "Failed to communicate with the AI backend. Please verify the server is running.";

        if (axios.isAxiosError(err)) {
          if (!err.response) {
            userFriendlyError =
              "Cannot connect to the backend server. Please verify that FastAPI is running on http://127.0.0.1:8000.";
          } else if (err.code === "ECONNABORTED") {
            userFriendlyError =
              "The request timed out while waiting for the AI response. Please try again.";
          } else {
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
            } else if (status === 404) {
              userFriendlyError =
                "The current conversation was not found in the database. Starting a new chat session.";
              handleNewChat();
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
        if (requestIdRef.current === reqId) {
          setIsLoading(false);
        }
      }
    },
    [currentConversationId, handleNewChat, loadConversations]
  );

  /**
   * Message Submission Handler:
   * Validates user input, adds user message to state, and initiates the API call.
   */
  const sendMessage = useCallback(
    (e?: React.FormEvent) => {
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
    },
    [input, isLoading, messages, executeChatRequest]
  );

  /**
   * Retry Handler:
   * Re-sends the active conversation history after a failed request.
   */
  const handleRetry = useCallback(() => {
    if (messages.length === 0 || isLoading) return;
    executeChatRequest(messages);
  }, [messages, isLoading, executeChatRequest]);

  return {
    messages,
    currentConversationId,
    conversations,
    isLoadingConversations,
    input,
    setInput,
    isLoading,
    errorMessage,
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebar,
    sendMessage,
    handleRetry,
    handleNewChat,
    selectConversation,
    deleteConversation,
    togglePin,
    renameConversation,
    dismissError,
  };
}
