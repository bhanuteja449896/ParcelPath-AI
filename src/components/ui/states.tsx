/**
 * State components — Skeleton, EmptyState, ErrorState.
 * Every async area must render one of these, never a blank screen.
 */
import { Button } from "./Button";
import { Icon } from "./icons";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className ?? ""}`} />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: keyof typeof Icon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  const Ico = icon ? Icon[icon] : null;
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {Ico && (
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-ink-3">
          <Ico size={20} />
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-ink-3">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
}: {
  title: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-danger-soft text-danger">
        <Icon.Alert size={20} />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-ink-2">{body}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <Icon.Refresh size={13} />
          Try again
        </Button>
      )}
    </div>
  );
}

/** Card-level error used inline in chat (compact). */
export function InlineError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger"
    >
      <Icon.Alert size={14} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
