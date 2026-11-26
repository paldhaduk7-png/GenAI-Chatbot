import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ProviderBadge } from "@/components/chat/provider-badge";

describe("ProviderBadge Component", () => {
  it("renders null when provider is undefined", () => {
    const { container } = render(<ProviderBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders primary badge for mistral", () => {
    render(<ProviderBadge provider="mistral" />);
    expect(screen.getByText(/Mistral \(Primary\)/i)).toBeInTheDocument();
  });

  it("renders fallback badge for gemini", () => {
    render(<ProviderBadge provider="gemini" />);
    expect(screen.getByText(/Gemini \(Fallback\)/i)).toBeInTheDocument();
  });
});
