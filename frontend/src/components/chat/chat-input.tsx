"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  Plus,
  ArrowUp,
  Loader2,
  FileText,
  X,
  UploadCloud,
  Layers,
} from "lucide-react";
import { DocumentItem } from "@/types/document";

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  onChangeInput: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  isCentered?: boolean;
  selectedDocument?: DocumentItem | null;
  onDeselectDocument?: () => void;
  onOpenDocumentSelector?: () => void;
  onUploadFile?: (file: File) => Promise<void>;
  isUploadingDoc?: boolean;
  documentCount?: number;
}

/**
 * ChatInput Component:
 * Pill-shaped input bar matching ChatGPT Classic:
 * - Left: '+' action button opening popover menu (Upload PDF / Select uploaded document)
 * - Center: 'Ask anything' auto-expanding textarea
 * - Top: Active document attachment card or upload progress indicator
 * - Right: Send action button
 */
export function ChatInput({
  input,
  isLoading,
  onChangeInput,
  onSubmit,
  isCentered = false,
  selectedDocument = null,
  onDeselectDocument,
  onOpenDocumentSelector,
  onUploadFile,
  isUploadingDoc = false,
  documentCount = 0,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  // Handle outside click & Escape key to close popover menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onUploadFile) {
      await onUploadFile(files[0]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
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
      {/* 1. Upload in progress indicator */}
      {isUploadingDoc && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-[#0e1320]/95 backdrop-blur-md px-3 py-2 text-xs text-cyan-200 animate-pulse shadow-[0_0_15px_rgba(0,210,255,0.08)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400 shrink-0" />
          <span>Uploading PDF & indexing vector embeddings...</span>
        </div>
      )}

      {/* 2. Active Document Attachment Chip/Card */}
      {selectedDocument && !isUploadingDoc && (
        <div className="mb-2.5 inline-flex max-w-full items-center justify-between gap-3 rounded-xl border border-cyan-500/35 bg-[#0e1320]/95 backdrop-blur-md px-3 py-1.5 shadow-[0_0_20px_rgba(0,210,255,0.12)] animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <FileText className="h-3.5 w-3.5" />
            </span>
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="truncate text-xs font-semibold text-cyan-100 max-w-[200px] sm:max-w-xs"
                title={selectedDocument.filename}
              >
                {selectedDocument.filename}
              </span>
              {selectedDocument.page_count !== undefined && (
                <span className="shrink-0 rounded bg-cyan-950/80 border border-cyan-800/50 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300">
                  {selectedDocument.page_count} pgs
                </span>
              )}
              <span className="hidden sm:inline-block text-[10px] text-cyan-400 font-medium">
                • RAG Active
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onDeselectDocument}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
            title="Remove document scope"
            aria-label="Remove document scope"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 3. Main Input Pill Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (hasContent && !isLoading) onSubmit();
        }}
        className="relative flex items-center gap-2 rounded-full border border-white/10 bg-[#10131d]/85 backdrop-blur-2xl px-3 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.6),0_0_20px_rgba(0,210,255,0.06)] transition-all duration-200 hover:border-cyan-500/30 focus-within:border-cyan-400/60 focus-within:shadow-[0_10px_40px_rgba(0,0,0,0.6),0_0_25px_rgba(0,210,255,0.18)]"
      >
        {/* Hidden File Input for Direct PDF Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* '+' Button & Popover Trigger */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition cursor-pointer ${
              isMenuOpen
                ? "bg-cyan-500/20 text-cyan-300 ring-2 ring-cyan-400/50"
                : "text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
            title="Attach or select document"
            aria-label="Document options"
          >
            <Plus
              className={`h-5 w-5 text-cyan-400 transition-transform duration-200 ${
                isMenuOpen ? "rotate-45" : ""
              }`}
            />
          </button>

          {/* '+' Popover Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute bottom-full left-0 mb-3 z-50 flex w-60 flex-col rounded-xl border border-white/10 bg-[#0e121e]/95 backdrop-blur-2xl p-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(0,210,255,0.1)] animate-in fade-in slide-in-from-bottom-2 duration-150">
              {/* Option 1: Upload PDF */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition hover:bg-cyan-500/10 hover:text-white text-zinc-200 cursor-pointer group"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 group-hover:scale-105 transition-transform">
                  <UploadCloud className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-white">Upload PDF</span>
                  <span className="text-[10px] text-zinc-400 truncate">
                    Max 10 MB • Auto-attaches
                  </span>
                </div>
              </button>

              {/* Divider */}
              <div className="my-1 h-[1px] bg-white/5" />

              {/* Option 2: Select uploaded document */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenDocumentSelector?.();
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition hover:bg-purple-500/10 hover:text-white text-zinc-200 cursor-pointer group"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 group-hover:scale-105 transition-transform">
                  <Layers className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-semibold text-white">
                    Select uploaded document
                  </span>
                  <span className="text-[10px] text-zinc-400 truncate">
                    {documentCount > 0
                      ? `${documentCount} document${documentCount === 1 ? "" : "s"} available`
                      : "Choose from knowledge base"}
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onChangeInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={1}
          placeholder={
            selectedDocument
              ? `Ask about ${selectedDocument.filename}...`
              : "Ask anything"
          }
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
