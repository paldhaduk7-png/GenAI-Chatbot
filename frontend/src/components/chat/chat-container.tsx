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
    <div className="relative flex h-screen w-full overflow-hidden bg-[#07080d] text-[#ececec] font-sans">
      {/* Cyber Neon Atmospheric Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[550px] w-[550px] rounded-full bg-cyan-500/10 blur-[140px] opacity-80" />
      <div className="pointer-events-none absolute -bottom-40 right-10 h-[600px] w-[600px] rounded-full bg-purple-600/10 blur-[150px] opacity-75" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[650px] rounded-full bg-blue-500/5 blur-[160px]" />
      
      {/* Subtle Cyber Grid */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />

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
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden bg-transparent transition-all duration-300">
        {/* Top Header */}
        <ChatHeader
          onToggleSidebar={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
          onNewChat={handleNewChat}
          title={currentConversation?.title || "PD"}
        />

        {/* Dynamic View: Centered prompt for New Chat OR Scrollable Feed when chat started */}
        {!hasMessages ? (
          /* Empty / New Chat State: Centered 'What's on the agenda today?' & Floating Input (Images 1 & 2) */
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 overflow-y-auto">
            <div className="w-full max-w-2xl text-center space-y-6">
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-purple-200 bg-clip-text text-transparent drop-shadow-[0_2px_15px_rgba(0,210,255,0.15)]">
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
