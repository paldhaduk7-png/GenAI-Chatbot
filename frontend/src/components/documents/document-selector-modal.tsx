"use client";

import React, { useState } from "react";
import {
  X,
  FileText,
  Check,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  UploadCloud,
  Search,
  ExternalLink,
} from "lucide-react";
import { DocumentItem } from "@/types/document";

interface DocumentSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentItem[];
  isLoading: boolean;
  selectedDocument: DocumentItem | null;
  onSelectDocument: (doc: DocumentItem | null) => void;
  onTriggerUpload: () => void;
  onOpenFullManagement?: () => void;
}

/**
 * DocumentSelectorModal Component:
 * Compact, fast selector modal triggered from the chat input "+" menu.
 * Lets users quickly pick an already indexed document or upload a new one.
 */
export function DocumentSelectorModal({
  isOpen,
  onClose,
  documents,
  isLoading,
  selectedDocument,
  onSelectDocument,
  onTriggerUpload,
  onOpenFullManagement,
}: DocumentSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const filteredDocuments = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleSelect = (doc: DocumentItem) => {
    if (doc.status !== "completed") return;

    if (selectedDocument?.id === doc.id) {
      // Toggle off / deselect
      onSelectDocument(null);
    } else {
      // Select for current chat
      onSelectDocument(doc);
    }
    onClose();
  };

  const renderStatusBadge = (status: DocumentItem["status"]) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Ready
          </span>
        );
      case "processing":
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3 animate-spin" />
            Processing
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400 border border-red-500/20">
            <AlertCircle className="h-3 w-3" />
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-50 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#0c0f18] shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(0,210,255,0.08)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-gradient-to-r from-white/[0.03] to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Select Document
              </h2>
              <p className="text-xs text-zinc-400">
                Choose an uploaded PDF to scope your current chat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Bar (if documents exist) */}
        {documents.length > 3 && (
          <div className="border-b border-white/5 px-5 py-2.5 bg-white/[0.01]">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 pl-8.5 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-cyan-500/50 transition"
              />
            </div>
          </div>
        )}

        {/* Document List / Empty States */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2 max-h-[50vh]">
          {isLoading && documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400 mb-2" />
              <p className="text-xs">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="text-xs font-semibold text-zinc-200">
                No documents uploaded yet
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1 max-w-xs leading-relaxed">
                Upload a PDF document to ask questions and receive answers cited from its content.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTriggerUpload();
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-purple-500 px-3.5 py-1.5 text-xs font-medium text-black hover:opacity-90 shadow-[0_0_15px_rgba(0,210,255,0.3)] transition cursor-pointer"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                <span>Upload PDF</span>
              </button>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No documents matched &quot;{searchQuery}&quot;
            </div>
          ) : (
            filteredDocuments.map((doc) => {
              const isSelected = selectedDocument?.id === doc.id;
              const isCompleted = doc.status === "completed";

              return (
                <div
                  key={doc.id}
                  onClick={() => isCompleted && handleSelect(doc)}
                  className={`group flex items-center justify-between rounded-xl border p-3 transition-all ${
                    isSelected
                      ? "border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_15px_rgba(0,210,255,0.1)] cursor-pointer"
                      : isCompleted
                      ? "border-white/5 bg-white/[0.02] hover:border-cyan-500/30 hover:bg-white/[0.05] cursor-pointer"
                      : "border-white/5 bg-white/[0.01] opacity-60 cursor-not-allowed"
                  }`}
                >
                  {/* File Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        isSelected
                          ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300"
                          : "bg-white/5 border-white/10 text-zinc-400 group-hover:text-cyan-300"
                      }`}
                    >
                      <FileText className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className="truncate text-xs font-medium text-zinc-100 group-hover:text-white"
                          title={doc.filename}
                        >
                          {doc.filename}
                        </p>
                        {renderStatusBadge(doc.status)}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                        {doc.page_count !== undefined && (
                          <span>{doc.page_count} pages</span>
                        )}
                        {doc.chunk_count !== undefined && (
                          <>
                            <span>•</span>
                            <span>{doc.chunk_count} chunks</span>
                          </>
                        )}
                        <span>•</span>
                        <span>
                          {new Date(doc.created_at).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Selection Button */}
                  <div className="shrink-0">
                    {isSelected ? (
                      <span className="flex h-7 items-center gap-1 rounded-lg bg-cyan-400 text-black px-2.5 text-xs font-semibold shadow-[0_0_10px_rgba(0,210,255,0.3)]">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                        <span>Active</span>
                      </span>
                    ) : isCompleted ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(doc);
                        }}
                        className="h-7 rounded-lg border border-cyan-500/30 px-2.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/60 transition cursor-pointer"
                      >
                        Select
                      </button>
                    ) : (
                      <span className="text-[11px] text-zinc-600 italic">
                        Not ready
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 bg-[#080a11] text-xs">
          {onOpenFullManagement ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullManagement();
              }}
              className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-cyan-300 transition cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Manage all documents</span>
            </button>
          ) : (
            <span className="text-zinc-500">
              {documents.length} document{documents.length === 1 ? "" : "s"} total
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onTriggerUpload();
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 hover:border-cyan-500/30 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-xs text-zinc-300 hover:text-white transition cursor-pointer"
            >
              <UploadCloud className="h-3 w-3 text-cyan-400" />
              <span>Upload new</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1 text-xs font-medium text-white transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
