"use client";

import React, { useEffect } from "react";
import { LogOut, Loader2 } from "lucide-react";

interface LogoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoggingOut?: boolean;
}

/**
 * Shadcn-style Cyberpunk Alert Dialog for signing out.
 */
export function LogoutDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoggingOut = false,
}: LogoutDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoggingOut) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isLoggingOut]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={() => !isLoggingOut && onClose()}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative z-50 w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0f1a]/95 p-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-all"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
            <LogOut className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h2 className="text-sm font-semibold text-white">
              Sign out of PD AI?
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to end your current session? You will need to sign in again to access your conversations.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(239,68,68,0.35)] transition disabled:opacity-50 cursor-pointer"
          >
            {isLoggingOut ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Signing out...</span>
              </>
            ) : (
              <span>Sign out</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
