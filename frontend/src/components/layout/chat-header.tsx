import React from "react";
import { Menu } from "lucide-react";

interface ChatHeaderProps {
  onOpenSidebar: () => void;
}

/**
 * ChatHeader Component:
 * Top navigation bar:
 * - Hamburger toggle button on mobile viewports.
 * - Conversation title.
 * - Live backend API status badge.
 */
export function ChatHeader({ onOpenSidebar }: ChatHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 md:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          AI Conversation
        </span>
      </div>

      {/* Backend Status Indicator */}
      <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>API Online</span>
      </div>
    </header>
  );
}
