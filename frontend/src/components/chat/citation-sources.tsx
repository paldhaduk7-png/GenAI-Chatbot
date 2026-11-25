"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Sparkles } from "lucide-react";
import { RAGSource } from "@/types/chat";

interface CitationSourcesProps {
  sources?: RAGSource[];
}

/**
 * Formats backend similarity score (cosine similarity between 0.0 and 1.0) into a percentage display.
 */
function formatSimilarityScore(score?: number | null): string | null {
  if (score === undefined || score === null || isNaN(score)) {
    return null;
  }
  // If score is normalized between 0.0 and 1.0, convert to percentage
  let pct = score <= 1.0 ? score * 100 : score;
  pct = Math.max(0, Math.min(100, pct));
  return `${Math.round(pct)}% match`;
}

/**
 * CitationSources Component:
 * Displays an expandable/collapsible source attribution section below assistant messages.
 * Consistent with the Cyber Neon theme.
 */
export function CitationSources({ sources }: CitationSourcesProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) {
    return null;
  }

  const count = sources.length;

  return (
    <div className="w-full max-w-3xl pt-1 pb-1">
      {/* Collapsible Trigger Button */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-controls="citation-sources-list"
        className="group inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#101420]/80 px-2.5 py-1 text-xs text-zinc-300 hover:border-cyan-500/40 hover:bg-cyan-500/5 hover:text-white transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
      >
        <FileText className="h-3.5 w-3.5 text-cyan-400 group-hover:scale-105 transition-transform" />
        <span className="font-medium">
          {count === 1 ? "1 Source" : `${count} Sources`}
        </span>
        <span className="text-[11px] text-zinc-500">•</span>
        <span className="text-[11px] text-zinc-400">
          {isExpanded ? "Hide" : "View"}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-zinc-400 group-hover:text-cyan-300 transition-colors" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400 group-hover:text-cyan-300 transition-colors" />
        )}
      </button>

      {/* Expanded Sources Grid */}
      {isExpanded && (
        <div
          id="citation-sources-list"
          className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-200"
        >
          {sources.map((source, index) => {
            const similarity = formatSimilarityScore(source.similarity_score);
            const filename = source.document_filename || "Document Source";

            return (
              <div
                key={source.chunk_id || `source-${index}`}
                className="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-[#0d101b]/90 p-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.3)] hover:border-cyan-500/35 hover:bg-[#111624] transition-all min-w-0"
              >
                {/* Header: Source Index and Filename */}
                <div className="flex items-start gap-2 min-w-0">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono font-semibold">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-xs font-medium text-zinc-200 group-hover:text-cyan-200 transition-colors"
                      title={filename}
                    >
                      {filename}
                    </p>
                  </div>
                </div>

                {/* Footer Metadata: Page Number & Similarity Score */}
                <div className="mt-2 flex items-center justify-between gap-1.5 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {source.page_number !== null && source.page_number !== undefined ? (
                      <span className="rounded bg-white/5 border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300">
                        Page {source.page_number}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500">Document chunk</span>
                    )}
                  </div>

                  {similarity && (
                    <span
                      className="inline-flex items-center gap-1 rounded bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300 shrink-0"
                      title="Cosine semantic relevance score"
                    >
                      <Sparkles className="h-2.5 w-2.5 text-cyan-400" />
                      {similarity}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
