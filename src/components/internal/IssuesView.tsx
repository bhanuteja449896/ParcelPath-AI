"use client";
/**
 * IssuesView — proactive issue detection feed.
 * Renders only what /api/internal/issues returns; each finding can be
 * drafted into the AI chat with one click.
 */
import { useEffect, useState } from "react";
import type { Finding } from "@/lib/data/repositories/issuesRepo";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { SeverityBadge, Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

const TYPE_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  sla_risk: { label: "SLA risk", tone: "warning" },
  complaint_spike: { label: "Ticket spike", tone: "info" },
  cross_account_incident: { label: "Cross-account incident", tone: "danger" },
  order_anomaly: { label: "Unusual activity", tone: "info" },
  product_issue_cluster: { label: "Product issue cluster", tone: "warning" },
};

export function IssuesView({ onDraftInChat }: { onDraftInChat: (text: string) => void }) {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(reset = true) {
    if (reset) {
      setFindings(null);
      setError(null);
    }
    try {
      const res = await fetch("/api/internal/issues");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not run heuristics.");
      setFindings(data.findings ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load issues.");
      setFindings([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/issues")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not run heuristics.");
        if (!cancelled) setFindings(data.findings ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Could not load issues.");
        setFindings([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error && findings === null) {
    return <ErrorState title="We couldn't load this information." body={error} onRetry={load} />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Proactive issues</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">
              Spikes, clusters, SLA risk, and anomalies detected across support activity.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={findings === null}>
            <Icon.Refresh size={13} />
            Refresh
          </Button>
        </div>

        {findings === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="mt-2.5 h-3.5 w-full" />
                <Skeleton className="mt-1.5 h-3.5 w-3/4" />
              </div>
            ))}
          </div>
        ) : findings.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface shadow-card">
            <EmptyState
              icon="Check"
              title="No operational issues detected"
              body="Heuristics found no spikes, SLA risks, or anomalies right now."
              action={
                <Button variant="secondary" size="sm" onClick={() => void load()}>
                  Re-run detection
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {findings.map((f, i) => {
              const typeMeta = TYPE_LABEL[f.type] ?? { label: f.type.replace(/_/g, " "), tone: "neutral" as BadgeTone };
              return (
                <li
                  key={i}
                  className="animate-message-in flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={f.severity} />
                    <Badge tone={typeMeta.tone}>{typeMeta.label}</Badge>
                    <span className="text-[11.5px] text-ink-3">{f.window}</span>
                  </div>

                  <h3 className="text-[14.5px] font-semibold leading-snug text-ink">{f.title}</h3>

                  {f.evidence.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Evidence</span>
                      {f.evidence.map((ev, ei) => {
                        const id = ev.ticket_id ?? ev.order_id ?? ev.account_code;
                        return id ? (
                          <span
                            key={ei}
                            className="rounded-md border border-line bg-surface-inset px-1.5 py-0.5 font-mono text-[11.5px] text-ink-2"
                          >
                            {id}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-inset px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 text-[13px] leading-relaxed text-ink-2">
                      <span className="font-medium text-ink-3">Suggested next step: </span>
                      {f.suggested_next}
                    </p>
                    <Button size="sm" onClick={() => onDraftInChat(f.suggested_next)} className="shrink-0 self-start sm:self-auto">
                      Draft in AI chat
                      <Icon.ChevronRight size={12} />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
