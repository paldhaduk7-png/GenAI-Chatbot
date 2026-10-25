import React from "react";
import { Sparkles, X, Plus, MessageSquare, ShieldCheck } from "lucide-react";

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  isLoading: boolean;
}

/**
 * ChatSidebar Component:
 * Navigation sidebar containing:
 * - Application branding.
 * - New Chat creation button.
 * - Current session metadata and endpoint status.
 * - Provider fallback notice footer.
 * - Mobile drawer slide-in and backdrop behavior.
 */
export function ChatSidebar({
  isOpen,
  onClose,
  onNewChat,
  isLoading,
}: ChatSidebarProps) {
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
        <div className="space-y-4">
          {/* Brand Header */}
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
                  Phase 1: Connected
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 active:scale-[0.99] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </button>

          {/* Current Session Metadata */}
          <div className="pt-2">
            <div className="flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Current Session</span>
            </div>
            <div className="mt-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50 p-2.5 text-xs text-zinc-600 dark:text-zinc-400">
              Connected live to FastAPI backend at{" "}
              <code className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                /api/chat
              </code>
              .
            </div>
          </div>
        </div>

        {/* Sidebar Status Footer */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Primary: Mistral | Fallback: Gemini</span>
          </div>
        </div>
      </aside>
    </>
  );
}
