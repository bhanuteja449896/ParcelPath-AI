"use client";
/**
 * Button — the single button primitive for both consoles.
 * Variants map to semantic tokens; never hard-code colors at call sites.
 */
import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-active shadow-card disabled:bg-ink-3",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong disabled:opacity-50",
  ghost:
    "bg-transparent text-ink-2 hover:text-ink hover:bg-surface-2 disabled:opacity-50",
  danger:
    "bg-danger text-white hover:bg-danger-hover active:brightness-90 disabled:opacity-50",
  "danger-outline":
    "bg-surface text-danger border border-danger/40 hover:bg-danger-soft disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", loading, className, children, disabled, ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 active:scale-[0.98] disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className ?? ""}`}
        {...props}
      >
        {loading && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
          />
        )}
        {children}
      </button>
    );
  }
);
