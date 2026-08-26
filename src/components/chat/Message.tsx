"use client";
/**
 * Message — user bubble + assistant answer block.
 * Assistant messages stay conversational (not giant cards): avatar, markdown
 * content, sources, tool trace above, action card below, quiet footer controls.
 */
import { useState } from "react";
import type { UIMessage } from "./useAgentChat";
import { Markdown } from "@/components/ui/Markdown";
import { CopyButton } from "@/components/ui/CopyButton";
import { InlineError } from "@/components/ui/states";
import { SourceChips } from "./SourceChips";
import { Icon } from "@/components/ui/icons";

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function UserMessage({ message }: { message: UIMessage }) {
  return (
    <div className="group flex justify-end animate-message-in">
      <div className="flex max-w-[85%] flex-col items-end gap-1 sm:max-w-[70%]">
        <div className="rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[14px] leading-relaxed text-on-brand shadow-card">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <span className="px-1 text-[10.5px] text-ink-3 opacity-0 transition-opacity group-hover:opacity-100">
          {timeLabel(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function AssistantMessage({
  message,
  traceSlot,
  actionSlot,
  onRetry,
  showRetry,
}: {
  message: UIMessage;
  /** Rendered tool trace (parent decides) */
  traceSlot?: React.ReactNode;
  /** Rendered action card (parent decides) */
  actionSlot?: React.ReactNode;
  onRetry?: () => void;
  showRetry?: boolean;
}) {
  const streaming = !message.isComplete && !message.error;
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const hasBody = message.content.length > 0;

  return (
    <div className="animate-message-in">
      {/* Tool activity timeline */}
      {traceSlot}

      <div className="mt-2 flex gap-3">
        <span
          aria-hidden
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-card ${
            message.error ? "bg-danger-soft text-danger" : "bg-brand text-on-brand"
          }`}
        >
          <Icon.Sparkle size={14} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-ink">ParcelPilot AI</span>
            <span className="text-[10.5px] text-ink-3">{timeLabel(message.createdAt)}</span>
          </div>

          {message.error ? (
            <div className="mt-1.5">
              <InlineError message={message.error} />
            </div>
          ) : hasBody ? (
            <div className={`mt-1 ${streaming ? "stream-caret" : ""}`}>
              <Markdown content={message.content} />
            </div>
          ) : streaming ? (
            <p className="mt-1.5 animate-pulse text-[13px] italic text-ink-3">
              Analyzing your request…
            </p>
          ) : null}

          {/* Sources from real document_search results */}
          {!streaming && !message.error && message.sources && message.sources.length > 0 && (
            <SourceRow sources={message.sources} />
          )}

          {/* Action confirmation card */}
          {actionSlot && <div className="mt-3">{actionSlot}</div>}

          {/* Footer controls */}
          {!streaming && hasBody && (
            <div className="mt-2 -ml-1.5 flex items-center gap-0.5 opacity-70 transition-opacity hover:opacity-100 focus-within:opacity-100">
              <CopyButton text={message.content} label="" />
              {showRetry && onRetry && (
                <button
                  onClick={onRetry}
                  title="Regenerate answer"
                  aria-label="Regenerate answer"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <Icon.Refresh size={13} />
                  <span className="hidden sm:inline">Retry</span>
                </button>
              )}
              {!message.error && (
                <>
                  <FeedbackButton
                    active={feedback === "up"}
                    onClick={() => setFeedback(feedback === "up" ? null : "up")}
                    label="Helpful"
                  >
                    <Icon.ThumbsUp size={13} />
                  </FeedbackButton>
                  <FeedbackButton
                    active={feedback === "down"}
                    onClick={() => setFeedback(feedback === "down" ? null : "down")}
                    label="Not helpful"
                  >
                    <Icon.ThumbsDown size={13} />
                  </FeedbackButton>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceRow({ sources }: { sources: UIMessage["sources"] }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-2.5">
      <SourceChips sources={sources} />
    </div>
  );
}

function FeedbackButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`rounded-lg p-1.5 transition-colors ${
        active ? "bg-brand-soft text-brand-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
