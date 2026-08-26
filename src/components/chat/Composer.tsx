"use client";
/**
 * Composer — premium chat input.
 * Multiline, Enter sends / Shift+Enter newline, stop-generation while streaming,
 * auto-growing height, safe-area padding for mobile.
 */
import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icons";

const MAX_LENGTH = 4000;

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isLoading: boolean;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow up to ~6 rows
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 168) + "px";
  }, [value]);

  useEffect(() => {
    if (autoFocus && window.matchMedia("(min-width: 768px)").matches) {
      ref.current?.focus();
    }
  }, [autoFocus]);

  const canSend = value.trim().length > 0 && !isLoading;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSend) return;
        onSubmit();
      }}
      className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-card transition-colors focus-within:border-brand/50"
    >
      <label htmlFor="chat-composer" className="sr-only">
        Message ParcelPilot AI
      </label>
      <textarea
        id="chat-composer"
        ref={ref}
        rows={1}
        value={value}
        maxLength={MAX_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (canSend) onSubmit();
          }
        }}
        placeholder={placeholder}
        disabled={isLoading && !value}
        className="flex-1 resize-none bg-transparent px-3 py-2 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-3"
        style={{ maxHeight: 168 }}
      />
      <div className="flex items-center gap-1 pb-0.5 pr-0.5">
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop generating"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink-2 transition-all hover:border-danger/40 hover:text-danger active:scale-95"
          >
            <Icon.Stop size={13} />
          </button>
        ) : (
          <span aria-hidden className="hidden px-1.5 text-[11px] text-ink-3 sm:block">
            {value.length > MAX_LENGTH * 0.8 ? `${value.length}/${MAX_LENGTH}` : ""}
          </span>
        )}
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          title="Send message"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all active:scale-95 ${
            canSend
              ? "bg-brand text-on-brand shadow-card hover:bg-brand-hover"
              : "bg-surface-2 text-ink-3"
          }`}
        >
          <Icon.Send size={15} />
        </button>
      </div>
    </form>
  );
}

/** Suggestion chip used on empty states — fills the composer, never auto-sends logic. */
export function SuggestionChip({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2 shadow-card transition-all hover:border-brand/40 hover:text-brand-ink active:scale-[0.98]"
    >
      {label}
      <Icon.ChevronRight
        size={12}
        className="text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand-ink"
      />
    </button>
  );
}
