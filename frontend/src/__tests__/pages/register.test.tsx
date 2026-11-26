import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterPage from "@/app/register/page";
import { toast } from "sonner";

const mockRegister = vi.fn();
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
    register: mockRegister,
    isAuthenticated: false,
    isLoading: false,
  }),
}));

describe("RegisterPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all form inputs and submit button", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Account/i })).toBeInTheDocument();
  });

  it("validates required fields on empty submit", async () => {
    render(<RegisterPage />);
    const submitBtn = screen.getByRole("button", { name: /Create Account/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText("Full name is required.")).toBeInTheDocument();
    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(await screen.findByText("Password is required.")).toBeInTheDocument();
    expect(await screen.findByText("Confirm password is required.")).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("validates password minimum length (8 characters)", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/Full Name/i), "Alice Test");
    await user.type(screen.getByLabelText(/Email Address/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^Password/i), "Pass1");
    await user.type(screen.getByLabelText(/Confirm Password/i), "Pass1");

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    expect(
      await screen.findByText("Password must be at least 8 characters long.")
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("validates password requires at least one letter and at least one number", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/Full Name/i), "Bob Test");
    await user.type(screen.getByLabelText(/Email Address/i), "bob@example.com");

    // Letters only (no digit)
    await user.type(screen.getByLabelText(/^Password/i), "LettersOnlyPassword");
    await user.type(screen.getByLabelText(/Confirm Password/i), "LettersOnlyPassword");
    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    expect(
      await screen.findByText(
        "Password must contain at least one letter and at least one number."
      )
    ).toBeInTheDocument();

    // Digits only (no letter)
    await user.clear(screen.getByLabelText(/^Password/i));
    await user.clear(screen.getByLabelText(/Confirm Password/i));
    await user.type(screen.getByLabelText(/^Password/i), "1234567890");
    await user.type(screen.getByLabelText(/Confirm Password/i), "1234567890");
    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    expect(
      await screen.findByText(
        "Password must contain at least one letter and at least one number."
      )
    ).toBeInTheDocument();
  });

  it("validates password confirmation mismatch", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/Full Name/i), "Charlie Test");
    await user.type(screen.getByLabelText(/Email Address/i), "charlie@example.com");
    await user.type(screen.getByLabelText(/^Password/i), "SecurePassword1");
    await user.type(screen.getByLabelText(/Confirm Password/i), "DifferentPassword1");

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("submits valid registration, calls register, and redirects to /login", async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValueOnce({ id: "u-123" });

    render(<RegisterPage />);
    await user.type(screen.getByLabelText(/Full Name/i), "Valid User");
    await user.type(screen.getByLabelText(/Email Address/i), "valid@example.com");
    await user.type(screen.getByLabelText(/^Password/i), "SecurePassword1");
    await user.type(screen.getByLabelText(/Confirm Password/i), "SecurePassword1");

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        full_name: "Valid User",
        email: "valid@example.com",
        password: "SecurePassword1",
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Account created successfully! Please sign in with your credentials."
      );
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("handles 409 Conflict when email is already registered", async () => {
    const user = userEvent.setup();
    const conflictError: any = new Error("Conflict");
    conflictError.isAxiosError = true;
    conflictError.response = { status: 409 };
    mockRegister.mockRejectedValueOnce(conflictError);

    render(<RegisterPage />);
    await user.type(screen.getByLabelText(/Full Name/i), "Duplicate User");
    await user.type(screen.getByLabelText(/Email Address/i), "exists@example.com");
    await user.type(screen.getByLabelText(/^Password/i), "SecurePassword1");
    await user.type(screen.getByLabelText(/Confirm Password/i), "SecurePassword1");

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    expect(
      await screen.findByText("This email is already registered.")
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      "An account with this email address already exists."
    );
  });
});
