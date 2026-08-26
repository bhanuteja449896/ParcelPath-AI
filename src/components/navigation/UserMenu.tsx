"use client";
/**
 * Brand + identity components: Logo, ThemeToggle, UserMenu.
 * Logout posts to the real /api/logout endpoint and follows its redirect.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-on-brand shadow-card">
        <Icon.Logo size={17} />
      </span>
      {!compact && (
        <span className="text-[16px] font-semibold tracking-tight text-ink">
          ParcelPilot
        </span>
      )}
    </span>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  // Read the pre-paint theme (set by the head script in layout.tsx) lazily;
  // suppressHydrationWarning covers the SSR/client mismatch for the icon.
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light"
  );

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("pp-theme", next);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={theme === "dark"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title="Toggle theme"
      suppressHydrationWarning
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink ${className ?? ""}`}
    >
      {theme === "dark" ? <Icon.Sun size={16} /> : <Icon.Moon size={16} />}
    </button>
  );
}

export interface IdentityProps {
  /** Human label, e.g. login id or account name */
  name: string;
  role: string;
  category: "customer" | "support";
  /** e.g. "Northstar Logistics" for customers; undefined for staff */
  accountName?: string | null;
}

export function UserMenu({ name, role, category, accountName }: IdentityProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = name.slice(0, 2).toUpperCase();
  const isCustomer = category === "customer";

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex max-w-[46vw] items-center gap-2.5 rounded-xl border border-transparent py-1 pl-1 pr-2 transition-colors hover:border-line hover:bg-surface sm:max-w-none"
      >
        <span className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink">
          {initials}
        </span>
        <span className="hidden min-w-0 text-left leading-tight md:block">
          <span className="block truncate text-[13px] font-medium text-ink">{name}</span>
          <span className="block truncate text-[11px] capitalize text-ink-3">
            {isCustomer && accountName ? `${accountName} · ${role.replace(/_/g, " ")}` : role.replace(/_/g, " ")}
          </span>
        </span>
        <Icon.ChevronDown size={14} className="shrink-0 text-ink-3 transition-transform duration-150" style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-message-in absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
        >
          <div className="border-b border-line px-4 py-3.5">
            <p className="truncate text-sm font-semibold text-ink">{isCustomer && accountName ? accountName : name}</p>
            <p className="mt-0.5 truncate text-xs text-ink-3">
              {isCustomer && accountName ? name : category === "support" ? "ParcelPilot Staff" : ""} ·{" "}
              <span className="capitalize">{role.replace(/_/g, " ")}</span>
            </p>
          </div>
          <div className="p-1.5">
            <ThemeToggle />
            <form action="/api/logout" method="POST">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-danger"
              >
                <Icon.Logout size={15} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
