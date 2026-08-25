/**
 * Unauthorized page — 403 (ARCHITECTURE.md SS9, TASKS.md T09).
 * Shown when a customer tries to access /internal or any restricted route.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Access Denied — ParcelPilot",
};

export default function UnauthorizedPage() {
  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.icon}>🔒</div>
        <h1 style={styles.title}>Access Denied</h1>
        <p style={styles.body}>
          You do not have permission to view this page.
          <br />
          If you believe this is an error, please contact support.
        </p>
        <Link href="/login" style={styles.link}>
          ← Return to Login
        </Link>
      </div>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    background: "var(--bg)",
  } as React.CSSProperties,
  card: {
    textAlign: "center" as const,
    maxWidth: "400px",
  } as React.CSSProperties,
  icon: {
    fontSize: "3rem",
    marginBottom: "1rem",
  } as React.CSSProperties,
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: "0.75rem",
  } as React.CSSProperties,
  body: {
    color: "var(--text-muted)",
    lineHeight: 1.6,
    marginBottom: "1.5rem",
  } as React.CSSProperties,
  link: {
    color: "var(--accent)",
    fontSize: "0.9375rem",
    fontWeight: 500,
  } as React.CSSProperties,
} as const;
