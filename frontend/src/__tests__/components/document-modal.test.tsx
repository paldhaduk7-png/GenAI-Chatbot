import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DocumentModal } from "@/components/documents/document-modal";
import { DocumentItem } from "@/types/document";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "u-1", email: "user@example.com" },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe("DocumentModal Component", () => {
  const sampleDocs: DocumentItem[] = [
    {
      id: "doc-1",
      filename: "handbook.pdf",
      file_path: "/path/1",
      status: "completed",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
    {
      id: "doc-2",
      filename: "processing_guide.pdf",
      file_path: "/path/2",
      status: "processing",
      created_at: "2026-01-02",
      updated_at: "2026-01-02",
    },
  ];

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <DocumentModal
        isOpen={false}
        onClose={vi.fn()}
        selectedDocument={null}
        onSelectDocument={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders upload area and document list when open", () => {
    const mockHook: any = {
      documents: sampleDocs,
      isLoading: false,
      isUploading: false,
      upload: vi.fn(),
      remove: vi.fn(),
    };

    render(
      <DocumentModal
        isOpen={true}
        onClose={vi.fn()}
        selectedDocument={null}
        onSelectDocument={vi.fn()}
        documentsHook={mockHook}
      />
    );

    expect(screen.getByText("Document Knowledge Base")).toBeInTheDocument();
    expect(screen.getByText(/Drag & drop a PDF here/i)).toBeInTheDocument();
    expect(screen.getByText("handbook.pdf")).toBeInTheDocument();
    expect(screen.getByText("processing_guide.pdf")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Processing")).toBeInTheDocument();
  });

  it("calls onSelectDocument when Select button for completed document is clicked", () => {
    const onSelect = vi.fn();
    const mockHook: any = {
      documents: sampleDocs,
      isLoading: false,
      isUploading: false,
      upload: vi.fn(),
      remove: vi.fn(),
    };

    render(
      <DocumentModal
        isOpen={true}
        onClose={vi.fn()}
        selectedDocument={null}
        onSelectDocument={onSelect}
        documentsHook={mockHook}
      />
    );

    const selectBtns = screen.getAllByRole("button", { name: "Select" });
    fireEvent.click(selectBtns[0]);
    expect(onSelect).toHaveBeenCalledWith(sampleDocs[0]);
  });

  it("disables select button when document status is still processing", () => {
    const onSelect = vi.fn();
    const mockHook: any = {
      documents: sampleDocs,
      isLoading: false,
      isUploading: false,
      upload: vi.fn(),
      remove: vi.fn(),
    };

    render(
      <DocumentModal
        isOpen={true}
        onClose={vi.fn()}
        selectedDocument={null}
        onSelectDocument={onSelect}
        documentsHook={mockHook}
      />
    );

    const disabledBtn = screen.getByTitle("Only completed documents can be selected");
    expect(disabledBtn).toBeDisabled();
    fireEvent.click(disabledBtn);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
