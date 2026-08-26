/**
 * Login page (ARCHITECTURE.md SS5, SS25, TASKS.md T09).
 * Server component — redirects to home if already authenticated.
 */
import { redirect } from "next/navigation";
import postgres from "postgres";
import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getSessionTokenFromCookieStore, resolveSession } from "@/lib/auth/session";
import LoginForm from "@/components/auth/LoginForm";
import { Logo } from "@/components/navigation/UserMenu";

export const metadata: Metadata = {
  title: "Sign in — ParcelPilot",
  description: "Sign in to ParcelPilot AI Support",
};

export default async function LoginPage() {
  // Already authenticated? Redirect away
  const token = await getSessionTokenFromCookieStore();
  if (token) {
    const sql = postgres(config.databaseUrl, { prepare: false, max: 1 });
    let ctx;
    try {
      ctx = await resolveSession(sql as unknown as Parameters<typeof resolveSession>[0], token);
    } finally {
      await sql.end({ timeout: 5 });
    }
    if (ctx) {
      redirect(ctx.category === "support" ? "/internal" : "/");
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-sm animate-message-in">
        {/* Brand */}
        <div className="mb-7 flex flex-col items-center gap-3">
          <Logo />
          <p className="-mt-1.5 text-[13px] text-ink-3">AI Support System</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-pop sm:p-8">
          <h1 className="text-[17px] font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            Access your ParcelPilot support workspace.
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>

        <p className="mt-5 text-center text-[12px] leading-relaxed text-ink-3">
          Customers see only their own account data.
          <br />
          Staff access is scoped by role and fully audit-logged.
        </p>

        <div className="mt-6 flex flex-col gap-2 rounded-xl border border-line bg-surface-inset p-4 text-[12.5px] text-ink-2 shadow-sm">
          <p className="font-semibold text-ink">Demo Credentials</p>
          <div className="flex justify-between border-b border-line pb-1.5">
            <span><strong>Customer:</strong> northstar_admin</span>
            <span className="font-mono">Demo1234!</span>
          </div>
          <div className="flex justify-between pt-0.5">
            <span><strong>Support:</strong> support01</span>
            <span className="font-mono">Demo1234!</span>
          </div>
        </div>
      </div>
    </main>
  );
}
