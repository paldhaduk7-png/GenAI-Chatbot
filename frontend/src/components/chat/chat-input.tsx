import React from "react";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  onChangeInput: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
}

/**
 * ChatInput Component:
 * Bottom multiline text input form:
 * - Enter key triggers message submission.
 * - Shift + Enter inserts a newline.
 * - Prevents submission while input is empty or request is in flight.
 */
export function ChatInput({
  input,
  isLoading,
  onChangeInput,
  onSubmit,
}: ChatInputProps) {
  /**
   * Keyboard Handler:
   * Sends the message on Enter without Shift.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="mx-auto max-w-3xl">
        <form
          onSubmit={onSubmit}
          className={`relative flex items-end gap-2 rounded-2xl border p-2 shadow-xs transition ${
            isLoading
              ? "border-zinc-200 bg-zinc-100/70 dark:border-zinc-800 dark:bg-zinc-900/50 opacity-80"
              : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500"
          }`}
        >
          {/* Controlled Textarea */}
          <textarea
            value={input}
            onChange={(e) => onChangeInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={
              isLoading
                ? "Waiting for response..."
                : "Send a message... (Press Enter to send, Shift+Enter for newline)"
            }
            rows={1}
            className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden disabled:cursor-not-allowed"
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95 shadow-xs"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>

        <p className="mt-2 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          Shift + Enter for new lines &bull; Auto-fallback active
        </p>
      </div>
    </div>
  );
}
