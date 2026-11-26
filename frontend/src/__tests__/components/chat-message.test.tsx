import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatMessage } from "@/components/chat/chat-message";
import { Message } from "@/types/chat";

describe("ChatMessage Component", () => {
  beforeEach(() => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders a user message correctly", () => {
    const msg: Message = {
      id: "m-1",
      role: "user",
      content: "Hello from user!",
    };

    render(<ChatMessage message={msg} />);
    expect(screen.getByText("Hello from user!")).toBeInTheDocument();
  });

  it("renders assistant message with formatted markdown and code blocks", () => {
    const msg: Message = {
      id: "m-2",
      role: "assistant",
      content: "Here is code:\n```python\nprint('hello')\n```\nAnd **bold text** with `inline code`.",
      provider: "mistral",
    };

    render(<ChatMessage message={msg} />);
    expect(screen.getByText("print('hello')")).toBeInTheDocument();
    expect(screen.getByText("bold text")).toBeInTheDocument();
    expect(screen.getByText("inline code")).toBeInTheDocument();
  });

  it("renders CitationSources when sources are present", () => {
    const msg: Message = {
      id: "m-4",
      role: "assistant",
      content: "RAG grounded answer",
      sources: [
        {
          document_id: "doc-1",
          document_filename: "architecture.pdf",
          chunk_id: "c-1",
        },
      ],
    };

    render(<ChatMessage message={msg} />);
    expect(screen.getByText("1 Source")).toBeInTheDocument();
  });

  it("copies message content to clipboard when copy button is clicked", async () => {
    const msg: Message = {
      id: "m-5",
      role: "assistant",
      content: "Copy this content",
    };

    render(<ChatMessage message={msg} />);
    const copyBtn = screen.getByTitle(/Copy message/i);
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Copy this content");
    await waitFor(() => {
      expect(screen.getByTitle(/Copied!/i)).toBeInTheDocument();
    });
  });

  it("toggles thumbs up feedback button", () => {
    const msg: Message = {
      id: "m-6",
      role: "assistant",
      content: "Rate this response",
    };

    render(<ChatMessage message={msg} />);
    const thumbsUp = screen.getByTitle(/Good response/i);
    fireEvent.click(thumbsUp);
    expect(thumbsUp).toHaveClass("text-emerald-400");
  });

  it("renders retry button when onRetry prop is provided", () => {
    const onRetry = vi.fn();
    const msg: Message = {
      id: "m-7",
      role: "assistant",
      content: "Retryable response",
    };

    render(<ChatMessage message={msg} onRetry={onRetry} />);
    const retryBtn = screen.getByTitle(/Regenerate response/i);
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

});
