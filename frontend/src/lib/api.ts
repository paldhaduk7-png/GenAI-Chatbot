import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import {
  ApiChatMessage,
  ChatApiRequest,
  ChatApiResponse,
  Conversation,
  ConversationDetail,
  ConversationDeleteResponse,
} from "@/types/chat";
import {
  AuthTokenResponse,
  LoginRequest,
  RegisterRequest,
  User,
} from "@/types/auth";

// Re-export for convenience
export type {
  ApiChatMessage,
  ChatApiRequest,
  ChatApiResponse,
  Conversation,
  ConversationDetail,
  ConversationDeleteResponse,
  AuthTokenResponse,
  LoginRequest,
  RegisterRequest,
  User,
};

/**
 * Storage key for persisting the authentication JWT token.
 *
 * NOTE ON TOKEN STORAGE SECURITY:
 * Storing the JWT access token in browser localStorage allows persistence across page reloads.
 * However, localStorage is accessible to any client-side JavaScript executing in the same origin,
 * making it vulnerable to token theft if a Cross-Site Scripting (XSS) flaw exists.
 * It is NOT equivalent to an HttpOnly, Secure, SameSite cookie, which prevents JavaScript access.
 * For production hardening, HttpOnly cookie-based session management is recommended.
 */
const TOKEN_STORAGE_KEY = "genai_chat_access_token";

/**
 * Retrieves the stored JWT access token from localStorage safely.
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to access localStorage for auth token:", err);
    return null;
  }
}

/**
 * Sets or removes the stored JWT access token in localStorage.
 */
export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (err) {
    console.error("Failed to update localStorage with auth token:", err);
  }
}

/**
 * Callback subscriber to notify state managers (like AuthContext) upon 401 Unauthorized.
 */
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

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
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 45000,
});

/**
 * Request Interceptor:
 * Attaches `Authorization: Bearer <token>` to all outgoing requests if a token exists.
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAuthToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor:
 * Handles HTTP 401 Unauthorized responses without redirect loops or unintended retries.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || "";

      // Do NOT trigger logout or redirects for failed login or registration attempts
      const isAuthEndpoint =
        url.includes("/api/auth/login") || url.includes("/api/auth/register");

      if (!isAuthEndpoint) {
        // Clear expired or invalid credentials
        setAuthToken(null);
        if (unauthorizedHandler) {
          unauthorizedHandler();
        }
      }
    }
    return Promise.reject(error);
  }
);

/* ============================================================================
 * Authentication API Endpoints
 * ============================================================================ */

/**
 * Registers a new user account.
 * POST /api/auth/register
 */
export async function registerUser(payload: RegisterRequest): Promise<User> {
  const response = await apiClient.post<User>("/api/auth/register", payload);
  return response.data;
}

/**
 * Authenticates user credentials and returns a JWT access token.
 * POST /api/auth/login
 */
export async function loginUser(
  payload: LoginRequest
): Promise<AuthTokenResponse> {
  const response = await apiClient.post<AuthTokenResponse>(
    "/api/auth/login",
    payload
  );
  return response.data;
}

/**
 * Fetches the currently authenticated user's profile.
 * GET /api/auth/me
 */
export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>("/api/auth/me");
  return response.data;
}

/* ============================================================================
 * Chat & Conversation API Endpoints
 * ============================================================================ */

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
 * Fetches all saved conversations belonging to the authenticated user.
 * Always validates and returns an array to prevent non-iterable runtime errors.
 */
export async function fetchConversations(): Promise<Conversation[]> {
  try {
    const response = await apiClient.get<Conversation[]>("/api/conversations");
    return Array.isArray(response.data) ? response.data : [];
  } catch (err: unknown) {
    // If unauthenticated (401), re-throw so state manager can react if needed
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      return [];
    }
    console.error("fetchConversations API error:", err);
    return [];
  }
}

/**
 * Creates a new conversation session explicitly.
 * POST /api/conversations
 */
export async function createConversation(
  title?: string
): Promise<Conversation> {
  const response = await apiClient.post<Conversation>("/api/conversations", {
    title: title || "New Conversation",
  });
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
  const data = response.data;
  return {
    ...data,
    messages: Array.isArray(data?.messages) ? data.messages : [],
  };
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
