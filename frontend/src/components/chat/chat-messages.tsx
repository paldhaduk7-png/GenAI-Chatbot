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
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Welcome Screen (When no messages exist yet) */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shadow-xs">
              <Bot className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Welcome to GenAI Chatbot
            </h2>
            <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              Ask a question to begin. Responses are powered by Mistral AI with automatic
              failover to Google Gemini.
            </p>
          </div>
        ) : (
          /* Message Bubbles */
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}

        {/* Loading Indicator while awaiting AI generation */}
        {isLoading && <TypingIndicator />}

        {/* Error Notification with Retry & Dismiss */}
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 shadow-xs">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div>
                  <p className="font-semibold text-red-900 dark:text-red-200">
                    Unable to generate response
                  </p>
                  <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
                    {errorMessage}
                  </p>
                </div>
                {/* Retry action button */}
                <button
                  onClick={onRetry}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 px-2.5 py-1 text-xs font-medium text-red-800 dark:text-red-200 transition active:scale-95 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Try again</span>
                </button>
              </div>
              {/* Dismiss error button */}
              <button
                onClick={onDismissError}
                className="rounded-md p-1 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-500 hover:text-red-700 dark:text-red-400"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
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
