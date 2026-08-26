"use client";
/**
 * CustomerHome — customer support landing + chat.
 * Empty state: centered hero composer with suggestion chips.
 * In conversation: full-height chat under a slim header.
 */
import { useState } from "react";
import { useAgentChat } from "@/components/chat/useAgentChat";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { Composer, SuggestionChip } from "@/components/chat/Composer";
import { Logo, UserMenu } from "@/components/navigation/UserMenu";
import { Icon } from "@/components/ui/icons";

const SUGGESTIONS = [
  "Check an order",
  "Can I cancel a shipment?",
  "Check my service credit",
  "What's my support SLA?",
];

export function CustomerHome({
  identity,
  accountName,
}: {
  identity: { name: string; role: string };
  accountName: string | null;
}) {
  const chat = useAgentChat();
  const [heroInput, setHeroInput] = useState("");
  const isLanding = chat.messages.length === 0 && !chat.isLoading;

  const chatView = (
    <ChatInterface
      chat={chat}
      variant="customer"
      placeholder="Ask about shipments, cancellations, credits…"
    />
  );

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <div className="flex min-w-0 items-center gap-2">
            {accountName && (
              <span className="hidden max-w-[220px] items-center gap-1.5 truncate rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-medium text-ink-2 sm:inline-flex">
                <Icon.Package size={12} className="shrink-0 text-ink-3" />
                <span className="truncate">{accountName}</span>
              </span>
            )}
            <UserMenu
              name={identity.name}
              role={identity.role}
              category="customer"
              accountName={accountName}
            />
          </div>
        </div>
      </header>

      {isLanding ? (
        /* ── Landing hero ── */
        <main className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8">
          <div className="w-full max-w-2xl animate-message-in">
            <h1 className="text-center text-[26px] font-semibold tracking-tight text-ink sm:text-[32px]">
              How can we help?
            </h1>
            <p className="mx-auto mt-2 max-w-md text-center text-[14px] leading-relaxed text-ink-3">
              Ask about shipments, cancellations, service credits, support policies, or your
              account — every answer shows exactly where it came from.
            </p>

            <div className="mt-7">
              <Composer
                value={heroInput}
                onChange={setHeroInput}
                onSubmit={() => {
                  if (!heroInput.trim()) return;
                  void chat.sendMessage(heroInput);
                }}
                onStop={chat.stop}
                isLoading={chat.isLoading}
                placeholder="Describe your question or request…"
                autoFocus
              />
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <SuggestionChip key={s} label={s} onClick={() => setHeroInput(s)} />
              ))}
            </div>

            {chat.error && (
              <p role="alert" className="mt-4 text-center text-[13px] text-danger">
                {chat.error}
              </p>
            )}

            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  icon: "Search" as const,
                  title: "Grounded answers",
                  body: "Every response cites the agreement or policy it came from.",
                },
                {
                  icon: "Shield" as const,
                  title: "Safe actions",
                  body: "Cancellations and requests happen only after you confirm.",
                },
                {
                  icon: "Package" as const,
                  title: "Your account only",
                  body: "The assistant sees just your account's orders and terms.",
                },
              ].map((f) => {
                const Ico = Icon[f.icon];
                return (
                  <div key={f.title} className="rounded-xl border border-line bg-surface p-4 shadow-card">
                    <Ico size={16} className="text-brand-ink" />
                    <p className="mt-2.5 text-[13px] font-semibold text-ink">{f.title}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{f.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      ) : (
        /* ── Conversation view ── */
        <main className="flex min-h-0 flex-1 flex-col">{chatView}</main>
      )}
    </div>
  );
}
