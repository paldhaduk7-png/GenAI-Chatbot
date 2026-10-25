"use client";

import React from "react";
import { ChevronDown, Share2, MoreHorizontal, PanelLeft, SquarePen } from "lucide-react";

interface ChatHeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onNewChat?: () => void;
  title?: string;
}

/**
 * ChatHeader Component:
 * Matches ChatGPT Classic top navigation:
 * - Sidebar toggle button (collapses/expands sidebar for full-screen view).
 * - "New chat" button when sidebar is collapsed.
 * - "ChatGPT" dropdown / title.
 * - "Share" pill button and options menu on the right.
 */
export function ChatHeader({
  onToggleSidebar,
  isSidebarOpen,
  onNewChat,
  title = "ChatGPT",
}: ChatHeaderProps) {
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      alert("Conversation link copied to clipboard!");
    }
  };

  return (
    <header className="flex h-12 items-center justify-between bg-[#212121] px-3 sm:px-4 text-[#ececec] shrink-0 border-b border-[#2d2d2d]/60">
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Sidebar Toggle Button (Click to collapse into full page or open sidebar) */}
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition shrink-0"
          title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        {/* Quick New Chat Button when sidebar is closed */}
        {!isSidebarOpen && onNewChat && (
          <button
            onClick={onNewChat}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition shrink-0"
            title="New chat"
            aria-label="New chat"
          >
            <SquarePen className="h-4 w-4" />
          </button>
        )}

        {/* ChatGPT Title / Model Dropdown */}
        <button className="flex items-center gap-1 text-sm font-semibold text-zinc-200 hover:text-white transition ml-1">
          <span className="truncate max-w-[200px] sm:max-w-[400px]">
            {title && title !== "AI Conversation" ? title : "ChatGPT"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        </button>
      </div>

      {/* Right Actions: Share & Options */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-transparent px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>Share</span>
        </button>

        <button
          className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          title="More options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

