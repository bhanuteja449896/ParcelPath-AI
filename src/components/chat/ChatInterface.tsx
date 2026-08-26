"use client";
/**
 * ChatInterface — presentational conversation surface shared by both consoles.
 * Owns no data logic: the parent supplies the useAgentChat instance so context
 * panels can observe the same stream.
 */
import { useEffect, useRef, useState } from "react";
import type { useAgentChat } from "./useAgentChat";
import { Composer, SuggestionChip } from "./Composer";
import { UserMessage, AssistantMessage } from "./Message";
import { ToolTrace } from "./ToolTrace";
import { ActionCard } from "./ActionCard";
import { InlineError } from "@/components/ui/states";
import { Icon } from "@/components/ui/icons";

type Chat = ReturnType<typeof useAgentChat>;

export function ChatInterface({
  chat,
  variant = "customer",
  suggestions,
  emptyTitle = "Start a conversation",
  emptyBody,
  placeholder,
  prefill,
  onPrefillConsumed,
}: {
  chat: Chat;
  variant?: "customer" | "support";
  /** Visual prompt chips (fill the composer only — never application logic) */
  suggestions?: string[];
  emptyTitle?: string;
  emptyBody?: string;
  placeholder: string;
  /** Text injected into the composer (e.g. "Draft escalation for TKT-2001") */
  prefill?: string | null;
  onPrefillConsumed?: () => void;
}) {
  const { messages, isLoading, error, sendMessage, stop, retry } = chat;
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const lastMessageId = messages[messages.length - 1]?.id;

  // Track whether the reader is scrolled near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Follow the stream only while the reader is at the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: messages.length <= 2 ? "auto" : "smooth" });
    });
  }, [messages, lastMessageId]);

  // Prefill support ("Draft in AI chat" from issues view).
  // Adjusting state during render (React-recommended pattern for prop-derived state)
  const [lastPrefill, setLastPrefill] = useState<string | null>(null);
  if (prefill && prefill !== lastPrefill) {
    setLastPrefill(prefill);
    setInput(prefill);
    onPrefillConsumed?.();
  }

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    stickToBottomRef.current = true;
    void sendMessage(text);
  };

  const lastMsgIdx = messages.length - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
        aria-live="polite"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-5 py-10 text-center animate-message-in sm:py-16">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
                <Icon.Sparkle size={22} />
              </span>
              <div>
                <p className="text-[17px] font-semibold text-ink">{emptyTitle}</p>
                {emptyBody && (
                  <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-3">
                    {emptyBody}
                  </p>
                )}
              </div>
              {suggestions && suggestions.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {suggestions.map((s) => (
                    <SuggestionChip key={s} label={s} onClick={() => setInput(s)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, idx) => {
            const isLast = idx === lastMsgIdx;
            if (msg.role === "user") return <UserMessage key={msg.id} message={msg} />;

            return (
              <AssistantMessage
                key={msg.id}
                message={msg}
                showRetry={isLast && !isLoading}
                onRetry={retry}
                traceSlot={
                  msg.toolCalls && msg.toolCalls.length > 0 ? (
                    <ToolTrace steps={msg.toolCalls} variant={variant} />
                  ) : undefined
                }
                actionSlot={
                  msg.pendingAction ? (
                    <ActionCard
                      pendingActionId={msg.pendingAction.pendingActionId}
                      summary={msg.pendingAction.summary}
                      actionType={msg.pendingAction.actionType}
                    />
                  ) : undefined
                }
              />
            );
          })}

          {error && !messages.some((m) => m.error) && (
            <InlineError message={error} />
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={submit}
            onStop={stop}
            isLoading={isLoading}
            placeholder={placeholder}
          />
          <p className="mt-1.5 text-center text-[11px] text-ink-3">
            Answers cite their sources. State-changing actions always require your confirmation.
          </p>
        </div>
      </div>
    </div>
  );
}
