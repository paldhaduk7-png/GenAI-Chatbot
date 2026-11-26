import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDocuments } from "@/hooks/use-documents";
import * as api from "@/lib/api";
import { toast } from "sonner";
import { DocumentItem } from "@/types/document";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
  }),
}));

describe("useDocuments Hook", () => {
  const mockDocuments: DocumentItem[] = [
    {
      id: "doc-1",
      filename: "test1.pdf",
      file_path: "/path/1",
      status: "completed",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, "fetchDocuments").mockResolvedValue(mockDocuments);
  });

  it("fetches documents on mount when authenticated", async () => {
    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(api.fetchDocuments).toHaveBeenCalledTimes(1);
      expect(result.current.documents).toEqual(mockDocuments);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("rejects non-PDF files with an error message", async () => {
    const spyUpload = vi.spyOn(api, "uploadDocument");
    const { result } = renderHook(() => useDocuments());

    const txtFile = new File(["hello world"], "notes.txt", { type: "text/plain" });

    let uploadRes: any;
    await act(async () => {
      uploadRes = await result.current.upload(txtFile);
    });

    expect(uploadRes).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Only PDF files are supported.");
    expect(spyUpload).not.toHaveBeenCalled();
  });

  it("rejects files exceeding 10 MB limit", async () => {
    const spyUpload = vi.spyOn(api, "uploadDocument");
    const { result } = renderHook(() => useDocuments());

    // Create file > 10 MB (10 * 1024 * 1024 + 1 bytes)
    const largeContent = new Uint8Array(10 * 1024 * 1024 + 100);
    const largeFile = new File([largeContent], "huge.pdf", { type: "application/pdf" });

    let uploadRes: any;
    await act(async () => {
      uploadRes = await result.current.upload(largeFile);
    });

    expect(uploadRes).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("File size exceeds the 10 MB limit.");
    expect(spyUpload).not.toHaveBeenCalled();
  });

  it("successfully uploads a valid PDF and reloads documents", async () => {
    const newDoc: DocumentItem = {
      id: "doc-new",
      filename: "sample.pdf",
      file_path: "/path/new",
      status: "completed",
      created_at: "2026-01-02",
      updated_at: "2026-01-02",
    };

    vi.spyOn(api, "uploadDocument").mockResolvedValueOnce({
      document_id: "doc-new",
      filename: "sample.pdf",
      status: "completed",
      page_count: 1,
      pages_with_text: 1,
      message: "Uploaded and indexed",
    });

    const { result } = renderHook(() => useDocuments());
    const validFile = new File(["%PDF-1.4 dummy"], "sample.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.upload(validFile);
    });

    expect(api.uploadDocument).toHaveBeenCalledWith(validFile);
    expect(toast.success).toHaveBeenCalledWith("Uploaded and indexed", { id: "doc-upload" });
    // Reloads documents
    expect(api.fetchDocuments).toHaveBeenCalledTimes(2);
  });

  it("deletes a document and updates local state", async () => {
    vi.spyOn(api, "deleteDocument").mockResolvedValueOnce({
      document_id: "doc-1",
      message: "Deleted",
    });

    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.documents.length).toBe(1));

    await act(async () => {
      await result.current.remove("doc-1");
    });

    expect(api.deleteDocument).toHaveBeenCalledWith("doc-1");
    expect(toast.success).toHaveBeenCalledWith("Document deleted successfully");
  });
});
