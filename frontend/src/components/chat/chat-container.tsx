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
    currentConversationId,
    conversations,
    isLoadingConversations,
    input,
    setInput,
    isLoading,
    errorMessage,
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebar,
    sendMessage,
    handleRetry,
    handleNewChat,
    selectConversation,
    deleteConversation,
    togglePin,
    renameConversation,
    dismissError,
  } = useChat();

  const safeConversations = Array.isArray(conversations) ? conversations : [];

  const currentConversation = safeConversations.find(
    (c) => c.id === currentConversationId
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#212121] text-[#ececec] font-sans">
      {/* Navigation & Conversation Sessions Controls */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={toggleSidebar}
        onNewChat={handleNewChat}
        isLoading={isLoading}
        conversations={safeConversations}
        currentConversationId={currentConversationId}
        onSelectConversation={selectConversation}
        onDeleteConversation={deleteConversation}
        onTogglePin={togglePin}
        onRenameConversation={renameConversation}
        isLoadingConversations={isLoadingConversations}
      />

      {/* Main Conversation Workspace */}
      <main className="flex flex-1 flex-col overflow-hidden bg-[#212121] transition-all duration-300">
        {/* Top Header */}
        <ChatHeader
          onToggleSidebar={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
          onNewChat={handleNewChat}
          title={currentConversation?.title || "ChatGPT"}
        />

        {/* Dynamic View: Centered prompt for New Chat OR Scrollable Feed when chat started */}
        {!hasMessages ? (
          /* Empty / New Chat State: Centered 'What's on the agenda today?' & Floating Input (Images 1 & 2) */
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 overflow-y-auto">
            <div className="w-full max-w-2xl text-center space-y-6">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                What&apos;s on the agenda today?
              </h1>

              {/* Centered Input Pill */}
              <ChatInput
                input={input}
                isLoading={isLoading}
                onChangeInput={setInput}
                onSubmit={sendMessage}
                isCentered={true}
              />

              {/* Error banner if first submission failed */}
              {errorMessage && (
                <div className="mx-auto max-w-lg rounded-xl border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-200">
                  <p>{errorMessage}</p>
                  <button
                    onClick={dismissError}
                    className="mt-1 text-red-400 underline hover:text-red-300"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Active Chat State: Messages Feed + Floating Bottom Input (Image 3) */
          <div className="flex flex-1 flex-col overflow-hidden">
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
              isCentered={false}
            />
          </div>
        )}
      </main>
    </div>
  );
}
