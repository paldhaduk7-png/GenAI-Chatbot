"use client";

import React, { useRef, useEffect } from "react";
import { Bot, AlertCircle, RotateCcw, X } from "lucide-react";
import { Message } from "@/types/chat";
import { ChatMessage } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onDismissError: () => void;
}

/**
 * ChatMessages Component:
 * Renders the scrollable conversation history:
 * - Empty state welcome screen.
 * - Message bubble list.
 * - In-flight AI response loading indicator.
 * - Error banner with retry and dismiss controls.
 * - Auto-scroll to the latest message.
 */
export function ChatMessages({
  messages,
  isLoading,
  errorMessage,
  onRetry,
  onDismissError,
}: ChatMessagesProps) {
  // Anchor to auto-scroll into view when messages change or loading state toggles
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8">
      <div className="mx-auto max-w-3xl space-y-4">
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-900/60 hover:bg-red-800/80 px-2.5 py-1 text-xs font-medium text-white transition active:scale-95 disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Try again</span>
                </button>
              </div>
              {/* Dismiss error button */}
              <button
                onClick={onDismissError}
                className="rounded-md p-1 hover:bg-red-900/60 text-red-400"
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
