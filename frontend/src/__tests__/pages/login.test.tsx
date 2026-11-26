import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/login/page";
import { toast } from "sonner";

const mockLogin = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    login: mockLogin,
    isAuthenticated: false,
    isLoading: false,
  }),
}));

describe("LoginPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email, password inputs and submit button", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
  });

  it("validates required fields on empty submit", async () => {
    render(<LoginPage />);
    const submitBtn = screen.getByRole("button", { name: /Sign In/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(await screen.findByText("Password is required.")).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("validates invalid email format", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/^Password/i);
    const submitBtn = screen.getByRole("button", { name: /Sign In/i });

    await user.type(emailInput, "invalid-email");
    await user.type(passwordInput, "SecurePass1");
    fireEvent.click(submitBtn);

    expect(await screen.findByText("Please enter a valid email address.")).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("submits valid credentials, calls login, and redirects", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce({ access_token: "token-abc" });

    render(<LoginPage />);
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/^Password/i);
    const submitBtn = screen.getByRole("button", { name: /Sign In/i });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "ValidPass1");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "ValidPass1",
      });
      expect(toast.success).toHaveBeenCalledWith("Welcome back! Redirecting...");
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("displays error message on failed login (HTTP 401)", async () => {
    const user = userEvent.setup();
    const error: any = new Error("Invalid credentials");
    error.isAxiosError = true;
    error.response = {
      status: 401,
      data: { detail: "Incorrect email or password." },
    };
    mockLogin.mockRejectedValueOnce(error);

    render(<LoginPage />);
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/^Password/i);
    const submitBtn = screen.getByRole("button", { name: /Sign In/i });

    await user.type(emailInput, "wrong@example.com");
    await user.type(passwordInput, "WrongPass1");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Incorrect email or password.");
    });
  });

  it("displays friendly rate limit message on HTTP 429", async () => {
    const user = userEvent.setup();
    const rateLimitError: any = new Error("Rate limit exceeded");
    rateLimitError.isAxiosError = true;
    rateLimitError.response = {
      status: 429,
      data: { detail: "Rate limit exceeded: 10 per 1 minute. Please try again later." },
    };
    mockLogin.mockRejectedValueOnce(rateLimitError);

    render(<LoginPage />);
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/^Password/i);
    const submitBtn = screen.getByRole("button", { name: /Sign In/i });

    await user.type(emailInput, "rate@example.com");
    await user.type(passwordInput, "AnyPass1");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Rate limit exceeded: 10 per 1 minute. Please try again later."
      );
    });
  });
});
