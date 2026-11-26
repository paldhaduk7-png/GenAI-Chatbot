import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import {
  getAuthToken,
  setAuthToken,
  setUnauthorizedHandler,
  apiClient,
  loginUser,
  registerUser,
  getCurrentUser,
  sendChatMessage,
  fetchConversations,
  fetchConversation,
  createConversation,
  updateConversationTitle,
  toggleConversationPin,
  deleteConversation,
  fetchDocuments,
  uploadDocument,
  deleteDocument,
} from "@/lib/api";

describe("API Client & Auth Token Utilities", () => {
  beforeEach(() => {
    localStorage.clear();
    setUnauthorizedHandler(null);
    vi.restoreAllMocks();
  });

  describe("Token Storage", () => {
    it("returns null when no token is in localStorage", () => {
      expect(getAuthToken()).toBeNull();
    });

    it("stores and retrieves a valid JWT token", () => {
      setAuthToken("test-jwt-token-12345");
      expect(getAuthToken()).toBe("test-jwt-token-12345");
      expect(localStorage.getItem("genai_chat_access_token")).toBe("test-jwt-token-12345");
    });

    it("removes token when null is passed", () => {
      setAuthToken("sample-token");
      expect(getAuthToken()).toBe("sample-token");

      setAuthToken(null);
      expect(getAuthToken()).toBeNull();
      expect(localStorage.getItem("genai_chat_access_token")).toBeNull();
    });
  });

  describe("Request Interceptor", () => {
    it("attaches Authorization Bearer header when token exists", async () => {
      setAuthToken("jwt-bearer-xyz");
      const config: InternalAxiosRequestConfig = {
        headers: {} as any,
      };

      // Call request interceptor
      const handler = (apiClient.interceptors.request as any).handlers[0].fulfilled;
      const modifiedConfig = handler(config);

      expect(modifiedConfig.headers.Authorization).toBe("Bearer jwt-bearer-xyz");
    });

    it("does not attach Authorization header when token is absent", async () => {
      setAuthToken(null);
      const config: InternalAxiosRequestConfig = {
        headers: {} as any,
      };

      const handler = (apiClient.interceptors.request as any).handlers[0].fulfilled;
      const modifiedConfig = handler(config);

      expect(modifiedConfig.headers.Authorization).toBeUndefined();
    });
  });

  describe("Response Interceptor (401 Handling)", () => {
    it("clears token and invokes unauthorizedHandler on 401 for protected endpoints", async () => {
      setAuthToken("stale-token");
      const mockHandler = vi.fn();
      setUnauthorizedHandler(mockHandler);

      const error: any = {
        response: { status: 401 },
        config: { url: "/api/chat" },
      };

      const errorHandler = (apiClient.interceptors.response as any).handlers[0].rejected;

      await expect(errorHandler(error)).rejects.toEqual(error);
      expect(getAuthToken()).toBeNull();
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it("does NOT clear token or invoke handler on 401 for login or register endpoints", async () => {
      setAuthToken("existing-token");
      const mockHandler = vi.fn();
      setUnauthorizedHandler(mockHandler);

      const error: any = {
        response: { status: 401 },
        config: { url: "/api/auth/login" },
      };

      const errorHandler = (apiClient.interceptors.response as any).handlers[0].rejected;

      await expect(errorHandler(error)).rejects.toEqual(error);
      expect(getAuthToken()).toBe("existing-token");
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe("API Endpoint Functions", () => {
    it("loginUser makes POST request to /api/auth/login", async () => {
      const mockPost = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
        data: { access_token: "mock-token", token_type: "bearer" },
      });

      const res = await loginUser({ email: "user@example.com", password: "SecretPassword1" });
      expect(mockPost).toHaveBeenCalledWith("/api/auth/login", {
        email: "user@example.com",
        password: "SecretPassword1",
      });
      expect(res.access_token).toBe("mock-token");
    });

    it("registerUser makes POST request to /api/auth/register", async () => {
      const mockPost = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
        data: { id: "u-1", email: "new@example.com", full_name: "New User" },
      });

      const res = await registerUser({
        email: "new@example.com",
        password: "ValidPassword1",
        full_name: "New User",
      });
      expect(mockPost).toHaveBeenCalledWith("/api/auth/register", {
        email: "new@example.com",
        password: "ValidPassword1",
        full_name: "New User",
      });
      expect(res.id).toBe("u-1");
    });

    it("getCurrentUser makes GET request to /api/auth/me", async () => {
      const mockGet = vi.spyOn(apiClient, "get").mockResolvedValueOnce({
        data: { id: "u-1", email: "user@example.com" },
      });

      const res = await getCurrentUser();
      expect(mockGet).toHaveBeenCalledWith("/api/auth/me");
      expect(res.email).toBe("user@example.com");
    });

    it("sendChatMessage dispatches chat request with RAG and conversation params", async () => {
      const mockPost = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
        data: {
          conversation_id: "conv-1",
          role: "assistant",
          content: "RAG response answer",
          provider: "mistral",
          sources: [{ chunk_id: "c-1", document_id: "doc-1", document_filename: "doc.pdf" }],
        },
      });

      const res = await sendChatMessage(
        [{ role: "user", content: "What is AI?" }],
        "conv-1",
        "doc-1",
        true
      );

      expect(mockPost).toHaveBeenCalledWith("/api/chat", {
        messages: [{ role: "user", content: "What is AI?" }],
        conversation_id: "conv-1",
        document_id: "doc-1",
        use_rag: true,
      });
      expect(res.content).toBe("RAG response answer");
      expect(res.sources?.length).toBe(1);
    });

    it("fetchConversations retrieves conversation list", async () => {
      const mockGet = vi.spyOn(apiClient, "get").mockResolvedValueOnce({
        data: [{ id: "c-1", title: "Chat 1", pinned: false }],
      });

      const list = await fetchConversations();
      expect(mockGet).toHaveBeenCalledWith("/api/conversations");
      expect(list.length).toBe(1);
    });

    it("toggleConversationPin calls PATCH /api/conversations/:id/pin", async () => {
      const mockPatch = vi.spyOn(apiClient, "patch").mockResolvedValueOnce({
        data: { id: "c-1", pinned: true },
      });

      await toggleConversationPin("c-1");
      expect(mockPatch).toHaveBeenCalledWith("/api/conversations/c-1/pin");
    });

    it("deleteConversation calls DELETE /api/conversations/:id", async () => {
      const mockDelete = vi.spyOn(apiClient, "delete").mockResolvedValueOnce({
        data: { id: "c-1", message: "Deleted" },
      });

      const res = await deleteConversation("c-1");
      expect(mockDelete).toHaveBeenCalledWith("/api/conversations/c-1");
      expect(res.id).toBe("c-1");
    });

    it("uploadDocument sends multipart/form-data to /api/documents/upload", async () => {
      const mockPost = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
        data: {
          id: "doc-1",
          filename: "test.pdf",
          status: "completed",
          message: "Uploaded successfully",
        },
      });

      const file = new File(["dummy pdf content"], "test.pdf", { type: "application/pdf" });
      const res = await uploadDocument(file);

      expect(mockPost).toHaveBeenCalledWith(
        "/api/documents/upload",
        expect.any(FormData),
        expect.objectContaining({
          headers: { "Content-Type": "multipart/form-data" },
        })
      );
      expect(res.filename).toBe("test.pdf");
    });
  });

  describe("HTTP Error Responses Handling", () => {
    it("handles HTTP 429 Too Many Requests response without automatic retry", async () => {
      const errorResponse = {
        response: {
          status: 429,
          data: {
            detail: "Rate limit exceeded: 10 per 1 minute. Please try again later.",
            error: "Rate limit exceeded: 10 per 1 minute",
          },
        },
      };

      vi.spyOn(apiClient, "post").mockRejectedValueOnce(errorResponse);

      try {
        await loginUser({ email: "spammer@example.com", password: "Password1!" });
        expect.unreachable("Should have thrown 429 error");
      } catch (err: any) {
        expect(err.response.status).toBe(429);
        expect(err.response.data.detail).toContain("Rate limit exceeded");
      }
    });

    it("handles HTTP 500 Internal Server Error response", async () => {
      const errorResponse = {
        response: {
          status: 500,
          data: { detail: "An internal server error occurred." },
        },
      };

      vi.spyOn(apiClient, "get").mockRejectedValueOnce(errorResponse);

      await expect(getCurrentUser()).rejects.toEqual(errorResponse);
    });

    it("handles Network Error gracefully in fetchConversations (returns empty array)", async () => {
      const networkError = new Error("Network Error");
      vi.spyOn(apiClient, "get").mockRejectedValueOnce(networkError);

      const result = await fetchConversations();
      expect(result).toEqual([]);
    });

    it("propagates Network Error on fetchConversation", async () => {
      const networkError = new Error("Network Error");
      vi.spyOn(apiClient, "get").mockRejectedValueOnce(networkError);

      await expect(fetchConversation("conv-123")).rejects.toThrow("Network Error");
    });
  });
});
