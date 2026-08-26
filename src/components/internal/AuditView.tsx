"use client";
/**
 * AuditView — append-only operational trail (ops_manager only).
 * Responsive: table on desktop, stacked records on mobile (no horizontal scroll).
 */
import { useEffect, useState } from "react";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

interface AuditRow {
  id: string;
  occurredAt: string;
  actorUserId: string;
  actorCategory: string;
  actorRole: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  outcome: string;
}

function outcomeTone(outcome: string) {
  if (outcome === "success") return "success" as const;
  if (outcome === "failed" || outcome === "rejected") return "danger" as const;
  return "neutral" as const;
}

export function AuditView() {
  const [logs, setLogs] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(reset = true) {
    if (reset) {
      setLogs(null);
      setError(null);
    }
    try {
      const res = await fetch("/api/internal/audit");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load audit log.");
      setLogs(data.logs ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load audit log.");
      setLogs([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/audit")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load audit log.");
        if (!cancelled) setLogs(data.logs ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Could not load audit log.");
        setLogs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error && logs === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <ErrorState title="We couldn't load the audit log." body={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Audit log</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">
              Append-only record of every state-changing action and decision.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={logs === null}>
            <Icon.Refresh size={13} />
            Refresh
          </Button>
        </div>

        {logs === null ? (
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="mb-2 h-9 w-full last:mb-0" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface shadow-card">
            <EmptyState
              icon="Shield"
              title="No audit entries yet"
              body="Confirmed actions and security decisions will appear here."
            />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:block">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-surface-inset text-[11.5px] uppercase tracking-wider text-ink-3">
                    <th scope="col" className="px-4 py-2.5 font-medium">Time</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Actor</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Action</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Resource</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {logs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-surface-inset/60">
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-3 tabular-nums">
                        {new Date(log.occurredAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="block capitalize text-ink">{log.actorRole.replace(/_/g, " ")}</span>
                        <span className="block max-w-40 truncate font-mono text-[11.5px] text-ink-3" title={log.actorUserId}>
                          {log.actorUserId.slice(0, 8)}…
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-ink">{log.action}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">
                        {log.resourceType ? `${log.resourceType} · ${String(log.resourceId).slice(0, 8)}…` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={outcomeTone(log.outcome)} dot>
                          <span className="capitalize">{log.outcome}</span>
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked list */}
            <ul className="flex flex-col gap-2 md:hidden">
              {logs.map((log) => (
                <li key={log.id} className="rounded-xl border border-line bg-surface p-3.5 shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink">{log.action}</span>
                    <Badge tone={outcomeTone(log.outcome)} dot>
                      <span className="capitalize">{log.outcome}</span>
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12px] capitalize text-ink-3">
                    {log.actorRole.replace(/_/g, " ")}
                    {log.resourceType ? ` · ${log.resourceType} · ${String(log.resourceId).slice(0, 8)}…` : ""}
                  </p>
                  <p className="mt-0.5 text-[11.5px] tabular-nums text-ink-3/80">
                    {new Date(log.occurredAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
