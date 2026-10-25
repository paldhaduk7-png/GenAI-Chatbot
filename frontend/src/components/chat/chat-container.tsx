"use client";

import React from "react";
import { useChat } from "@/hooks/use-chat";
import { ChatSidebar } from "@/components/layout/chat-sidebar";
import { ChatHeader } from "@/components/layout/chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";

/**
 * ChatContainer Component:
 * Composes the primary chat interface:
 * - Integrates the `useChat` custom hook for state & backend communication.
 * - Manages the layout between the navigation sidebar and the chat conversation workspace.
 */
export function ChatContainer() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    errorMessage,
    isSidebarOpen,
    setIsSidebarOpen,
    sendMessage,
    handleRetry,
    handleNewChat,
    dismissError,
  } = useChat();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Navigation & Session Controls */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={handleNewChat}
        isLoading={isLoading}
      />

      {/* Main Conversation Workspace */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <ChatHeader onOpenSidebar={() => setIsSidebarOpen(true)} />

        {/* Scrollable Message History Area */}
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onRetry={handleRetry}
          onDismissError={dismissError}
        />

        {/* Bottom Message Input */}
        <ChatInput
          input={input}
          isLoading={isLoading}
          onChangeInput={setInput}
          onSubmit={sendMessage}
        />
      </main>
    </div>
  );
}
