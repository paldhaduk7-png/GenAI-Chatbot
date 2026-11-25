"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { DocumentItem, DocumentUploadResponse } from "@/types/document";
import { fetchDocuments, uploadDocument, deleteDocument } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function useDocuments() {
  const { isAuthenticated } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Fetches all documents owned by the user.
   */
  const loadDocuments = useCallback(async () => {
    if (!isAuthenticated) {
      setDocuments([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchDocuments();
      if (isMountedRef.current) {
        setDocuments(Array.isArray(data) ? data : []);
      }
    } catch (err: unknown) {
      console.error("Failed to load documents:", err);
      if (isMountedRef.current) {
        setError("Failed to load documents. Please try again.");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  /**
   * Validates and uploads a single PDF document.
   */
  const upload = useCallback(
    async (file: File): Promise<DocumentUploadResponse | null> => {
      // 1. Validate file extension and MIME type
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

      if (!isPdf) {
        const msg = "Only PDF files are supported.";
        toast.error(msg);
        return null;
      }

      // 2. Validate maximum file size (10 MB)
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const msg = "File size exceeds the 10 MB limit.";
        toast.error(msg);
        return null;
      }

      // 3. Guard against concurrent duplicate uploads of same file
      if (isUploading) {
        toast.warning("Another upload is currently in progress. Please wait.");
        return null;
      }

      try {
        setIsUploading(true);
        setError(null);
        toast.loading("Uploading and extracting PDF text...", { id: "doc-upload" });

        const result = await uploadDocument(file);

        toast.success(
          result.message || "Document uploaded and indexed successfully!",
          { id: "doc-upload" }
        );

        // Refresh documents list to reflect updated indexed status
        await loadDocuments();
        return result;
      } catch (err: unknown) {
        console.error("Document upload failed:", err);
        let detail = "Failed to upload and process document.";

        if (axios.isAxiosError(err)) {
          if (err.response?.status === 413) {
            detail = "File exceeds maximum allowed upload size of 10 MB.";
          } else if (err.response?.data?.detail) {
            detail =
              typeof err.response.data.detail === "string"
                ? err.response.data.detail
                : "Failed to process document.";
          }
        }

        toast.error(detail, { id: "doc-upload" });
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsUploading(false);
        }
      }
    },
    [isUploading, loadDocuments]
  );

  /**
   * Deletes a document by ID.
   */
  const remove = useCallback(
    async (documentId: string): Promise<boolean> => {
      try {
        // Optimistic removal from state
        setDocuments((prev) => prev.filter((d) => d.id !== documentId));
        await deleteDocument(documentId);
        toast.success("Document deleted successfully");
        return true;
      } catch (err: unknown) {
        console.error("Failed to delete document:", err);
        toast.error("Failed to delete document. Please try again.");
        // Refresh to restore accurate state
        loadDocuments();
        return false;
      }
    },
    [loadDocuments]
  );

  return {
    documents,
    isLoading,
    isUploading,
    error,
    loadDocuments,
    upload,
    remove,
  };
}
