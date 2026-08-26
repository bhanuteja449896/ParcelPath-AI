"use client";
/**
 * ActionCard — distinct confirmation surface for state-changing actions.
 * Never looks like a chat bubble. Confirming opens a modal/bottom-sheet so the
 * consequences are explicit and accidental taps are impossible.
 *
 * Handles every backend outcome: success, decline, failure, expiry,
 * permission denial, and already-changed resources.
 */
import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/ui/icons";

type CardState =
  | "pending"
  | "executing"
  | "executed"
  | "declined"
  | "failed"
  | "expired"
  | "unauthorized"
  | "stale";

const ACTION_COPY: Record<string, { title: string; verb: string; consequence: string }> = {
  cancel_order: {
    title: "Cancellation request",
    verb: "Confirm cancellation",
    consequence: "The order status will change to Cancelled.",
  },
  create_escalation: {
    title: "Escalation request",
    verb: "Confirm escalation",
    consequence: "The ticket will be escalated for priority human handling.",
  },
  update_ticket: {
    title: "Ticket update",
    verb: "Confirm update",
    consequence: "The ticket will be updated as described.",
  },
  create_follow_up_task: {
    title: "Follow-up task",
    verb: "Confirm task",
    consequence: "A follow-up task will be created.",
  },
};

function copyFor(actionType?: string) {
  return (
    ACTION_COPY[actionType ?? ""] ?? {
      title: "Action confirmation",
      verb: "Confirm action",
      consequence: "This will make the described change.",
    }
  );
}

function mapFailureToState(message: string): { state: CardState; text: string } {
  const m = message.toLowerCase();
  if (m.includes("expire")) return { state: "expired", text: "This action has expired." };
  if (m.includes("permission")) return { state: "unauthorized", text: "You no longer have permission to perform this action." };
  if (m.includes("already cancelled") || m.includes("already executed"))
    return { state: "stale", text: "The order changed before the action could be completed." };
  return { state: "failed", text: message || "The action could not be completed." };
}

export function ActionCard({
  pendingActionId,
  summary,
  actionType,
  requester,
  expiresAt,
}: {
  pendingActionId: string;
  summary: string;
  actionType?: string;
  /** Shown in ops approvals context */
  requester?: string;
  expiresAt?: string;
}) {
  const copy = copyFor(actionType);
  const toast = useToast();
  const [state, setState] = useState<CardState>("pending");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setRemaining(null);
        setState((s) => (s === "pending" ? "expired" : s));
        return;
      }
      const totalSec = Math.floor(ms / 1000);
      setRemaining(`${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  async function act(kind: "confirm" | "decline") {
    setState("executing");
    try {
      const res = await fetch(`/api/actions/${pendingActionId}/${kind}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (kind === "confirm") {
          setState("executed");
          setResultText(data.message ?? "Action completed.");
          toast.push(data.message ?? "Action completed.", "success");
        } else {
          setState("declined");
          setResultText("Action declined — nothing was changed.");
        }
      } else {
        const mapped = mapFailureToState(String(data.error ?? ""));
        setState(mapped.state);
        setResultText(mapped.text);
      }
    } catch {
      setState("failed");
      setResultText("Network error — please try again.");
    } finally {
      setConfirmOpen(false);
    }
  }

  const settled =
    state === "executed" ||
    state === "declined" ||
    state === "failed" ||
    state === "expired" ||
    state === "unauthorized" ||
    state === "stale";

  const settledVisual: Partial<Record<CardState, { tone: "success" | "danger" | "neutral"; icon: keyof typeof Icon }>> = {
    executed: { tone: "success", icon: "Check" },
    declined: { tone: "neutral", icon: "X" },
    expired: { tone: "neutral", icon: "Clock" },
  };

  // ── Settled banner ────────────────────────────────────────────────────────
  if (settled) {
    const visual = settledVisual[state];
    if (!visual) return null;
    const VIcon = Icon[visual.icon];
    const isError = state === "failed" || state === "unauthorized";
    return (
      <div
        role="status"
        className={`animate-message-in flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${
          visual.tone === "success"
            ? "border-success/25 bg-success-soft"
            : visual.tone === "danger" || isError
              ? "border-danger/25 bg-danger-soft"
              : "border-line bg-surface-inset"
        }`}
      >
        <VIcon size={15} className={`mt-0.5 shrink-0 ${visual.tone === "success" ? "text-success" : isError ? "text-danger" : "text-ink-3"}`} />
        <div className="text-[13px]">
          <p className={`font-semibold ${visual.tone === "success" ? "text-success" : isError ? "text-danger" : "text-ink-2"}`}>
            {state === "executed" && "Done"}
            {state === "declined" && "Declined"}
            {state === "expired" && "Expired"}
            {(state === "failed" || state === "unauthorized" || state === "stale") && "Couldn't complete"}
          </p>
          <p className="mt-0.5 text-ink-2">{resultText}</p>
        </div>
      </div>
    );
  }

  // ── Pending / executing card ──────────────────────────────────────────────
  return (
    <>
      <div className="animate-message-in overflow-hidden rounded-xl border border-brand/30 bg-surface shadow-card">
        {/* Header strip */}
        <div className="flex items-center gap-2 border-b border-brand/20 bg-brand-soft/60 px-4 py-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand text-on-brand">
            <Icon.Shield size={11} />
          </span>
          <span className="flex-1 text-[13px] font-semibold text-brand-ink">{copy.title}</span>
          {state === "executing" ? (
            <Badge tone="brand">Processing…</Badge>
          ) : remaining !== null && expiresAt ? (
            <Badge tone="warning">
              <Icon.Clock size={10} />
              Expires in {remaining}
            </Badge>
          ) : (
            <Badge tone="brand" dot>Waiting for confirmation</Badge>
          )}
        </div>

        <div className="px-4 py-3.5">
          <p className="text-sm font-medium text-ink">{summary}</p>
          {requester && (
            <p className="mt-1 text-[12px] text-ink-3">Requested by {requester}</p>
          )}
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{copy.consequence}</p>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => void act("decline")}
              disabled={state === "executing"}
            >
              Decline
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={state === "executing"}
              loading={false}
            >
              {copy.verb}
            </Button>
          </div>
        </div>
      </div>

      {/* Explicit confirmation sheet */}
      <Sheet
        open={confirmOpen}
        onClose={() => state === "pending" && setConfirmOpen(false)}
        title={copy.title}
        description="Review carefully — this changes real data."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={state === "executing"}
            >
              Keep waiting
            </Button>
            <Button
              variant={actionType === "cancel_order" ? "danger" : "primary"}
              loading={state === "executing"}
              onClick={() => void act("confirm")}
            >
              Yes — {copy.verb.toLowerCase()}
            </Button>
          </div>
        }
      >
        <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line text-sm">
          <div className="flex gap-3 px-4 py-2.5">
            <dt className="w-24 shrink-0 text-ink-3">Action</dt>
            <dd className="font-medium text-ink">{summary}</dd>
          </div>
          {requester && (
            <div className="flex gap-3 px-4 py-2.5">
              <dt className="w-24 shrink-0 text-ink-3">Requested by</dt>
              <dd className="text-ink-2">{requester}</dd>
            </div>
          )}
          {expiresAt && (
            <div className="flex gap-3 px-4 py-2.5">
              <dt className="w-24 shrink-0 text-ink-3">Expires</dt>
              <dd className="text-ink-2">{new Date(expiresAt).toLocaleTimeString()}</dd>
            </div>
          )}
        </dl>
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning">
          <Icon.Alert size={14} className="mt-0.5 shrink-0" />
          {copy.consequence} This will be recorded in the audit log.
        </p>
      </Sheet>
    </>
  );
}
