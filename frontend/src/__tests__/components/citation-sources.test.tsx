import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CitationSources } from "@/components/chat/citation-sources";
import { RAGSource } from "@/types/chat";

describe("CitationSources Component", () => {
  it("renders nothing when sources is empty or undefined", () => {
    const { container: c1 } = render(<CitationSources />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<CitationSources sources={[]} />);
    expect(c2.firstChild).toBeNull();
  });

  it("renders collapsed trigger button with correct source count", () => {
    const sources: RAGSource[] = [
      {
        document_id: "doc-1",
        document_filename: "document_alpha.pdf",
        page_number: 1,
        chunk_id: "chunk-1",
        similarity_score: 0.88,
      },
    ];

    render(<CitationSources sources={sources} />);
    expect(screen.getByText("1 Source")).toBeInTheDocument();
    expect(screen.getByText("View")).toBeInTheDocument();
    expect(screen.queryByText("document_alpha.pdf")).not.toBeInTheDocument();
  });

  it("expands on click to display source cards with metadata and percentage score", () => {
    const sources: RAGSource[] = [
      {
        document_id: "doc-1",
        document_filename: "alpha_guide.pdf",
        page_number: 3,
        chunk_id: "chunk-1",
        similarity_score: 0.92,
      },
      {
        document_id: "doc-2",
        document_filename: "beta_report.pdf",
        page_number: null,
        chunk_id: "chunk-2",
        similarity_score: 0.75,
      },
    ];

    render(<CitationSources sources={sources} />);
    const triggerBtn = screen.getByRole("button", { name: /2 Sources/i });
    expect(triggerBtn).toHaveAttribute("aria-expanded", "false");

    // Click to expand
    fireEvent.click(triggerBtn);
    expect(triggerBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Hide")).toBeInTheDocument();

    // Verify filenames and page numbers
    expect(screen.getByText("alpha_guide.pdf")).toBeInTheDocument();
    expect(screen.getByText("beta_report.pdf")).toBeInTheDocument();
    expect(screen.getByText("Page 3")).toBeInTheDocument();

    // Verify similarity percentages
    expect(screen.getByText("92% match")).toBeInTheDocument();
    expect(screen.getByText("75% match")).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(triggerBtn);
    expect(screen.getByText("View")).toBeInTheDocument();
    expect(screen.queryByText("alpha_guide.pdf")).not.toBeInTheDocument();
  });
});
