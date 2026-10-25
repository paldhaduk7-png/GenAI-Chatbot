"use client";

import React from "react";
import { ChevronDown, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ChatHeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onNewChat?: () => void;
  title?: string;
}

/**
 * ChatHeader Component:
 * - When sidebar is closed (!isSidebarOpen): Shows "PD" with down arrow (ChevronDown) to open sidebar.
 * - When sidebar is open (isSidebarOpen): "PD" is only shown inside the sidebar (with ChevronRight).
 * - "Share" pill button on the right.
 */
export function ChatHeader({
  onToggleSidebar,
  isSidebarOpen,
  title = "PD",
}: ChatHeaderProps) {
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Conversation link copied to clipboard!");
    } else {
      toast.error("Clipboard access not available.");
    }
  };

  const hasCustomTitle = Boolean(
    title && title !== "PD" && title !== "AI Conversation"
  );

  return (
    <header className="flex h-12 items-center justify-between bg-[#07080d]/75 backdrop-blur-xl px-3 sm:px-4 text-[#ececec] shrink-0 border-b border-white/[0.06] z-20">
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Only show PD button in header when sidebar is closed */}
        {!isSidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
            title="Open sidebar"
            aria-label="Open sidebar"
          >
            <span className="truncate max-w-[200px] sm:max-w-[400px]">
              {hasCustomTitle ? title : "PD"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          </button>
        )}

        {/* When sidebar is open and there is an active conversation title, show the title text only */}
        {isSidebarOpen && hasCustomTitle && (
          <span className="truncate max-w-[200px] sm:max-w-[400px] text-sm font-semibold text-zinc-200 px-2 py-1">
            {title}
          </span>
        )}
      </div>

      {/* Right Actions: Share */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:border-cyan-500/40 hover:text-white transition cursor-pointer shadow-[0_0_12px_rgba(0,210,255,0.06)]"
          title="Share conversation"
        >
          <Share2 className="h-3.5 w-3.5 text-cyan-400" />
          <span>Share</span>
        </button>
      </div>
    </header>
  );
}

