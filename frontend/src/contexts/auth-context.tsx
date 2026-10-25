"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  AuthContextType,
  LoginRequest,
  RegisterRequest,
  User,
} from "@/types/auth";
import {
  getCurrentUser,
  loginUser,
  registerUser,
  getAuthToken,
  setAuthToken,
  setUnauthorizedHandler,
} from "@/lib/api";

/**
 * Authentication Context
 * Manages global user authentication state, token persistence, and profile hydration.
 *
 * TOKEN STORAGE NOTICE:
 * Tokens are persisted in browser localStorage to retain sessions across browser refreshes.
 * Note that localStorage is readable by any client script and vulnerable to token exfiltration
 * if a Cross-Site Scripting (XSS) vulnerability is present. It does NOT offer the security of
 * an HttpOnly, Secure cookie.
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const activeToken = getAuthToken();
    if (!activeToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const userProfile = await getCurrentUser();
      setUser(userProfile);
      setToken(activeToken);
    } catch (err) {
      // Token is invalid, expired, or user was deleted
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  // Initialize session on mount
  useEffect(() => {
    // Subscribe to Axios 401 interceptor
    setUnauthorizedHandler(() => {
      logout();
    });

    refreshUser();

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [refreshUser, logout]);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      setIsLoading(true);
      try {
        const tokenResponse = await loginUser(credentials);
        setAuthToken(tokenResponse.access_token);
        setToken(tokenResponse.access_token);

        // Fetch user profile with newly set token
        const userProfile = await getCurrentUser();
        setUser(userProfile);
      } catch (err) {
        setAuthToken(null);
        setToken(null);
        setUser(null);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      setIsLoading(true);
      try {
        await registerUser(data);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(user && token),
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
