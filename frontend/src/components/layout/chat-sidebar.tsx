"use client";

import React, { useState } from "react";
import {
  Sparkles,
  X,
  Plus,
  MessageSquare,
  ShieldCheck,
  Pin,
  PinOff,
  Trash2,
  Pencil,
  Check,
  Loader2,
  Database,
} from "lucide-react";
import { Conversation } from "@/types/chat";

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  isLoading: boolean;
  conversations?: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  isLoadingConversations?: boolean;
}

/**
 * ChatSidebar Component:
 * Navigation sidebar containing:
 * - Application branding and Phase status.
 * - New Chat creation button.
 * - Scrollable conversation sessions list with active selection, pin indicators, inline renaming, and deletion.
 * - Provider and PostgreSQL status footer.
 * - Mobile responsive drawer overlay.
 */
export function ChatSidebar({
  isOpen,
  onClose,
  onNewChat,
  isLoading,
  conversations = [],
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onTogglePin,
  onRenameConversation,
  isLoadingConversations = false,
}: ChatSidebarProps) {
  // Inline rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const startRenaming = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const cancelRenaming = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingId(null);
    setEditingTitle("");
  };

  const saveRenaming = (e: React.MouseEvent | React.FormEvent, convId: string) => {
    e.stopPropagation();
    if (e.type === "submit") e.preventDefault();
    const trimmed = editingTitle.trim();
    if (trimmed) {
      onRenameConversation(convId, trimmed);
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const handleDelete = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      "Are you sure you want to delete this conversation and all its messages?"
    );
    if (confirmed) {
      onDeleteConversation(convId);
    }
  };

  const handleTogglePin = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    onTogglePin(convId);
  };

  const safeConversations = Array.isArray(conversations) ? conversations : [];

  // Sort pinned conversations first, then newest updated_at
  const sortedConversations = [...safeConversations].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return timeB - timeA;
  });

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-1 flex-col overflow-hidden space-y-4">
          {/* Brand Header */}
          <div className="flex items-center justify-between pb-2 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-semibold leading-tight tracking-tight">
                  GenAI Chatbot
                </h1>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Phase 2: Persistent
                </span>
              </div>
            </div>

            {/* Mobile close drawer button */}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 md:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={onNewChat}
            disabled={isLoading}
            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 active:scale-[0.99] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </button>

          {/* Conversation List Header */}
          <div className="flex items-center justify-between px-2 pt-2 shrink-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Conversations</span>
            </div>
            {sortedConversations.length > 0 && (
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                {sortedConversations.length}
              </span>
            )}
          </div>

          {/* Scrollable Conversation List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 -mr-1">
            {isLoadingConversations && sortedConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin mb-2 text-indigo-500" />
                <span>Loading conversations...</span>
              </div>
            ) : sortedConversations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-4 text-center">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  No saved conversations yet.
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                  Send a message to create your first session.
                </p>
              </div>
            ) : (
              sortedConversations.map((conv) => {
                const isActive = conv.id === currentConversationId;
                const isEditing = editingId === conv.id;

                return (
                  <div
                    key={conv.id}
                    onClick={() => !isEditing && onSelectConversation(conv.id)}
                    className={`group relative flex items-center justify-between rounded-xl px-3 py-2 text-sm transition cursor-pointer ${
                      isActive
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium shadow-xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    {isEditing ? (
                      /* Inline Renaming Form */
                      <form
                        onSubmit={(e) => saveRenaming(e, conv.id)}
                        className="flex w-full items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") cancelRenaming();
                          }}
                          className="w-full rounded-md border border-indigo-500 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                        />
                        <button
                          type="submit"
                          className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          title="Save title"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRenaming}
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    ) : (
                      /* Conversation Title and Action Buttons */
                      <>
                        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                          {conv.pinned ? (
                            <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500 fill-amber-500" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
                          )}
                          <span className="truncate text-xs leading-normal">
                            {conv.title}
                          </span>
                        </div>

                        {/* Action Buttons (Visible on hover or active) */}
                        <div
                          className={`flex items-center gap-1 shrink-0 ${
                            isActive
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          } transition-opacity duration-150`}
                        >
                          {/* Pin / Unpin Button */}
                          <button
                            onClick={(e) => handleTogglePin(e, conv.id)}
                            className="rounded p-1 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                            title={conv.pinned ? "Unpin chat" : "Pin chat"}
                          >
                            {conv.pinned ? (
                              <PinOff className="h-3.5 w-3.5" />
                            ) : (
                              <Pin className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Rename Button */}
                          <button
                            onClick={(e) => startRenaming(e, conv)}
                            className="rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                            title="Rename chat"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={(e) => handleDelete(e, conv.id)}
                            className="rounded p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                            title="Delete chat"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sidebar Status Footer */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-1.5 shrink-0">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Database className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span>Neon PostgreSQL Active</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>Mistral + Gemini Fallback</span>
          </div>
        </div>
      </aside>
    </>
  );
}
