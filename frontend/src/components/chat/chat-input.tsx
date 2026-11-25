"use client";

import React, { useRef, useEffect } from "react";
import { Plus, ArrowUp, Loader2, FileText, X } from "lucide-react";
import { DocumentItem } from "@/types/document";

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  onChangeInput: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  isCentered?: boolean;
  selectedDocument?: DocumentItem | null;
  onDeselectDocument?: () => void;
  onOpenDocumentModal?: () => void;
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
  selectedDocument = null,
  onDeselectDocument,
  onOpenDocumentModal,
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
      className={`w-full shrink-0 transition-all duration-300 z-10 ${
        isCentered
          ? "max-w-2xl mx-auto px-4"
          : "max-w-3xl mx-auto px-4 pb-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#07080d] via-[#07080d]/80 to-transparent"
      }`}
    >
      {/* Active Document Scope Pill */}
      {selectedDocument && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-cyan-500/30 bg-[#0e1320]/90 backdrop-blur-md px-3 py-1.5 shadow-[0_0_15px_rgba(0,210,255,0.08)] animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <FileText className="h-3 w-3" />
            </span>
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="truncate text-xs font-medium text-cyan-200"
                title={selectedDocument.filename}
              >
                {selectedDocument.filename}
              </span>
              {selectedDocument.page_count !== undefined && (
                <span className="shrink-0 rounded bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.5 text-[10px] text-cyan-300">
                  {selectedDocument.page_count} pages
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onDeselectDocument}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
            title="Deselect document (return to normal chat)"
            aria-label="Deselect document"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (hasContent && !isLoading) onSubmit();
        }}
        className="relative flex items-center gap-2 rounded-full border border-white/10 bg-[#10131d]/85 backdrop-blur-2xl px-3 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.6),0_0_20px_rgba(0,210,255,0.06)] transition-all duration-200 hover:border-cyan-500/30 focus-within:border-cyan-400/60 focus-within:shadow-[0_10px_40px_rgba(0,0,0,0.6),0_0_25px_rgba(0,210,255,0.18)]"
      >
        {/* Plus / Attachment Button */}
        <button
          type="button"
          onClick={onOpenDocumentModal}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
          title="Documents / attach PDF"
          aria-label="Open documents knowledge base"
        >
          <Plus className="h-5 w-5 text-cyan-400" />
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
                ? "bg-gradient-to-r from-cyan-400 to-purple-500 text-black hover:opacity-90 shadow-[0_0_14px_rgba(0,210,255,0.4)] cursor-pointer"
                : "bg-white/10 text-zinc-500 cursor-not-allowed"
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

