import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "@/components/chat/chat-input";

describe("ChatInput Component", () => {
  it("renders textarea with placeholder and buttons", () => {
    const onChangeInput = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ChatInput
        input=""
        isLoading={false}
        onChangeInput={onChangeInput}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i);
    expect(textarea).toBeInTheDocument();
    expect(textarea).not.toBeDisabled();

    // Send button exists
    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeInTheDocument();
  });

  it("calls onChangeInput when typing in textarea", async () => {
    const user = userEvent.setup();
    const onChangeInput = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ChatInput
        input="Hello"
        isLoading={false}
        onChangeInput={onChangeInput}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i);
    await user.type(textarea, " world");
    expect(onChangeInput).toHaveBeenCalled();
  });

  it("submits on Enter key when input is not empty and not loading", () => {
    const onChangeInput = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ChatInput
        input="Hello AI"
        isLoading={false}
        onChangeInput={onChangeInput}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does NOT submit on Shift+Enter (allows newline)", () => {
    const onChangeInput = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ChatInput
        input="Hello AI"
        isLoading={false}
        onChangeInput={onChangeInput}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does NOT submit when input is only whitespace", () => {
    const onChangeInput = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ChatInput
        input="   "
        isLoading={false}
        onChangeInput={onChangeInput}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables send button when input is empty or loading", () => {
    const { rerender } = render(
      <ChatInput
        input=""
        isLoading={false}
        onChangeInput={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const sendBtn = screen.getByRole("button", { name: /send/i });
    expect(sendBtn).toBeDisabled();

    // Rerender with loading
    rerender(
      <ChatInput
        input="Some message"
        isLoading={true}
        onChangeInput={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("renders selected document pill and calls onDeselectDocument when 'X' is clicked", () => {
    const onDeselect = vi.fn();
    const doc = {
      id: "doc-1",
      filename: "financial_report.pdf",
      file_path: "/path",
      status: "completed" as const,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };

    render(
      <ChatInput
        input=""
        isLoading={false}
        onChangeInput={vi.fn()}
        onSubmit={vi.fn()}
        selectedDocument={doc}
        onDeselectDocument={onDeselect}
      />
    );

    expect(screen.getByText("financial_report.pdf")).toBeInTheDocument();
    const deselectBtn = screen.getByLabelText(/Remove document scope/i);
    fireEvent.click(deselectBtn);
    expect(onDeselect).toHaveBeenCalledTimes(1);
  });
});
