"use client";
/**
 * TicketsView — live ticket workload for the support console.
 * Data comes from /api/internal/tickets (RLS-scoped). SLA state is computed
 * against the dataset reference time, never wall-clock time.
 */
import { useEffect, useMemo, useState } from "react";
import type { TicketDetail } from "@/lib/data/repositories/ticketsRepo";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

type StatusFilter = "all" | "open" | "escalated" | "pending" | "resolved";

const STATUS_TONE: Record<string, BadgeTone> = {
  open: "info",
  escalated: "warning",
  pending: "neutral",
  resolved: "success",
  closed: "neutral",
};

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function slaState(slaDueAt: string | null, refTimeMs: number): { label: string; tone: BadgeTone } | null {
  if (!slaDueAt || refTimeMs <= 0) return null;
  const due = new Date(slaDueAt).getTime();
  const diffH = (due - refTimeMs) / 3600000;
  if (diffH < 0) return { label: `SLA breached ${Math.abs(Math.round(diffH))}h ago`, tone: "danger" };
  if (diffH < 24) return { label: `SLA due in ${Math.max(1, Math.round(diffH))}h`, tone: "warning" };
  return null;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function TicketsView({ onAskAI }: { onAskAI: (text: string) => void }) {
  const [tickets, setTickets] = useState<TicketDetail[] | null>(null);
  /** Dataset reference time in ms; 0 until loaded (SLA badges hidden then) */
  const [referenceTimeMs, setReferenceTimeMs] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

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
      if (data.referenceTime) setReferenceTimeMs(new Date(data.referenceTime).getTime());
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
        if (cancelled) return;
        setTickets(data.tickets ?? []);
        if (data.referenceTime) setReferenceTimeMs(new Date(data.referenceTime).getTime());
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

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: 0, open: 0, escalated: 0, pending: 0, resolved: 0 };
    for (const t of tickets ?? []) {
      c.all++;
      if (t.status === "open" || t.status === "escalated" || t.status === "pending") c[t.status as "open"]++;
      else c.resolved++;
    }
    return c;
  }, [tickets]);

  const visible = useMemo(() => {
    let list = tickets ?? [];
    if (filter !== "all") {
      list =
        filter === "resolved"
          ? list.filter((t) => t.status === "resolved" || t.status === "closed")
          : list.filter((t) => t.status === filter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.ticketId.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          (t.accountName ?? "").toLowerCase().includes(q) ||
          (t.accountCode ?? "").toLowerCase().includes(q)
      );
    }
    return [...list].sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
    );
  }, [tickets, filter, query]);

  if (error && tickets === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <ErrorState title="We couldn't load tickets." body={error} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Tickets</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">
              Live workload across all accounts. SLA states use the dataset reference time.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={tickets === null}>
            <Icon.Refresh size={13} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
            {(["all", "open", "escalated", "pending", "resolved"] as StatusFilter[]).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors ${
                  filter === f
                    ? "border-brand/40 bg-brand-soft text-brand-ink"
                    : "border-line bg-surface text-ink-2 hover:border-line-strong"
                }`}
              >
                {f}
                <span className={`rounded-full px-1.5 text-[10.5px] tabular-nums ${filter === f ? "bg-brand/15" : "bg-surface-2"}`}>
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>
          <label className="relative block w-full lg:w-64">
            <span className="sr-only">Search tickets</span>
            <Icon.Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search id, subject, account…"
              className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-brand/50"
            />
          </label>
        </div>

        {/* Content */}
        {tickets === null ? (
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="mb-2 h-10 w-full last:mb-0" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface shadow-card">
            <EmptyState
              icon="Ticket"
              title={query || filter !== "all" ? "No tickets match this filter" : "No support tickets yet"}
              body={query || filter !== "all" ? "Try a different search or status." : "New customer tickets will appear here."}
            />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:block">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-surface-inset text-[11.5px] uppercase tracking-wider text-ink-3">
                    <th scope="col" className="px-4 py-2.5 font-medium">Ticket</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Account</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Priority</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">SLA</th>
                    <th scope="col" className="px-4 py-2.5 font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((t) => {
                    const sla = slaState(t.slaDueAt ? String(t.slaDueAt) : null, referenceTimeMs);
                    return (
                      <tr key={t.ticketId} className="transition-colors hover:bg-surface-inset/60">
                        <td className="max-w-xs px-4 py-3">
                          <span className="block font-mono text-[12px] font-semibold text-brand-ink">{t.ticketId}</span>
                          <span className="block truncate text-ink" title={t.subject}>{t.subject}</span>
                          <span className="text-[11px] capitalize text-ink-3">{t.category} · created {fmtDate(String(t.createdAt))}</span>
                        </td>
                        <td className="px-4 py-3 text-ink-2">{t.accountName}<span className="block text-[11px] text-ink-3">{t.accountCode}</span></td>
                        <td className="px-4 py-3"><Badge tone={STATUS_TONE[t.status] ?? "neutral"} dot><span className="capitalize">{t.status}</span></Badge></td>
                        <td className="px-4 py-3"><Badge tone={t.priority === "urgent" ? "danger" : t.priority === "high" ? "warning" : "neutral"}><span className="capitalize">{t.priority}</span></Badge></td>
                        <td className="px-4 py-3">{sla ? <Badge tone={sla.tone}><span className="capitalize">{sla.label}</span></Badge> : <span className="text-ink-3">{t.slaDueAt ? fmtDate(String(t.slaDueAt)) : "—"}</span>}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button
                            onClick={() => onAskAI(`Investigate ticket ${t.ticketId}: ${t.subject}. What should we do next?`)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-brand-ink transition-colors hover:bg-brand-soft"
                            title={`Ask AI about ${t.ticketId}`}
                          >
                            <Icon.Sparkle size={12} />
                            Ask AI
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="flex flex-col gap-2 md:hidden">
              {visible.map((t) => {
                const sla = slaState(t.slaDueAt ? String(t.slaDueAt) : null, referenceTimeMs);
                return (
                  <li key={t.ticketId} className="rounded-xl border border-line bg-surface p-3.5 shadow-card">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-brand-ink">{t.ticketId}</span>
                      <Badge tone={STATUS_TONE[t.status] ?? "neutral"} dot><span className="capitalize">{t.status}</span></Badge>
                    </div>
                    <p className="mt-1 text-[13px] font-medium leading-snug text-ink">{t.subject}</p>
                    <p className="mt-1 text-[11.5px] text-ink-3">
                      {t.accountName} · <span className="capitalize">{t.priority}</span> · created {fmtDate(String(t.createdAt))}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {sla ? <Badge tone={sla.tone}><span className="capitalize">{sla.label}</span></Badge> : <span />}
                      <button
                        onClick={() => onAskAI(`Investigate ticket ${t.ticketId}: ${t.subject}. What should we do next?`)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-brand-ink"
                      >
                        <Icon.Sparkle size={12} />
                        Ask AI
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
