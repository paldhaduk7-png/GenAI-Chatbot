"use client";

import { useContext } from "react";
import { AuthContext } from "@/contexts/auth-context";
import { AuthContextType } from "@/types/auth";

/**
 * Custom React hook to access global authentication state and methods.
 * Must be used within an `<AuthProvider>`.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>.");
  }
  return context;
}
