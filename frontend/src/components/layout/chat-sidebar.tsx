"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  MessageSquare,
  Pin,
  PinOff,
  Trash2,
  Pencil,
  Check,
  Loader2,
  Search,
  PanelLeftClose,
  ChevronDown,
  BookOpen,
  Folder,
  Clock,
  Puzzle,
  Terminal,
  MoreHorizontal,
  Database,
  ShieldCheck,
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
 * ChatSidebar Component (ChatGPT Classic layout):
 * - Top header with "ChatGPT" brand, search toggle, and collapse sidebar trigger.
 * - "New chat" action button.
 * - Navigation menu (Library, Projects, Scheduled, Plugins, Codex).
 * - "Pinned" section at top (strictly max 7 pinned conversations).
 * - "Recents" section below (only unpinned conversations, pinned do not appear here).
 * - User profile pill at bottom ("pal dhaduk - Go").
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
  // Search filter
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  const saveRenaming = (
    e: React.MouseEvent | React.FormEvent,
    convId: string
  ) => {
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

  // Filter based on search query if active
  const filteredConversations = searchQuery.trim()
    ? safeConversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : safeConversations;

  // Separate Pinned conversations (sorted by updated_at, max 7)
  const pinnedConversations = filteredConversations
    .filter((c) => c.pinned)
    .sort((a, b) => {
      const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return timeB - timeA;
    });

  // Separate Recent conversations (unpinned only!)
  const recentConversations = filteredConversations
    .filter((c) => !c.pinned)
    .sort((a, b) => {
      const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return timeB - timeA;
    });

  // Render a single conversation item
  const renderConversationItem = (conv: Conversation, isPinnedSection: boolean) => {
    const isActive = conv.id === currentConversationId;
    const isEditing = editingId === conv.id;

    return (
      <div
        key={conv.id}
        onClick={() => !isEditing && onSelectConversation(conv.id)}
        className={`group relative flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition cursor-pointer ${
          isActive
            ? "bg-[#212121] text-white font-medium"
            : "text-zinc-300 hover:bg-[#212121]/60 hover:text-white"
        }`}
      >
        {isEditing ? (
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
              className="w-full rounded bg-[#171717] border border-zinc-600 px-2 py-1 text-xs text-white outline-none"
            />
            <button
              type="submit"
              className="rounded p-1 text-emerald-400 hover:bg-zinc-800"
              title="Save title"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={cancelRenaming}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <>
            <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-1">
              <span className="shrink-0 text-zinc-400 group-hover:text-zinc-200">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-message-circle"
                >
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                </svg>
              </span>
              <span className="truncate leading-tight">{conv.title}</span>
            </div>

            {/* Hover Actions */}
            <div
              className={`flex items-center gap-0.5 shrink-0 ${
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              } transition-opacity duration-150`}
            >
              {/* Pin / Unpin Button */}
              <button
                onClick={(e) => handleTogglePin(e, conv.id)}
                className="rounded p-1 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
                title={isPinnedSection ? "Unpin chat" : "Pin chat (max 7)"}
              >
                {isPinnedSection ? (
                  <PinOff className="h-3.5 w-3.5" />
                ) : (
                  <Pin className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Rename Button */}
              <button
                onClick={(e) => startRenaming(e, conv)}
                className="rounded p-1 text-zinc-400 hover:text-white hover:bg-zinc-800"
                title="Rename chat"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>

              {/* Delete Button */}
              <button
                onClick={(e) => handleDelete(e, conv.id)}
                className="rounded p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                title="Delete chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between bg-[#171717] border-r border-[#262626] text-[#ececec] p-3 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-1 flex-col overflow-hidden space-y-3">
          {/* Top Brand & Controls Header */}
          <div className="flex items-center justify-between px-1 pt-1 shrink-0">
            <button
              onClick={onNewChat}
              className="flex items-center gap-1 text-sm font-semibold text-white hover:opacity-80 transition"
            >
              <span>ChatGPT</span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsSearching((prev) => !prev)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#212121] hover:text-white transition"
                title="Search chats"
                aria-label="Search chats"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#212121] hover:text-white transition"
                title="Close sidebar"
                aria-label="Close sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Search bar when toggled */}
          {isSearching && (
            <div className="relative px-1 shrink-0">
              <input
                type="text"
                autoFocus
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-[#212121] border border-zinc-700 px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2 text-zinc-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* New Chat Button */}
          <button
            onClick={onNewChat}
            disabled={isLoading}
            className="flex w-full shrink-0 items-center gap-2 rounded-lg bg-[#212121] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2a2a2a] active:scale-[0.99] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>New chat</span>
          </button>

          {/* Quick Menu Shortcuts */}
          <div className="space-y-0.5 shrink-0 px-1 border-b border-[#262626] pb-2 text-xs text-zinc-300">
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#212121] cursor-pointer transition">
              <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
              <span>Library</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#212121] cursor-pointer transition">
              <Folder className="h-3.5 w-3.5 text-zinc-400" />
              <span>Projects</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#212121] cursor-pointer transition">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              <span>Scheduled</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#212121] cursor-pointer transition">
              <Puzzle className="h-3.5 w-3.5 text-zinc-400" />
              <span>Plugins</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#212121] cursor-pointer transition">
              <Terminal className="h-3.5 w-3.5 text-zinc-400" />
              <span>Codex</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#212121] cursor-pointer transition">
              <MoreHorizontal className="h-3.5 w-3.5 text-zinc-400" />
              <span>More</span>
            </div>
          </div>

          {/* Scrollable Conversation Lists */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
            {isLoadingConversations && safeConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin mb-2 text-zinc-400" />
                <span>Loading chats...</span>
              </div>
            ) : safeConversations.length === 0 ? (
              <div className="px-2 py-4 text-center">
                <p className="text-xs text-zinc-500">No chats yet.</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Start a new conversation
                </p>
              </div>
            ) : (
              <>
                {/* 1. PINNED SECTION (Upper Side, Max 7) */}
                {pinnedConversations.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between px-2 text-[11px] font-medium text-zinc-500">
                      <span>Pinned</span>
                      <span className="text-[10px] text-zinc-600">
                        {pinnedConversations.length}/7
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {pinnedConversations.map((conv) =>
                        renderConversationItem(conv, true)
                      )}
                    </div>
                  </div>
                )}

                {/* 2. RECENTS SECTION (Lower Side, Unpinned Only) */}
                <div className="space-y-1">
                  <div className="px-2 text-[11px] font-medium text-zinc-500">
                    <span>Recents</span>
                  </div>
                  {recentConversations.length === 0 ? (
                    <div className="px-2 py-2 text-[11px] text-zinc-600">
                      No recent chats
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {recentConversations.map((conv) =>
                        renderConversationItem(conv, false)
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* User Profile Footer */}
        <div className="border-t border-[#262626] pt-2 mt-2 shrink-0">
          <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[#212121] cursor-pointer transition">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-[11px] font-medium text-white shrink-0">
                PD
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-zinc-200">
                  pal dhaduk
                </p>
                <p className="text-[10px] text-zinc-500">Go</p>
              </div>
            </div>
            <MoreHorizontal className="h-4 w-4 text-zinc-500 shrink-0" />
          </div>

          {/* Database & Failover Status */}
          <div className="flex items-center justify-between px-2 pt-2 text-[10px] text-zinc-500">
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3 text-indigo-400" />
              <span>Neon PostgreSQL</span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              <span>Mistral &bull; Gemini</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

