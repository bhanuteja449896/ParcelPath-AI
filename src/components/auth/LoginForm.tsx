"use client";
/**
 * LoginForm — client component (ARCHITECTURE.md SS5, TASKS.md T09).
 * Fields: Login ID, Password, Login button.
 * POSTs to /api/login; redirects by category on success.
 * Generic error display — never reveals account existence or lockout.
 */
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loginIdRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const loginId = loginIdRef.current?.value ?? "";
    const password = passwordRef.current?.value ?? "";

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
        credentials: "same-origin",
      });

      const data = (await res.json()) as { redirect?: string; error?: string };

      if (res.ok && data.redirect) {
        router.push(data.redirect);
        router.refresh();
      } else {
        setError(data.error ?? "Login failed. Please try again.");
        // Clear password field on error (security)
        if (passwordRef.current) passwordRef.current.value = "";
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-id" className="text-[12.5px] font-medium text-ink-2">
          Login ID
        </label>
        <input
          id="login-id"
          ref={loginIdRef}
          type="text"
          autoComplete="username"
          autoFocus
          required
          maxLength={200}
          placeholder="e.g. northstar_admin"
          disabled={loading}
          className="h-11 w-full rounded-xl border border-line bg-surface-inset px-3.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-brand/50 focus:bg-surface disabled:opacity-60"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[12.5px] font-medium text-ink-2">
          Password
        </label>
        <input
          id="password"
          ref={passwordRef}
          type="password"
          autoComplete="current-password"
          required
          maxLength={1000}
          placeholder="••••••••"
          disabled={loading}
          className="h-11 w-full rounded-xl border border-line bg-surface-inset px-3.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-brand/50 focus:bg-surface disabled:opacity-60"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger"
        >
          <Icon.Alert size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
