"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { AlertCircle, RotateCcw, X } from "lucide-react";
import { Message } from "@/types/chat";
import { ChatMessage } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onDismissError: () => void;
  conversationId?: string | null;
}

/**
 * ChatMessages Component:
 * Renders the scrollable conversation history:
 * - Smart auto-scroll: Scrolls down on user prompt or when near bottom.
 * - Respects reading position if user scrolls up.
 * - Prevents page-level scrollbars using container-level scrollTo.
 * - Independent vertical scrolling with flex-1 min-h-0.
 */
export function ChatMessages({
  messages,
  isLoading,
  errorMessage,
  onRetry,
  onDismissError,
  conversationId,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const prevMessagesLengthRef = useRef<number>(messages.length);

  // Monitor user scroll position to avoid forcing jumps if reading history
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 150; // pixels from bottom to be considered "at the bottom"
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceToBottom <= threshold;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = containerRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior,
      });
    }
  }, []);

  // Handle messages change or loading state
  useEffect(() => {
    const prevLen = prevMessagesLengthRef.current;
    const currentLen = messages.length;
    prevMessagesLengthRef.current = currentLen;

    const lastMsg = currentLen > 0 ? messages[currentLen - 1] : null;
    const isNewUserMessage = currentLen > prevLen && lastMsg?.role === "user";

    // If user just sent a new message, ALWAYS smoothly scroll to bottom
    if (isNewUserMessage) {
      isNearBottomRef.current = true;
      scrollToBottom("smooth");
      return;
    }

    // If assistant reply arrives or loading state changes, only scroll if user was already near bottom
    if (isNearBottomRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages, isLoading, scrollToBottom]);

  // Initial scroll to bottom on conversation load or switch
  useEffect(() => {
    isNearBottomRef.current = true;
    scrollToBottom("auto");
  }, [conversationId, scrollToBottom]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 min-w-0 w-full overflow-y-auto px-4 py-4 md:px-8 overscroll-contain"
    >
      <div className="mx-auto max-w-3xl space-y-5 pb-6">
        {/* Message Bubbles */}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} onRetry={onRetry} />
        ))}

        {/* Loading Indicator while awaiting AI generation */}
        {isLoading && <TypingIndicator />}

        {/* Error Notification with Retry & Dismiss */}
        {errorMessage && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/40 p-3.5 text-xs text-red-200 shadow-xs my-2">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div>
                  <p className="font-semibold text-red-200">
                    Unable to generate response
                  </p>
                  <p className="mt-0.5 text-xs text-red-300">
                    {errorMessage}
                  </p>
                </div>
                {/* Retry action button */}
                <button
                  onClick={onRetry}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-900/60 hover:bg-red-800/80 px-2.5 py-1 text-xs font-medium text-white transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Try again</span>
                </button>
              </div>
              {/* Dismiss error button */}
              <button
                onClick={onDismissError}
                className="rounded-md p-1 hover:bg-red-900/60 text-red-400 cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Invisible bottom spacer to ensure final message is never cramped */}
        <div className="h-4 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}

