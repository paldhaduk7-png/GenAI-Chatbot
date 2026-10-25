"use client";

import React, { useRef, useEffect } from "react";
import { Plus, Mic, AudioLines, ArrowUp, Brain, Loader2 } from "lucide-react";

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

        {/* Right Tools: Think pill, Mic, Audio/Send button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Think Button */}
          <button
            type="button"
            className="hidden sm:flex items-center gap-1.5 rounded-full bg-zinc-700/50 hover:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition"
            title="Reasoning mode"
          >
            <Brain className="h-3.5 w-3.5 text-zinc-300" />
            <span>Think</span>
          </button>

          {/* Microphone Button */}
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-700/60 hover:text-white transition"
            title="Voice input"
          >
            <Mic className="h-4 w-4" />
          </button>

          {/* Action / Send Button */}
          {hasContent ? (
            <button
              type="submit"
              disabled={isLoading}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 transition active:scale-95 disabled:opacity-50"
              aria-label="Send prompt"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4 stroke-[2.5]" />
              )}
            </button>
          ) : (
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 transition active:scale-95"
              title="Voice mode"
            >
              <AudioLines className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {/* Centered Disclaimer */}
      <p className="mt-2 text-center text-[11px] text-zinc-500">
        ChatGPT can make mistakes. Check important info.
      </p>
    </div>
  );
}

