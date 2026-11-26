import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "@/hooks/use-chat";
import * as api from "@/lib/api";
import { toast } from "sonner";
import { DocumentItem } from "@/types/document";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: "u-123", email: "user@example.com", full_name: "Test User" },
  }),
}));

describe("useChat Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, "fetchConversations").mockResolvedValue([]);
  });

  it("initializes with default empty state", async () => {
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    expect(result.current.messages).toEqual([]);
    expect(result.current.currentConversationId).toBeNull();
    expect(result.current.selectedDocument).toBeNull();
    expect(result.current.input).toBe("");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it("updates input value via setInput", async () => {
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    act(() => {
      result.current.setInput("Hello AI");
    });
    expect(result.current.input).toBe("Hello AI");
  });

  it("prevents submitting empty or whitespace-only messages", async () => {
    const spySend = vi.spyOn(api, "sendChatMessage");
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    act(() => {
      result.current.setInput("   ");
    });

    act(() => {
      result.current.sendMessage();
    });

    expect(spySend).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("sends message successfully and appends assistant response", async () => {
    vi.spyOn(api, "sendChatMessage").mockResolvedValueOnce({
      conversation_id: "conv-101",
      role: "assistant",
      content: "Hello! How can I help you?",
      provider: "mistral",
      sources: [],
      has_sufficient_context: null,
    });

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    act(() => {
      result.current.setInput("Hi bot");
    });

    act(() => {
      result.current.sendMessage();
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
    });

    expect(api.sendChatMessage).toHaveBeenCalledWith(
      [{ role: "user", content: "Hi bot" }],
      null,
      null,
      false
    );

    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      content: "Hi bot",
    });
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "Hello! How can I help you?",
      provider: "mistral",
    });
    expect(result.current.currentConversationId).toBe("conv-101");
    expect(result.current.input).toBe("");
  });

  it("sends document_id and use_rag: true when selectedDocument is active", async () => {
    vi.spyOn(api, "sendChatMessage").mockResolvedValueOnce({
      conversation_id: "conv-rag-1",
      role: "assistant",
      content: "Based on the document, revenue grew by 15%.",
      provider: "gemini",
      sources: [
        {
          document_id: "doc-99",
          document_filename: "report.pdf",
          chunk_id: "chunk-1",
          page_number: 2,
          similarity_score: 0.94,
        },
      ],
      has_sufficient_context: true,
    });

    const doc: DocumentItem = {
      id: "doc-99",
      filename: "report.pdf",
      file_path: "/path",
      status: "completed",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    act(() => {
      result.current.setSelectedDocument(doc);
      result.current.setInput("What is the revenue growth?");
    });

    act(() => {
      result.current.sendMessage();
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
    });

    expect(api.sendChatMessage).toHaveBeenCalledWith(
      [{ role: "user", content: "What is the revenue growth?" }],
      null,
      "doc-99",
      true
    );

    expect(result.current.messages[1].sources?.length).toBe(1);
    expect(result.current.messages[1].has_sufficient_context).toBe(true);
    expect(result.current.messages[1].provider).toBe("gemini");
  });

  it("handles HTTP 429 rate limit response gracefully without retrying", async () => {
    const rateLimitError: any = new Error("Rate limit exceeded");
    rateLimitError.isAxiosError = true;
    rateLimitError.response = {
      status: 429,
      data: { detail: "Rate limit exceeded: 30 per 1 minute. Please try again later." },
    };

    vi.spyOn(api, "sendChatMessage").mockRejectedValueOnce(rateLimitError);

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    act(() => {
      result.current.setInput("Rate test");
    });

    act(() => {
      result.current.sendMessage();
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toContain("Rate limit exceeded");
    });

    // Verify user message is preserved in state
    expect(result.current.messages.length).toBe(1);
    expect(result.current.messages[0].content).toBe("Rate test");
    expect(toast.error).toHaveBeenCalledWith(
      "Rate limit exceeded: 30 per 1 minute. Please try again later."
    );
    expect(result.current.isLoading).toBe(false);
  });

  it("handles HTTP 500 internal server error", async () => {
    const serverError: any = new Error("Internal Server Error");
    serverError.isAxiosError = true;
    serverError.response = {
      status: 500,
      data: { detail: "An internal server error occurred." },
    };

    vi.spyOn(api, "sendChatMessage").mockRejectedValueOnce(serverError);

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    act(() => {
      result.current.setInput("Trigger 500");
    });

    act(() => {
      result.current.sendMessage();
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toBe("An internal server error occurred.");
    });
    expect(toast.error).toHaveBeenCalledWith("An internal server error occurred.");
  });

  it("toggles sidebar visibility", async () => {
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    const initial = result.current.isSidebarOpen;
    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.isSidebarOpen).toBe(!initial);
  });

  it("handleNewChat resets active conversation and messages", async () => {
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    act(() => {
      result.current.handleNewChat();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.currentConversationId).toBeNull();
    expect(result.current.selectedDocument).toBeNull();
  });
});
