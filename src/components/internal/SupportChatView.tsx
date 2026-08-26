"use client";
/**
 * SupportChatView — internal AI chat with a collapsible context panel.
 * The panel renders only data actually observed in the conversation:
 * sources returned by document_search, entities returned by data_lookup,
 * and drafted actions awaiting confirmation.
 */
import { useMemo, useState } from "react";
import type { useAgentChat } from "@/components/chat/useAgentChat";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { getConversationMeta } from "@/components/chat/useAgentChat";
import { SourceChips } from "@/components/chat/SourceChips";
import { OrderStatusBadge, Badge, type BadgeTone } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/states";
import { Icon } from "@/components/ui/icons";

type Chat = ReturnType<typeof useAgentChat>;

export function SupportChatView({
  chat,
  identity,
  prefill,
  onPrefillConsumed,
}: {
  chat: Chat;
  identity: { name: string; role: string };
  prefill?: string | null;
  onPrefillConsumed?: () => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const meta = useMemo(() => getConversationMeta(chat.messages), [chat.messages]);

  const chatPane = (
    <ChatInterface
      chat={chat}
      variant="support"
      emptyTitle="Investigate with ParcelPilot AI"
      emptyBody="Ask about any account, order, ticket, policy — or describe an incident. Tool usage and sources are shown inline."
      suggestions={[
        "What's at risk of breaching SLA?",
        "Check ticket TKT-2001",
        "Draft escalation for the oldest open ticket",
      ]}
      placeholder="Ask about accounts, orders, tickets, or policies…"
      prefill={prefill}
      onPrefillConsumed={onPrefillConsumed}
    />
  );

  return (
    <div className="flex h-full">
      {/* Chat */}
      <div className="flex min-w-0 flex-1 flex-col">{chatPane}</div>

      {/* Context panel — desktop */}
      <aside
        className={`hidden shrink-0 overflow-hidden border-l border-line bg-surface transition-[width] duration-200 xl:block ${
          panelOpen ? "w-[320px]" : "w-0 border-l-0"
        }`}
        aria-label="Conversation context"
        aria-hidden={!panelOpen}
      >
        <div className="flex h-full w-[320px] flex-col overflow-y-auto p-4">
          <ContextContent meta={meta} identity={identity} />
        </div>
      </aside>

      {/* Context toggle */}
      <button
        onClick={() => (window.innerWidth >= 1280 ? setPanelOpen((v) => !v) : setSheetOpen(true))}
        aria-label={panelOpen ? "Hide context panel" : "Show context panel"}
        title="Context"
        className={`fixed right-4 top-[72px] z-20 hidden h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-ink-2 shadow-card transition-colors hover:text-brand-ink md:flex ${
          panelOpen ? "xl:right-[336px]" : ""
        }`}
      >
        <Icon.PanelRight size={16} />
      </button>

      {/* Context sheet — tablet/mobile */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Conversation context"
        description="Observed during this investigation"
      >
        <ContextContent meta={meta} identity={identity} />
      </Sheet>
    </div>
  );
}

function ContextContent({
  meta,
  identity,
}: {
  meta: ReturnType<typeof getConversationMeta>;
  identity: { name: string; role: string };
}) {
  return (
    <div className="flex flex-col gap-6 text-sm">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Your access</h3>
        <div className="rounded-xl border border-line bg-surface-inset p-3">
          <p className="font-medium capitalize text-ink">{identity.role.replace(/_/g, " ")}</p>
          <p className="mt-0.5 text-[12px] text-ink-3">ParcelPilot staff · all accounts (read)</p>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          Orders & tickets seen
          <span className="ml-1.5 font-normal normal-case text-ink-3/70">({meta.entities.length})</span>
        </h3>
        {meta.entities.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            Entities looked up during this conversation appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {meta.entities.map((e) => (
              <li key={`${e.kind}-${e.id}`} className="rounded-xl border border-line bg-surface-inset px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12.5px] font-semibold text-ink">{e.id}</span>
                  {e.kind === "order" && typeof e.detail?.status === "string" ? (
                    <OrderStatusBadge status={e.detail.status as string} />
                  ) : e.kind === "ticket" && typeof e.detail?.status === "string" ? (
                    <TicketStatusBadge status={e.detail.status as string} />
                  ) : (
                    <Badge>{e.kind}</Badge>
                  )}
                </div>
                {e.kind === "order" && typeof e.detail?.carrier === "string" && (
                  <p className="mt-1 text-[12px] text-ink-3">Carrier: {e.detail.carrier as string}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          Sources
          <span className="ml-1.5 font-normal normal-case text-ink-3/70">({meta.sources.length} documents)</span>
        </h3>
        {meta.sources.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            Documents retrieved by the agent are listed here for review.
          </p>
        ) : (
          <SourceChips sources={meta.sources} />
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          Drafted actions
          <span className="ml-1.5 font-normal normal-case text-ink-3/70">({meta.pendingActions.length})</span>
        </h3>
        {meta.pendingActions.length === 0 ? (
          <EmptyState
            icon="Shield"
            title="No pending actions"
            body="Actions drafted by the agent await confirmation here before anything changes."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {meta.pendingActions.map((a) => (
              <li key={a.pendingActionId} className="rounded-xl border border-brand/25 bg-brand-soft/50 px-3 py-2.5 text-[12.5px]">
                <p className="font-medium text-ink">{a.summary}</p>
                <p className="mt-0.5 capitalize text-ink-3">{a.actionType.replace(/_/g, " ")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TicketStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeTone> = {
    open: "info",
    escalated: "warning",
    resolved: "success",
    closed: "neutral",
  };
  return (
    <Badge tone={map[status] ?? "neutral"} dot>
      <span className="capitalize">{status}</span>
    </Badge>
  );
}
