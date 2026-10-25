"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  Pin,
  PinOff,
  Trash2,
  Pencil,
  Check,
  Loader2,
  Search,
  PanelLeftClose,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Conversation } from "@/types/chat";
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { LogoutDialog } from "@/components/ui/logout-dialog";

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
  // Deletion dialog state (replaces window.confirm with shadcn-style modal)
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  // Search filter with debouncing (300ms)
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const isDebouncing = searchQuery !== debouncedSearchQuery && searchQuery.trim() !== "";

  // Authentication & Logout state
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const getInitials = (name?: string | null, email?: string): string => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email && email.trim()) {
      return email.slice(0, 2).toUpperCase();
    }
    return "AI";
  };

  const handleConfirmLogout = () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      logout();
      toast.success("Signed out successfully.");
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
      setShowLogoutDialog(false);
    }
  };

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
    setConversationToDelete(convId);
  };

  const confirmDelete = () => {
    if (conversationToDelete) {
      onDeleteConversation(conversationToDelete);
      setConversationToDelete(null);
    }
  };

  const handleTogglePin = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    onTogglePin(convId);
  };

  const safeConversations = Array.isArray(conversations) ? conversations : [];

  // Filter based on debounced search query if active
  const activeQuery = debouncedSearchQuery.trim().toLowerCase();
  const filteredConversations = activeQuery
    ? safeConversations.filter((c) =>
        c.title.toLowerCase().includes(activeQuery)
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
            ? "bg-gradient-to-r from-cyan-500/20 via-purple-500/10 to-transparent border-l-2 border-cyan-400 text-white font-medium shadow-[0_0_12px_rgba(0,210,255,0.08)]"
            : "text-zinc-300 hover:bg-white/5 hover:text-white"
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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between bg-[#090b12]/95 backdrop-blur-2xl text-[#ececec] transition-all duration-300 ease-in-out md:static shrink-0 h-full min-h-0 select-none ${
          isOpen
            ? "w-64 p-3 border-r border-white/[0.06] translate-x-0 opacity-100"
            : "w-0 p-0 border-r-0 -translate-x-full md:translate-x-0 md:w-0 opacity-0 overflow-hidden pointer-events-none"
        }`}
      >
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden space-y-3 min-w-[232px]">
          {/* Top Brand & Controls Header */}
          <div className="flex items-center justify-between px-1 pt-1 shrink-0">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-white hover:bg-white/10 transition cursor-pointer"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <span>PD</span>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsSearching((prev) => {
                    if (prev) setSearchQuery("");
                    return !prev;
                  });
                }}
                className={`rounded-lg p-1.5 transition ${
                  isSearching
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
                title="Search chats"
                aria-label="Search chats"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white transition"
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
                className="w-full rounded-lg bg-[#10131d]/90 border border-white/10 px-3 py-1.5 pr-8 text-xs text-white placeholder-zinc-500 outline-none focus:border-cyan-500/50 transition"
              />
              <div className="absolute right-3 top-2 flex items-center gap-1">
                {isDebouncing && (
                  <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                )}
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-zinc-400 hover:text-white transition"
                    title="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* New Chat Button */}
          <button
            onClick={onNewChat}
            disabled={isLoading}
            className="flex w-full shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-transparent border border-cyan-500/20 hover:border-cyan-500/40 hover:from-cyan-500/20 px-3 py-2 text-xs font-medium text-white transition shadow-[0_0_15px_rgba(0,210,255,0.06)] active:scale-[0.99] disabled:opacity-50"
          >
            <Plus className="h-4 w-4 text-cyan-400" />
            <span>New chat</span>
          </button>

          {/* Scrollable Conversation Lists */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 -mr-1">
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
        <div className="border-t border-white/[0.06] pt-2 mt-2 shrink-0">
          <div className="flex items-center justify-between rounded-xl p-1.5 hover:bg-white/[0.04] transition group">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* User Avatar with Initials Fallback */}
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-purple-600/30 border border-cyan-500/30 text-[11px] font-semibold text-cyan-300 shrink-0 shadow-[0_0_10px_rgba(0,229,255,0.15)]">
                {getInitials(user?.full_name, user?.email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-zinc-100">
                  {user?.full_name || "Authenticated User"}
                </p>
                <p className="truncate text-[10px] text-zinc-400">
                  {user?.email || "user@example.com"}
                </p>
              </div>
            </div>

            {/* Logout Action Button */}
            <button
              onClick={() => setShowLogoutDialog(true)}
              disabled={isLoggingOut}
              className="rounded-lg p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer shrink-0"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Confirmation Dialog for Deleting Conversations */}
      <DeleteDialog
        isOpen={Boolean(conversationToDelete)}
        onClose={() => setConversationToDelete(null)}
        onConfirm={confirmDelete}
      />

      {/* Confirmation Dialog for Signing Out */}
      <LogoutDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={handleConfirmLogout}
        isLoggingOut={isLoggingOut}
      />
    </>
  );
}

