"use client";
/**
 * ApprovalsView — queue of drafted actions awaiting ops_manager approval.
 * Cards show action, requester, resource, age, and expiry countdown;
 * Review opens the explicit confirmation sheet.
 */
import { useEffect, useState } from "react";
import type { PendingAction } from "@/lib/data/repositories/pendingActionsRepo";
import { ActionCard } from "@/components/chat/ActionCard";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

function ageLabel(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

export function ApprovalsView() {
  const [actions, setActions] = useState<PendingAction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  async function load(reset = true) {
    if (reset) {
      setActions(null);
      setError(null);
    }
    try {
      const res = await fetch("/api/internal/pending");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load approvals.");
      setActions(data.actions ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load approvals.");
      setActions([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/pending")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load approvals.");
        if (!cancelled) setActions(data.actions ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Could not load approvals.");
        setActions([]);
      });
    // Re-render every 30s so relative ages stay honest
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (error && actions === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <ErrorState title="We couldn't load the approvals queue." body={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Approvals</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">
              State-changing actions drafted by users or the agent. Nothing executes without
              explicit confirmation.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={actions === null}>
            <Icon.Refresh size={13} />
            Refresh
          </Button>
        </div>

        {actions === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-2.5 h-3.5 w-full" />
                <Skeleton className="mt-1.5 h-8 w-32" />
              </div>
            ))}
          </div>
        ) : actions.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface shadow-card">
            <EmptyState
              icon="Check"
              title="You're all caught up"
              body="No actions are awaiting approval. New requests will appear here."
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {actions.map((a) => (
              <li key={a.id} className="animate-message-in flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <ActionCard
                  pendingActionId={a.id}
                  summary={a.displaySummary}
                  actionType={a.actionType}
                  requester={`user · ${a.userId.slice(0, 8)}…`}
                  expiresAt={new Date(a.expiresAt).toISOString()}
                />
                <p className="px-0.5 text-[11.5px] text-ink-3">
                  Requested {ageLabel(new Date(a.createdAt).toISOString())} · expires{" "}
                  {new Date(a.expiresAt).toLocaleTimeString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
