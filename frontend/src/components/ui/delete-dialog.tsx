"use client";

import React, { useEffect } from "react";
import { Trash2 } from "lucide-react";

interface DeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

/**
 * Shadcn-UI style Alert Dialog / Popover modal for deleting conversations.
 * Replaces native browser window.confirm with a dark-glass cyberpunk popup.
 */
export function DeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete conversation?",
  description = "Are you sure you want to delete this conversation and all its messages? This action cannot be undone.",
}: DeleteDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Shadcn-style Modal Card */}
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative z-50 w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0f17]/95 p-5 shadow-2xl backdrop-blur-xl transition-all"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.2)]">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h2 className="text-sm font-semibold text-white">
              {title}
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Footer Actions: Cancel & Delete */}
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 hover:bg-red-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(239,68,68,0.35)] transition cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
