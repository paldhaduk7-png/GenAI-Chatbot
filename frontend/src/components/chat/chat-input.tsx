"use client";

import React, { useRef, useEffect } from "react";
import { Plus, ArrowUp, Loader2 } from "lucide-react";

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  onChangeInput: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  isCentered?: boolean;
}

/**
 * ChatInput Component:
 * Pill-shaped input bar matching ChatGPT Classic:
 * - Left: '+' action button
 * - Center: 'Ask anything' expanding textarea
 * - Right: 'Think' pill toggle, mic icon, blue voice/send action button
 * - Bottom disclaimer: 'ChatGPT can make mistakes. Check important info.'
 */
export function ChatInput({
  input,
  isLoading,
  onChangeInput,
  onSubmit,
  isCentered = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  const hasContent = Boolean(input.trim());

  return (
    <div
      className={`w-full px-4 transition-all duration-300 ${
        isCentered
          ? "max-w-2xl mx-auto"
          : "max-w-3xl mx-auto pb-4 pt-2"
      }`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (hasContent && !isLoading) onSubmit();
        }}
        className="relative flex items-center gap-2 rounded-full border border-zinc-700/60 bg-[#2f2f2f] px-3 py-2 shadow-lg transition hover:border-zinc-600 focus-within:border-zinc-500"
      >
        {/* Plus / Attachment Button */}
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-300 hover:bg-zinc-700/60 hover:text-white transition"
          title="Attach or add tools"
        >
          <Plus className="h-5 w-5" />
        </button>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onChangeInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={1}
          placeholder="Ask anything"
          className="max-h-36 min-h-[28px] flex-1 resize-none bg-transparent py-1 text-sm text-white placeholder-zinc-400 outline-none focus:outline-none"
        />

        {/* Right Tools: Send button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="submit"
            disabled={!hasContent || isLoading}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition active:scale-95 ${
              hasContent
                ? "bg-white text-black hover:bg-zinc-200 cursor-pointer"
                : "bg-zinc-700/60 text-zinc-500 cursor-not-allowed"
            }`}
            aria-label="Send prompt"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            ) : (
              <ArrowUp className="h-4 w-4 stroke-[2.5]" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

