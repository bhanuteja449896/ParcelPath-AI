"use client";

import { useEffect, useState } from "react";
import type { Ticket } from "@/lib/data/repositories/ticketsRepo";
import { Skeleton, ErrorState, EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export function TicketsView({ onDraftInChat }: { onDraftInChat: (text: string) => void }) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(reset = true) {
    if (reset) {
      setTickets(null);
      setError(null);
    }
    try {
      const res = await fetch("/api/internal/tickets");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load tickets.");
      setTickets(data.tickets ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load tickets.");
      setTickets([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/tickets")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load tickets.");
        if (!cancelled) setTickets(data.tickets ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Could not load tickets.");
        setTickets([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error && tickets === null) {
    return <ErrorState title="We couldn't load tickets." body={error} onRetry={load} />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Support Tickets</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">
              All active customer support tickets.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={tickets === null}>
            <Icon.Refresh size={13} />
            Refresh
          </Button>
        </div>

        {tickets === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="mt-2.5 h-3.5 w-full" />
                <Skeleton className="mt-1.5 h-3.5 w-3/4" />
              </div>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface shadow-card">
            <EmptyState
              icon="Check"
              title="No open tickets"
              body="There are currently no tickets in the system."
              action={
                <Button variant="secondary" size="sm" onClick={() => void load()}>
                  Refresh
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {tickets.map((t, i) => (
              <li
                key={t.id}
                className="animate-message-in flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-line bg-surface-inset px-1.5 py-0.5 font-mono text-[11.5px] text-ink-2">
                    {t.ticketId}
                  </span>
                  <Badge tone={t.status === "resolved" || t.status === "closed" ? "success" : t.status === "escalated" ? "warning" : "neutral"}>
                    {t.status}
                  </Badge>
                  <Badge tone={t.priority === "urgent" || t.priority === "high" ? "danger" : "neutral"}>
                    {t.priority}
                  </Badge>
                  <span className="text-[11.5px] text-ink-3">{new Date(t.createdAt).toLocaleString()}</span>
                </div>

                <h3 className="text-[14.5px] font-semibold leading-snug text-ink">{t.subject}</h3>
                
                {t.description && (
                  <p className="text-[13px] text-ink-2">{t.description}</p>
                )}

                <div className="mt-2 flex items-center justify-end border-t border-line pt-3">
                  <Button size="sm" onClick={() => onDraftInChat(`Help me resolve ticket ${t.ticketId}`)}>
                    Resolve with AI
                    <Icon.Sparkle size={14} className="ml-1" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
