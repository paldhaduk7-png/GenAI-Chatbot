import React from "react";
import { Bot, User } from "lucide-react";
import { Message } from "@/types/chat";
import { ProviderBadge } from "./provider-badge";

interface ChatMessageProps {
  message: Message;
}

/**
 * ChatMessage Component:
 * Renders an individual message in the chat conversation.
 * - Aligns user messages to the right with indigo background.
 * - Aligns assistant messages to the left with neutral border card and provider badge.
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-start gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar (User or Assistant Bot) */}
      <div
        className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold shadow-xs ${
          isUser
            ? "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "bg-indigo-600 text-white"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message Card */}
      <div
        className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
          isUser
            ? "bg-indigo-600 text-white rounded-tr-xs"
            : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 rounded-tl-xs"
        }`}
      >
        {/* Provider badge shown for assistant messages */}
        {!isUser && <ProviderBadge provider={message.provider} />}

        {/* Message text */}
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
