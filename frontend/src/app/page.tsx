"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ChatContainer } from "@/components/chat/chat-container";

/**
 * Main Chat Application Page
 * Protected Dashboard Route:
 * - Shows cyber-styled loading state during initial session hydration.
 * - Redirects unauthenticated visitors safely to /login.
 * - Renders ChatContainer once the user is confirmed authenticated.
 */
export default function Page() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Prevent UI flicker during initial auth hydration
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#07080d]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          <p className="text-xs text-zinc-500 font-medium tracking-wide">
            Initializing session...
          </p>
        </div>
      </div>
    );
  }

  // Prevent rendering dashboard while redirect is pending
  if (!isAuthenticated) {
    return null;
  }

  return <ChatContainer />;
}
