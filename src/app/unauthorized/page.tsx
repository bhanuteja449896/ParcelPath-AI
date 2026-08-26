/**
 * Unauthorized page — 403 (ARCHITECTURE.md SS9, TASKS.md T09).
 * Shown when a customer tries to access /internal or any restricted route.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { Logo } from "@/components/navigation/UserMenu";

export const metadata: Metadata = {
  title: "Access denied — ParcelPilot",
};

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-8 text-center">
      <div className="animate-message-in flex max-w-sm flex-col items-center">
        <Logo />
        <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
          <Icon.Shield size={24} />
        </div>
        <h1 className="mt-5 text-[19px] font-semibold tracking-tight text-ink">
          You don&apos;t have permission to view this page
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">
          This area is restricted to authorized ParcelPilot staff. If you believe this is a
          mistake, contact your account manager.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[13.5px] font-medium text-ink shadow-card transition-colors hover:bg-surface-2"
        >
          <Icon.ArrowLeft size={14} />
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
