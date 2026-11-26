import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { TypingIndicator } from "@/components/chat/typing-indicator";

describe("TypingIndicator Component", () => {
  it("renders thinking animation text", () => {
    render(<TypingIndicator />);
    expect(screen.getByText(/Thinking \(Querying AI provider\)\.\.\./i)).toBeInTheDocument();
  });
});
