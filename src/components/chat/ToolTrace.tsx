"use client";
/**
 * ToolTrace — renders the real tool events emitted by the agent as an
 * animated investigation timeline. Collapses to a compact summary once
 * complete; expands for details.
 *
 * Customer variant hides raw payloads; support variant exposes them on expand.
 */
import { useEffect, useState } from "react";
import type { UIToolCall } from "./useAgentChat";
import { Icon } from "@/components/ui/icons";

function humanLabel(tc: UIToolCall): string {
  let args: any = {};
  try {
    args = JSON.parse(tc.args || "{}");
  } catch { /* keep {} */ }

  switch (tc.name) {
    case "document_search":
      return "Searching policies & documents";
    case "data_lookup": {
      const entity = String(args.entity ?? "record");
      const id = args.id ? ` ${args.id}` : "";
      return entity === "order" ? `Looking up order${id}`
        : entity === "ticket" ? `Looking up ticket${id}`
        : entity === "account" ? "Looking up account details"
        : entity === "orders" ? "Loading your orders"
        : entity === "tickets" ? "Loading your tickets"
        : `Looking up ${entity}${id}`;
    }
    case "calculate":
      return args.kind === "cancellation_fee" ? `Calculating cancellation fee${args.resourceId ? ` for ${args.resourceId}` : ""}`
        : args.kind === "service_credit" ? "Calculating service credit"
        : args.kind === "sla_remaining" ? "Checking SLA time remaining"
        : "Running calculation";
    case "draft_action": {
      const type = String(args.type ?? "");
      const target = args.params?.orderId ?? args.params?.ticketId ?? "";
      if (type === "cancel_order") return `Preparing cancellation${target ? ` of ${target}` : ""}`;
      if (type === "create_escalation") return `Preparing escalation${target ? ` for ${target}` : ""}`;
      if (type === "update_ticket") return `Preparing ticket update${target ? ` for ${target}` : ""}`;
      return "Preparing an action";
    }
    default:
      return tc.name.replace(/_/g, " ");
  }
}

const stepIcon: Record<string, keyof typeof Icon> = {
  document_search: "Search",
  data_lookup: "Package",
  calculate: "Calculator",
  draft_action: "ListChecks",
};

export function ToolTrace({
  steps,
  variant = "customer",
}: {
  steps: UIToolCall[];
  variant?: "customer" | "support";
}) {
  const runningIndex = steps.findIndex((s) => s.status === "running");
  const isRunning = runningIndex >= 0;
  const failed = steps.some((s) => s.status === "failed");
  /** null = follow stream state (expanded while working, collapsed when done) */
  const [pinned, setPinned] = useState<boolean | null>(null);
  const [openDetail, setOpenDetail] = useState<string | null>(null);

  useEffect(() => {
    if (!isRunning && !failed) {
      const t = setTimeout(() => setPinned(false), 1400);
      return () => clearTimeout(t);
    }
  }, [isRunning, failed]);

  if (!steps.length) return null;

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const expanded = pinned ?? isRunning;

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-surface text-[13px] transition-colors duration-200 ${
        failed ? "border-danger/25" : "border-line"
      }`}
    >
      <button
        onClick={() => setPinned(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-inset"
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
            failed ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-ink"
          }`}
        >
          {isRunning ? (
            <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
          ) : (
            <Icon.Sparkle size={12} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          {isRunning ? (
            <span className="font-medium text-ink">Working…</span>
          ) : failed ? (
            <span className="font-medium text-danger">A lookup step did not complete</span>
          ) : (
            <span className="font-medium text-ink">{completedCount} step{completedCount === 1 ? "" : "s"} completed</span>
          )}
          {!expanded && (
            <span className="ml-2 hidden text-ink-3 sm:inline">
              {steps.map((s) => humanLabel(s)).slice(0, 2).join(" · ")}
              {steps.length > 2 && " …"}
            </span>
          )}
        </span>
        <Icon.ChevronDown
          size={14}
          className="shrink-0 text-ink-3 transition-transform duration-200"
          style={{ transform: expanded ? "rotate(180deg)" : undefined }}
        />
      </button>

      {expanded && (
        <ol role="list" className="border-t border-line px-3.5 py-2">
          {steps.map((step) => {
            const Ico = Icon[stepIcon[step.name] ?? "Doc"];
            const isOpen = openDetail === step.id;
            return (
              <li key={step.id} className="animate-step-in">
                <div
                  className="flex items-center gap-2.5 py-1.5"
                  style={{ paddingLeft: `${Math.min(steps.indexOf(step), 4) * 10}px` }}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {step.status === "running" && (
                      <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-brand border-t-transparent" />
                    )}
                    {step.status === "completed" && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success-soft text-success">
                        <Icon.Check size={9} strokeWidth={3} />
                      </span>
                    )}
                    {step.status === "failed" && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-danger-soft text-danger">
                        <Icon.X size={9} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <Ico size={13} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate text-ink-2">{humanLabel(step)}</span>
                  {variant === "support" && step.result !== undefined && (
                    <button
                      onClick={() => setOpenDetail(isOpen ? null : step.id)}
                      className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                      aria-expanded={isOpen}
                    >
                      {isOpen ? "Hide" : "Raw"}
                    </button>
                  )}
                </div>
                {variant === "support" && isOpen && (
                  <pre className="mb-2 ml-7 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-inset p-2 font-mono text-[11px] leading-relaxed text-ink-3">
                    {truncate(step.args, 400)}
                    {"\n---\n"}
                    {truncate(step.result ?? "", 800)}
                  </pre>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (!text) return "(empty)";
  try {
    return JSON.stringify(JSON.parse(text), null, 2).slice(0, max);
  } catch {
    return text.slice(0, max);
  }
}
