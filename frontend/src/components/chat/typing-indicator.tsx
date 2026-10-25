import React from "react";
import { Bot, Loader2 } from "lucide-react";

/**
 * TypingIndicator Component:
 * Displays an animated loading bubble while the backend and AI providers process the prompt.
 */
export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      {/* Bot Avatar */}
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-indigo-600 text-white shadow-xs">
        <Bot className="h-4 w-4" />
      </div>

      {/* Loading message card */}
      <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 shadow-xs">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
        <span>Thinking (Querying AI provider)...</span>
      </div>
    </div>
  );
}
