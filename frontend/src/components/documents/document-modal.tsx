"use client";

import React, { useState, useRef } from "react";
import {
  X,
  UploadCloud,
  FileText,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import { DocumentItem } from "@/types/document";
import { useDocuments } from "@/hooks/use-documents";
import { DeleteDialog } from "@/components/ui/delete-dialog";

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDocument: DocumentItem | null;
  onSelectDocument: (doc: DocumentItem | null) => void;
  documentsHook?: ReturnType<typeof useDocuments>;
}

export function DocumentModal({
  isOpen,
  onClose,
  selectedDocument,
  onSelectDocument,
  documentsHook,
}: DocumentModalProps) {
  // Use passed-in hook if provided to avoid duplicate fetching, or instantiate local
  const internalHook = useDocuments();
  const {
    documents,
    isLoading,
    isUploading,
    upload,
    remove,
  } = documentsHook || internalHook;

  const [isDragOver, setIsDragOver] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await upload(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await upload(files[0]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (docToDelete) {
      const deletedId = docToDelete.id;
      // If the currently selected document is deleted, deselect it
      if (selectedDocument?.id === deletedId) {
        onSelectDocument(null);
      }
      await remove(deletedId);
      setDocToDelete(null);
    }
  };

  const handleToggleSelect = (doc: DocumentItem) => {
    if (doc.status !== "completed") return;

    if (selectedDocument?.id === doc.id) {
      // Deselect
      onSelectDocument(null);
    } else {
      // Select
      onSelectDocument(doc);
    }
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
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal Window */}
        <div className="relative z-50 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-white/10 bg-[#0c0f18] shadow-[0_15px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(0,210,255,0.08)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-gradient-to-r from-white/[0.03] to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">
                  Document Knowledge Base
                </h2>
                <p className="text-xs text-zinc-400">
                  Upload PDF documents and select one to scope your conversation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
              title="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all cursor-pointer ${
                isDragOver
                  ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_20px_rgba(0,210,255,0.2)]"
                  : isUploading
                  ? "border-white/10 bg-white/[0.02] cursor-not-allowed opacity-60"
                  : "border-white/15 bg-white/[0.02] hover:border-cyan-500/40 hover:bg-white/[0.04]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />

              {isUploading ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                  <p className="text-xs font-medium text-cyan-200">
                    Extracting text and generating vector embeddings...
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    This may take a few moments
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-200">
                      Drag & drop a PDF here, or{" "}
                      <span className="text-cyan-400 underline underline-offset-2">
                        browse file
                      </span>
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      PDF files only • Maximum size: 10 MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Document List Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Your Uploaded Documents ({documents.length})
                </h3>
                {selectedDocument && (
                  <span className="text-[11px] text-cyan-400 font-medium">
                    1 Active Document Selected
                  </span>
                )}
              </div>

              {isLoading && documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-zinc-500">
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-400 mb-2" />
                  <p className="text-xs">Loading documents...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/[0.01] p-8 text-center">
                  <FileText className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
                  <p className="text-xs text-zinc-400 font-medium">
                    No documents uploaded yet
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Upload a PDF above to enable document question answering.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-[#101420]/80 overflow-hidden">
                  {documents.map((doc) => {
                    const isSelected = selectedDocument?.id === doc.id;
                    const isCompleted = doc.status === "completed";

                    return (
                      <div
                        key={doc.id}
                        className={`group flex items-center justify-between p-3.5 transition-all ${
                          isSelected
                            ? "bg-cyan-500/10 border-l-2 border-cyan-400"
                            : "hover:bg-white/[0.03]"
                        }`}
                      >
                        {/* File Details */}
                        <div className="flex items-start gap-3 min-w-0 flex-1 pr-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                              isSelected
                                ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300"
                                : "bg-white/5 border-white/10 text-zinc-400"
                            }`}
                          >
                            <FileText className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p
                                className="truncate text-xs font-medium text-zinc-100"
                                title={doc.filename}
                              >
                                {doc.filename}
                              </p>
                              {renderStatusBadge(doc.status)}
                            </div>

                            <div className="flex items-center gap-2.5 text-[11px] text-zinc-500 mt-1">
                              <span>
                                {new Date(doc.created_at).toLocaleDateString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  }
                                )}
                              </span>
                              {doc.page_count !== undefined && (
                                <>
                                  <span>•</span>
                                  <span>{doc.page_count} pages</span>
                                </>
                              )}
                              {doc.chunk_count !== undefined && (
                                <>
                                  <span>•</span>
                                  <span>{doc.chunk_count} chunks</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions: Select/Deselect & Delete */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Selection Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(doc)}
                            disabled={!isCompleted}
                            title={
                              !isCompleted
                                ? "Only completed documents can be selected"
                                : isSelected
                                ? "Deselect document"
                                : "Select for active chat scope"
                            }
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                              isSelected
                                ? "bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,210,255,0.4)] hover:bg-cyan-400"
                                : isCompleted
                                ? "border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/60"
                                : "border border-white/5 text-zinc-600 cursor-not-allowed bg-white/[0.02]"
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check className="h-3 w-3 stroke-[3]" />
                                <span>Active</span>
                              </>
                            ) : (
                              <span>Select</span>
                            )}
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setDocToDelete(doc)}
                            className="rounded-lg p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                            title="Delete document"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/10 px-6 py-3 bg-[#080a11] text-xs text-zinc-400">
            <div>
              {selectedDocument ? (
                <span className="text-cyan-300">
                  Active Document: <strong>{selectedDocument.filename}</strong>
                </span>
              ) : (
                <span>No document currently active (Normal Chat)</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        isOpen={Boolean(docToDelete)}
        onClose={() => setDocToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
