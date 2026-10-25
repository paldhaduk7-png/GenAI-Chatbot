"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

  // Redirect authenticated users away to dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, router]);

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      await login({
        email: email.trim(),
        password,
      });

      toast.success("Welcome back! Redirecting...");
      router.push("/");
    } catch (err: unknown) {
      console.error("Login submission error:", err);
      let message = "Invalid email or password. Please try again.";

      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        const detail = err.response.data.detail;
        message = Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg || "Validation error").join(", ")
          : String(detail);
      } else if (err instanceof Error) {
        message = err.message;
      }

      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prevent flash while checking auth status
  if (authLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07080d]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#07080d] px-4 py-12 text-[#ececec] overflow-hidden">
      {/* Cyber Ambient Glowing Orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-600/10 blur-[128px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.03] blur-[150px]" />

      <div className="relative w-full max-w-md">
        {/* Main Glass Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f1a]/80 p-8 shadow-[0_0_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          {/* Brand Header */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-[#0d1326] p-2.5 shadow-[0_0_25px_rgba(0,229,255,0.15)]">
              <Image
                src="/icon.png"
                alt="PD Logo"
                width={36}
                height={36}
                className="h-9 w-9 object-contain drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Sign In to <span className="text-cyan-400">PD AI</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Enter your credentials to access your conversations
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-300"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  disabled={isSubmitting}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formErrors.email) {
                      setFormErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  placeholder="name@example.com"
                  className={`w-full rounded-xl border bg-[#111627]/90 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 transition-all focus:outline-none ${
                    formErrors.email
                      ? "border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border-white/[0.08] hover:border-white/20 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  }`}
                />
              </div>
              {formErrors.email && (
                <p className="text-xs text-red-400">{formErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-300"
              >
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formErrors.password) {
                      setFormErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border bg-[#111627]/90 py-2.5 pl-10 pr-11 text-sm text-zinc-100 placeholder-zinc-500 transition-all focus:outline-none ${
                    formErrors.password
                      ? "border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border-white/[0.08] hover:border-white/20 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {formErrors.password && (
                <p className="text-xs text-red-400">{formErrors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-2.5 px-4 text-sm font-semibold text-white shadow-[0_0_20px_rgba(0,229,255,0.25)] transition-all hover:from-cyan-400 hover:to-blue-500 hover:shadow-[0_0_28px_rgba(0,229,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 border-t border-white/[0.06] pt-6 text-center text-sm text-zinc-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-cyan-400 hover:text-cyan-300 transition underline-offset-4 hover:underline"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
