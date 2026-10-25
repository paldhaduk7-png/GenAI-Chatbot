"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  User,
  Plus,
  Send,
  Menu,
  X,
  Sparkles,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";

/**
 * Message interface: Defines the structure for each chat message.
 * - `id`: Unique identifier for list rendering keys.
 * - `role`: Determines if the bubble belongs to the user or the assistant.
 * - `content`: The text message to display.
 * - `provider`: Optional indicator (e.g. 'mistral' or 'gemini') for backend integration.
 */
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: "mistral" | "gemini";
}

export default function ChatPage() {
  /**
   * React State Variables:
   * - `messages`: Holds the conversation history currently displayed in the chat area.
   * - `input`: Stores whatever the user is typing into the multiline textarea.
   * - `isSidebarOpen`: Controls the mobile slide-out drawer (true = visible on small screens).
   */
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "Hello! I am your GenAI Assistant powered by Mistral AI with automatic Gemini fallback. How can I help you today?",
      provider: "mistral",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Ref to automatically scroll to the bottom whenever a new message is added
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Resets the conversation to an empty state when "New Chat" is clicked.
   */
  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setIsSidebarOpen(false); // Close mobile sidebar if open
  };

  /**
   * Handles sending a new message.
   * Note: In Phase 1 Frontend UI scaffolding, this adds the user's message
   * to the local state so the message bubble layout can be previewed immediately.
   */
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // Append the new user message to the conversation state
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedInput,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
  };

  /**
   * Allows submitting the message with 'Enter' while preserving 'Shift + Enter' for new lines.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    // Outer Container: Fixed full-screen height (h-screen) with no page-level scrollbars
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* ============================================================
          1. Mobile Backdrop: Dim background when mobile sidebar is open
          ============================================================ */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ============================================================
          2. Left Sidebar: Shows branding, "New Chat" button, and status
          - Desktop (md:): Static 64px-72px column
          - Mobile: Fixed slide-over drawer controlled by `isSidebarOpen`
          ============================================================ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header & Navigation */}
        <div className="space-y-4">
          {/* Brand Logo & Close Button (Mobile) */}
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-semibold leading-tight tracking-tight">
                  GenAI Chatbot
                </h1>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Phase 1: Basic AI
                </span>
              </div>
            </div>

            {/* Close button: Only visible on mobile devices */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 md:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* "New Chat" Action Button */}
          <button
            onClick={handleNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </button>

          {/* Informational Chat Section */}
          <div className="pt-2">
            <div className="flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Current Session</span>
            </div>
            <div className="mt-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50 p-2.5 text-xs text-zinc-600 dark:text-zinc-400">
              Active conversation with automatic model fallback protection.
            </div>
          </div>
        </div>

        {/* Sidebar Footer: System Status */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Primary: Mistral | Fallback: Gemini</span>
          </div>
        </div>
      </aside>

      {/* ============================================================
          3. Main Chat Area: Header, message scroll zone, and input bar
          ============================================================ */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 px-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 md:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Chat Session
            </span>
          </div>

          {/* Backend Connection Indicator Badge */}
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Backend Ready</span>
          </div>
        </header>

        {/* Scrollable Message List */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Welcome Heading: Displayed when there are no messages */}
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Bot className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Welcome to GenAI Chatbot
                </h2>
                <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                  Type your prompt below to start a conversation. Your queries are
                  processed through Mistral AI with resilient Gemini fallback.
                </p>
              </div>
            ) : (
              /* Message Bubbles: Maps through the message array */
              messages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={`flex items-start gap-3 ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* User / Assistant Avatar */}
                    <div
                      className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold shadow-xs ${
                        isUser
                          ? "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "bg-indigo-600 text-white"
                      }`}
                    >
                      {isUser ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>

                    {/* Message Bubble Body */}
                    <div
                      className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                        isUser
                          ? "bg-indigo-600 text-white rounded-tr-xs"
                          : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 rounded-tl-xs"
                      }`}
                    >
                      {/* Provider Badge: Displays model name if available */}
                      {!isUser && message.provider && (
                        <div className="mb-1 text-[11px] font-semibold tracking-wide uppercase text-indigo-600 dark:text-indigo-400">
                          {message.provider}
                        </div>
                      )}
                      {/* Message Content */}
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                );
              })
            )}

            {/* Scroll Anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ============================================================
            4. Bottom Input Bar: Multiline textarea and Send button
            ============================================================ */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="mx-auto max-w-3xl">
            <form
              onSubmit={handleSendMessage}
              className="relative flex items-end gap-2 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-2 shadow-xs focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500"
            >
              {/* Multiline Text Input */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message... (Press Enter to send, Shift+Enter for newline)"
                rows={1}
                className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden"
              />

              {/* Submit Button: Disabled if input is empty */}
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
              GenAI Chatbot Phase 1 &bull; Backend API integration pending
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
