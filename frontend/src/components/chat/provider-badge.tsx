import React from "react";
import { Sparkles } from "lucide-react";

interface ProviderBadgeProps {
  provider?: "mistral" | "gemini";
}

/**
 * ProviderBadge Component:
 * Displays a badge indicating which LLM provider served the assistant's response.
 * - Primary: Mistral AI (indigo styling)
 * - Fallback: Google Gemini (amber styling)
 */
export function ProviderBadge({ provider }: ProviderBadgeProps) {
  if (!provider) return null;

  const isGemini = provider === "gemini";

  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
          isGemini
            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60"
            : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
        }`}
      >
        <Sparkles className="h-3 w-3" />
        {isGemini ? "Gemini (Fallback)" : "Mistral (Primary)"}
      </span>
    </div>
  );
}
