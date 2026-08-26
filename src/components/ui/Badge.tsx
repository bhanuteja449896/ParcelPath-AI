/**
 * Badge — semantic status/label pill. Tone carries meaning; pair with text
 * (never color alone) for accessibility.
 */
import { Icon } from "./icons";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  brand: "bg-brand-soft text-brand-ink border-brand/20",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/25",
  info: "bg-info-soft text-info border-info/25",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${toneClasses[tone]} ${className ?? ""}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full bg-current`} aria-hidden />}
      {children}
    </span>
  );
}

/** Severity indicator used across issues + findings (icon + label, not color-only). */
export function SeverityBadge({
  severity,
  className,
}: {
  severity: string;
  className?: string;
}) {
  const map: Record<string, { tone: BadgeTone; label: string; icon: keyof typeof Icon }> = {
    critical: { tone: "danger", label: "Critical", icon: "Alert" },
    high: { tone: "warning", label: "High", icon: "Alert" },
    medium: { tone: "info", label: "Medium", icon: "Info" },
    low: { tone: "neutral", label: "Informational", icon: "Info" },
  };
  const cfg = map[severity] ?? map.low;
  const Ico = Icon[cfg.icon];
  return (
    <Badge tone={cfg.tone} className={className}>
      <Ico size={11} />
      {cfg.label}
    </Badge>
  );
}

/** Order status badge — maps raw DB status to a human label + tone. */
export function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    pending: { tone: "neutral", label: "Pending" },
    picked_up: { tone: "info", label: "Picked up" },
    in_transit: { tone: "info", label: "In transit" },
    delivered: { tone: "success", label: "Delivered" },
    cancelled: { tone: "danger", label: "Cancelled" },
    exception: { tone: "warning", label: "Exception" },
  };
  const cfg = map[status] ?? { tone: "neutral" as BadgeTone, label: status };
  return (
    <Badge tone={cfg.tone} dot>
      {cfg.label}
    </Badge>
  );
}
