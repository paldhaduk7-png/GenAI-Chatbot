import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import { useChat } from "@/hooks/use-chat";
import { useDocuments } from "@/hooks/use-documents";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: "u1", email: "user@example.com", full_name: "Test User" },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
  },
}));

describe("Phase 6.5 Frontend Reliability & Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, "fetchConversations").mockResolvedValue([]);
    vi.spyOn(api, "fetchDocuments").mockResolvedValue([]);
  });

  it("handles backend timeout (ECONNABORTED) cleanly, preserves user message, and resets loading", async () => {
    const timeoutErr: any = new Error("timeout of 45000ms exceeded");
    timeoutErr.isAxiosError = true;
    timeoutErr.code = "ECONNABORTED";
    // Axios timeouts have no response object
    timeoutErr.response = undefined;

    const spySend = vi.spyOn(api, "sendChatMessage").mockRejectedValueOnce(timeoutErr);

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    act(() => {
      result.current.setInput("Timeout test question");
    });

    act(() => {
      result.current.sendMessage();
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toContain("timed out");
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe("Timeout test question");
    expect(spySend).toHaveBeenCalledTimes(1); // No auto-retry
  });

  it("handles network error (!response) without auto-retrying POST", async () => {
    const netErr: any = new Error("Network Error");
    netErr.isAxiosError = true;
    netErr.response = undefined;

    const spySend = vi.spyOn(api, "sendChatMessage").mockRejectedValueOnce(netErr);

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    act(() => {
      result.current.setInput("Network fail");
    });

    act(() => {
      result.current.sendMessage();
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toContain("Cannot connect to the backend server");
    });

    expect(result.current.isLoading).toBe(false);
    expect(spySend).toHaveBeenCalledTimes(1);
  });

  it("supports manual retry via handleRetry after 503 failure without duplicating user message", async () => {
    const err503: any = new Error("Service Unavailable");
    err503.isAxiosError = true;
    err503.response = {
      status: 503,
      data: { detail: "Both primary (Mistral) and fallback (Gemini) AI providers are currently unavailable." },
    };

    const spySend = vi
      .spyOn(api, "sendChatMessage")
      .mockRejectedValueOnce(err503)
      .mockResolvedValueOnce({
        conversation_id: "conv-retry-1",
        role: "assistant",
        content: "Recovered response",
        provider: "gemini",
        sources: [],
      });

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    act(() => {
      result.current.setInput("Retry question");
    });

    act(() => {
      result.current.sendMessage();
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toContain("unavailable");
    });

    expect(result.current.messages).toHaveLength(1);

    // Trigger manual retry
    act(() => {
      result.current.handleRetry();
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.messages[0].content).toBe("Retry question");
    expect(result.current.messages[1].content).toBe("Recovered response");
    expect(result.current.messages[1].provider).toBe("gemini");
    expect(result.current.errorMessage).toBeNull();
    expect(spySend).toHaveBeenCalledTimes(2);
  });

  it("prevents duplicate POST submissions while a request is in flight", async () => {
    let resolveFn!: (val: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveFn = resolve;
    });

    const spySend = vi.spyOn(api, "sendChatMessage").mockReturnValueOnce(pendingPromise as any);

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    act(() => {
      result.current.setInput("Single submit");
    });

    act(() => {
      result.current.sendMessage();
    });

    // Attempt second submit / retry while still loading
    act(() => {
      result.current.sendMessage();
      result.current.handleRetry();
    });

    expect(spySend).toHaveBeenCalledTimes(1);

    resolveFn({
      conversation_id: "conv-1",
      role: "assistant",
      content: "Done",
      provider: "mistral",
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages).toHaveLength(2);
  });

  it("handles document upload timeout and 429 cleanly without auto-retry", async () => {
    const timeoutErr: any = new Error("Upload timeout");
    timeoutErr.isAxiosError = true;
    timeoutErr.code = "ECONNABORTED";

    const spyUpload = vi.spyOn(api, "uploadDocument").mockRejectedValueOnce(timeoutErr);

    const { result } = renderHook(() => useDocuments());
    const file = new File(["%PDF-1.4 dummy"], "large.pdf", { type: "application/pdf" });

    let res: any;
    await act(async () => {
      res = await result.current.upload(file);
    });

    expect(res).toBeNull();
    expect(result.current.isUploading).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Document upload timed out. Please try again.", { id: "doc-upload" });
    expect(spyUpload).toHaveBeenCalledTimes(1);
  });

  it("attaches X-Request-ID in request interceptor and preserves requestId on Axios error", async () => {
    const reqHandler = (api.apiClient.interceptors.request as any).handlers[0].fulfilled;
    const modifiedConfig = reqHandler({ headers: {} as any });
    expect(modifiedConfig.headers["X-Request-ID"]).toBeTruthy();

    const errHandler = (api.apiClient.interceptors.response as any).handlers[0].rejected;
    const mockError: any = {
      response: { status: 503, headers: { "x-request-id": "srv-req-999" } },
      config: { url: "/api/chat", headers: { "X-Request-ID": "cli-req-111" } },
    };
    await expect(errHandler(mockError)).rejects.toBe(mockError);
    expect(mockError.requestId).toBe("srv-req-999");
  });
});
