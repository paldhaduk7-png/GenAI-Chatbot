"use client";

import React, { useState } from "react";
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Message } from "@/types/chat";

interface ChatMessageProps {
  message: Message;
  onRetry?: () => void;
}

/**
 * Renders inline formatting (bold **text** and `code`) safely without external dependencies.
 */
function formatInlineText(text: string) {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return tokens.map((token, i) => {
    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code
          key={i}
          className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-mono text-cyan-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return (
        <strong key={i} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    return token;
  });
}

/**
 * Parses code blocks (```...```) and inline text formatted content.
 */
function renderFormattedContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const codeContent = part.slice(3, -3);
      const firstNewline = codeContent.indexOf("\n");
      let codeText = codeContent;
      let language = "";
      if (firstNewline !== -1) {
        language = codeContent.slice(0, firstNewline).trim();
        codeText = codeContent.slice(firstNewline + 1);
      }

      return (
        <div
          key={index}
          className="my-2.5 rounded-xl border border-white/10 bg-[#0d111c] overflow-hidden"
        >
          {language && (
            <div className="flex items-center justify-between px-3 py-1 bg-white/5 border-b border-white/5 text-[11px] font-mono text-zinc-400">
              <span>{language}</span>
            </div>
          )}
          <pre className="p-3 text-xs font-mono text-cyan-200 overflow-x-auto whitespace-pre">
            <code>{codeText}</code>
          </pre>
        </div>
      );
    }

    return (
      <span key={index} className="whitespace-pre-wrap break-words">
        {formatInlineText(part)}
      </span>
    );
  });
}

/**
 * ChatMessage Component:
 * - User messages: Right-aligned pill with cyber background and crisp typography.
 * - Assistant messages: Left-aligned clean text with code block and markdown formatting.
 * - Action buttons row (Copy, ThumbsUp, ThumbsDown, Regenerate, More).
 * - "Do you like this personality?" feedback banner.
 */
export function ChatMessage({ message, onRetry }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [showPersonalityFeedback, setShowPersonalityFeedback] = useState(!isUser);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end my-2">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl bg-[#141824]/90 border border-white/10 hover:border-cyan-500/25 px-4 py-2.5 text-sm leading-relaxed text-white shadow-[0_4px_20px_rgba(0,0,0,0.35),0_0_12px_rgba(0,210,255,0.04)] transition-all break-words overflow-hidden">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-3 my-3 min-w-0">
      {/* Assistant Message Content */}
      <div className="max-w-3xl text-sm leading-relaxed text-[#ececec] break-words overflow-hidden">
        {renderFormattedContent(message.content)}
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center gap-1 text-zinc-400">
        <button
          onClick={handleCopy}
          className="rounded-md p-1.5 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
          title={copied ? "Copied!" : "Copy message"}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>

        <button
          onClick={() => setLiked(liked === true ? null : true)}
          className={`rounded-md p-1.5 hover:bg-zinc-800 hover:text-white transition cursor-pointer ${
            liked === true ? "text-emerald-400" : ""
          }`}
          title="Good response"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => setLiked(liked === false ? null : false)}
          className={`rounded-md p-1.5 hover:bg-zinc-800 hover:text-white transition cursor-pointer ${
            liked === false ? "text-red-400" : ""
          }`}
          title="Bad response"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>

        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-md p-1.5 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
            title="Regenerate response"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          className="rounded-md p-1.5 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
          title="More"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Personality Feedback Banner */}
      {showPersonalityFeedback && (
        <div className="flex items-center gap-3 w-fit rounded-lg border border-zinc-700/80 bg-[#1e1e1e] px-3.5 py-1.5 text-xs text-zinc-300 shadow-sm mt-1">
          <span>Do you like this personality?</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setLiked(true);
                setShowPersonalityFeedback(false);
              }}
              className="rounded p-1 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
              title="Thumbs up"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setLiked(false);
                setShowPersonalityFeedback(false);
              }}
              className="rounded p-1 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
              title="Thumbs down"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowPersonalityFeedback(false)}
              className="rounded p-1 hover:bg-zinc-700 hover:text-zinc-400 text-zinc-500 transition ml-1 cursor-pointer"
              title="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

