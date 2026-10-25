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
 * ChatMessage Component:
 * - User messages: Right-aligned pill with dark background (#2f2f2f) and crisp typography.
 * - Assistant messages: Left-aligned clean text with emoji support.
 * - Action buttons row (Copy, ThumbsUp, ThumbsDown, Regenerate, More).
 * - "Do you like this personality?" feedback banner (matching Image 3).
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
      <div className="flex justify-end my-3">
        <div className="max-w-[80%] sm:max-w-[70%] rounded-2xl bg-[#141824]/90 border border-white/10 hover:border-cyan-500/25 px-4 py-2.5 text-sm leading-relaxed text-white shadow-[0_4px_20px_rgba(0,0,0,0.35),0_0_12px_rgba(0,210,255,0.04)] transition-all">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-3 my-4">
      {/* Assistant Message Content */}
      <div className="max-w-3xl text-sm leading-relaxed text-[#ececec]">
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center gap-1 text-zinc-400">
        <button
          onClick={handleCopy}
          className="rounded-md p-1.5 hover:bg-zinc-800 hover:text-white transition"
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
          className={`rounded-md p-1.5 hover:bg-zinc-800 hover:text-white transition ${
            liked === true ? "text-emerald-400" : ""
          }`}
          title="Good response"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => setLiked(liked === false ? null : false)}
          className={`rounded-md p-1.5 hover:bg-zinc-800 hover:text-white transition ${
            liked === false ? "text-red-400" : ""
          }`}
          title="Bad response"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>

        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-md p-1.5 hover:bg-zinc-800 hover:text-white transition"
            title="Regenerate response"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          className="rounded-md p-1.5 hover:bg-zinc-800 hover:text-white transition"
          title="More"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Personality Feedback Banner (as shown in Image 3) */}
      {showPersonalityFeedback && (
        <div className="flex items-center gap-3 w-fit rounded-lg border border-zinc-700/80 bg-[#1e1e1e] px-3.5 py-1.5 text-xs text-zinc-300 shadow-sm mt-1">
          <span>Do you like this personality?</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setLiked(true);
                setShowPersonalityFeedback(false);
              }}
              className="rounded p-1 hover:bg-zinc-700 hover:text-white transition"
              title="Thumbs up"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setLiked(false);
                setShowPersonalityFeedback(false);
              }}
              className="rounded p-1 hover:bg-zinc-700 hover:text-white transition"
              title="Thumbs down"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowPersonalityFeedback(false)}
              className="rounded p-1 hover:bg-zinc-700 hover:text-zinc-400 text-zinc-500 transition ml-1"
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

