"use client";
/**
 * LoginForm — client component (ARCHITECTURE.md SS5, TASKS.md T09).
 * Fields: Login ID, Password, Login button.
 * POSTs to /api/login; redirects by category on success.
 * Generic error display — never reveals account existence or lockout.
 */
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

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
    <form onSubmit={handleSubmit} style={styles.form} noValidate>
      <div style={styles.fieldGroup}>
        <label htmlFor="login-id" style={styles.label}>
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
          style={styles.input}
          disabled={loading}
        />
      </div>

      <div style={styles.fieldGroup}>
        <label htmlFor="password" style={styles.label}>
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
          style={styles.input}
          disabled={loading}
        />
      </div>

      {error && (
        <div role="alert" style={styles.errorBox}>
          {error}
        </div>
      )}

      <button
        id="login-submit"
        type="submit"
        disabled={loading}
        style={{
          ...styles.button,
          ...(loading ? styles.buttonLoading : {}),
        }}
      >
        {loading ? "Signing in…" : "Login"}
      </button>
    </form>
  );
}

const styles = {
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.25rem",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.4rem",
  },
  label: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "var(--text-muted)",
    letterSpacing: "0.03em",
    textTransform: "uppercase" as const,
  },
  input: {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    color: "var(--text)",
    fontSize: "0.9375rem",
    outline: "none",
    transition: "border-color 0.15s",
    width: "100%",
  },
  errorBox: {
    background: "rgba(255,92,92,0.1)",
    border: "1px solid rgba(255,92,92,0.3)",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    color: "var(--error)",
    fontSize: "0.875rem",
  },
  button: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "0.875rem",
    fontSize: "0.9375rem",
    fontWeight: 600,
    letterSpacing: "0.01em",
    transition: "background 0.15s, transform 0.1s",
    marginTop: "0.25rem",
  },
  buttonLoading: {
    background: "var(--text-muted)",
    cursor: "not-allowed" as const,
  },
} as const;
