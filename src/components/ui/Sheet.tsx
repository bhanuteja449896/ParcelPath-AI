"use client";
/**
 * Sheet — accessible overlay surface.
 * variant="drawer": right side drawer on desktop, bottom sheet on mobile.
 * variant="modal": centered dialog on desktop, bottom sheet on mobile.
 * Handles Escape, overlay click, focus placement, scroll lock, aria-modal.
 */
import { useEffect, useRef } from "react";
import { Icon } from "./icons";

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "drawer",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  variant?: "drawer" | "modal";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const positionClasses =
    variant === "drawer"
      ? // Bottom sheet on mobile → right drawer from sm up
        `fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] rounded-t-2xl
         sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[440px] sm:max-h-none sm:h-full sm:rounded-none sm:rounded-l-2xl
         animate-sheet-in-bottom sm:animate-sheet-in-right`
      : // Centered modal on desktop; near-full-width sheet on mobile
        `fixed inset-x-3 bottom-0 z-50 max-h-[88dvh] rounded-t-2xl
         sm:inset-x-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[480px] sm:rounded-2xl`;

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-ink/40 animate-overlay-in"
        style={{ backdropFilter: "blur(2px)" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`flex flex-col bg-surface text-ink shadow-sheet outline-none ${positionClasses}`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" aria-hidden />
        <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div>
            <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
            {description && (
              <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-0.5 rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Icon.X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <footer className="shrink-0 border-t border-line px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
