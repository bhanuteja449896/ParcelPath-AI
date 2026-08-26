"use client";
/**
 * OverviewView — operational dashboard. Every metric is derived from a real
 * endpoint; nothing is fabricated. Loading, error, and empty states included.
 */
import { useEffect, useState } from "react";
import type { Finding } from "@/lib/data/repositories/issuesRepo";
import { Skeleton, ErrorState } from "@/components/ui/states";
import { SeverityBadge, Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/icons";

type ViewId = "overview" | "chat" | "tickets" | "orders" | "issues" | "approvals" | "audit";

interface Metric {
  key: string;
  label: string;
  value: number | null;
  hint: string;
  icon: "Activity" | "ListChecks" | "Shield" | "Ticket";
  tone: "warning" | "danger" | "neutral";
  target?: ViewId;
}

export function OverviewView({
  isManager,
  onNavigate,
}: {
  isManager: boolean;
  onNavigate: (v: ViewId) => void;
}) {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(isManager ? null : 0);
  const [openTickets, setOpenTickets] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const jobs: Promise<void>[] = [
      fetch("/api/internal/issues")
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Failed to load issues.");
          const data = await r.json();
          if (!cancelled) setFindings(data.findings ?? []);
        }),
      fetch("/api/internal/tickets")
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Failed to load tickets.");
          const data = await r.json();
          if (!cancelled) {
            const open = (data.tickets ?? []).filter(
              (t: { status: string }) => !["resolved", "closed"].includes(t.status)
            );
            setOpenTickets(open.length);
          }
        }),
    ];
    if (isManager) {
      jobs.push(
        fetch("/api/internal/pending")
          .then(async (r) => {
            if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Failed to load approvals.");
            const data = await r.json();
            if (!cancelled) setPendingCount((data.actions ?? []).length);
          })
      );
    }
    Promise.all(jobs).catch((e) => {
      if (!cancelled) setError(e?.message ?? "Could not load dashboard data.");
    });

    return () => {
      cancelled = true;
    };
  }, [isManager]);

  async function refresh() {
    setFindings(null);
    setOpenTickets(null);
    setPendingCount(isManager ? null : 0);
    setError(null);
    try {
      const [issuesRes, ticketsRes, pendingRes] = await Promise.all([
        fetch("/api/internal/issues"),
        fetch("/api/internal/tickets"),
        isManager ? fetch("/api/internal/pending") : Promise.resolve(null),
      ]);
      if (!issuesRes.ok || !ticketsRes.ok) throw new Error("Could not load dashboard data.");
      setFindings((await issuesRes.json()).findings ?? []);
      const ticketData = await ticketsRes.json();
      const open = (ticketData.tickets ?? []).filter(
        (t: { status: string }) => !["resolved", "closed"].includes(t.status)
      );
      setOpenTickets(open.length);
      if (pendingRes && pendingRes.ok) setPendingCount(((await pendingRes.json()).actions ?? []).length);
    } catch (e: any) {
      setError(e?.message ?? "Could not load dashboard data.");
      setFindings([]);
      setOpenTickets(0);
    }
  }

  const metrics: Metric[] = [
    {
      key: "tickets",
      label: "Open tickets",
      value: openTickets,
      hint: "Non-resolved workload across all accounts",
      icon: "Ticket",
      tone: "warning",
      target: "tickets",
    },
    {
      key: "findings",
      label: "Active findings",
      value: findings?.length ?? null,
      hint: "Proactive signals across support activity",
      icon: "Activity",
      tone: "warning",
      target: "issues",
    },
    ...(isManager
      ? [
          {
            key: "approvals",
            label: "Awaiting approval",
            value: pendingCount,
            hint: "Actions waiting on your confirmation",
            icon: "ListChecks" as const,
            tone: "danger" as const,
            target: "approvals" as ViewId,
          },
        ]
      : []),
    {
      key: "chat",
      label: "AI investigations",
      value: -1,
      hint: "Ask anything about accounts, orders, or policies",
      icon: "Shield",
      tone: "neutral",
      target: "chat",
    },
  ];

  const highCount = findings?.filter((f) => f.severity === "high").length ?? 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Operations overview</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">
              Signals are computed live from the seeded dataset against the reference time.
            </p>
          </div>
          <button
            onClick={() => void refresh()}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 shadow-card transition-colors hover:text-ink"
          >
            <Icon.Refresh size={14} />
            Refresh
          </button>
        </div>

        {error && <ErrorState title="We couldn't load this information." body={error} onRetry={refresh} />}

        {/* Metrics */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((m) => {
            const Ico = Icon[m.icon];
            const loading = m.value === null;
            return (
              <button
                key={m.key}
                onClick={() => m.target && onNavigate(m.target)}
                className="flex flex-col rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-colors hover:border-brand/40"
              >
                <span className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
                    <Ico size={15} />
                  </span>
                  {loading ? (
                    <Skeleton className="h-7 w-12" />
                  ) : m.value === -1 ? (
                    <Icon.ChevronRight size={16} className="text-ink-3" />
                  ) : (
                    <span className={`text-[22px] font-semibold leading-none tabular-nums ${(m.value ?? 0) > 0 && m.tone !== "neutral" ? "text-warning" : "text-ink"}`}>
                      {m.value}
                    </span>
                  )}
                </span>
                <span className="mt-3 text-[13.5px] font-semibold text-ink">{m.label}</span>
                <span className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{m.hint}</span>
                {m.key === "findings" && !loading && findings !== null && findings.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {findings.filter((f) => f.severity === "critical").length > 0 && (
                      <Badge tone="danger">
                        {findings.filter((f) => f.severity === "critical").length} critical
                      </Badge>
                    )}
                    {highCount > 0 && <Badge tone="warning">{highCount} high</Badge>}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Findings preview */}
        <section className="rounded-2xl border border-line bg-surface shadow-card">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-[13.5px] font-semibold text-ink">Top proactive findings</h3>
            <button
              onClick={() => onNavigate("issues")}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-ink hover:underline"
            >
              View all
              <Icon.ChevronRight size={12} />
            </button>
          </header>
          {findings === null ? (
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : findings.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-ink-3">
              No operational issues detected.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {findings.slice(0, 3).map((f, i) => (
                <li key={i} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <span className="truncate text-[13.5px] font-medium text-ink">{f.title}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-ink-3">{f.window} · {f.type.replace(/_/g, " ")}</p>
                  </div>
                  <Icon.ChevronRight size={14} className="hidden shrink-0 text-ink-3 sm:block" />
                </li>
              ))}
            </ul>
          )}
        </section>

        {!isManager && (
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-ink-3">
            Approvals and the audit log are available to operations managers.
          </p>
        )}
      </div>
    </div>
  );
}
