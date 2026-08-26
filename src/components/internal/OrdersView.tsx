"use client";
/**
 * OrdersView — active order board across accounts (support context).
 * Data from /api/internal/orders; RLS scopes everything server-side.
 */
import { useEffect, useMemo, useState } from "react";
import type { OrderDetail } from "@/lib/data/repositories/ordersRepo";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { OrderStatusBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function OrdersView({ onAskAI }: { onAskAI: (text: string) => void }) {
  const [orders, setOrders] = useState<OrderDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  async function load(reset = true) {
    if (reset) {
      setOrders(null);
      setError(null);
    }
    try {
      const res = await fetch("/api/internal/orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load orders.");
      setOrders(data.orders ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load orders.");
      setOrders([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/orders")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load orders.");
        if (!cancelled) setOrders(data.orders ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Could not load orders.");
        setOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    let list = orders ?? [];
    if (activeOnly) {
      list = list.filter((o) => ["pending", "picked_up", "in_transit", "exception"].includes(o.status));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.orderId.toLowerCase().includes(q) ||
          o.carrier.toLowerCase().includes(q) ||
          (o.accountName ?? "").toLowerCase().includes(q) ||
          (o.destination ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, query, activeOnly]);

  if (error && orders === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <ErrorState title="We couldn't load orders." body={error} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Orders</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">
              Shipments across all accounts. Exceptions and at-risk deliveries surface first.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={orders === null}>
            <Icon.Refresh size={13} />
            Refresh
          </Button>
        </div>

        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-2">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Active only
          </label>
          <label className="relative block w-full lg:w-64">
            <span className="sr-only">Search orders</span>
            <Icon.Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search id, carrier, account…"
              className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-brand/50"
            />
          </label>
        </div>

        {orders === null ? (
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="mb-2 h-10 w-full last:mb-0" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface shadow-card">
            <EmptyState icon="Package" title="No orders match" body="Adjust the search or toggle 'Active only'." />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:block">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-surface-inset text-[11.5px] uppercase tracking-wider text-ink-3">
                    <th scope="col" className="px-4 py-2.5 font-medium">Order</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Account</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Carrier</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Lane</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-4 py-2.5 font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((o) => (
                    <tr key={o.orderId} className="transition-colors hover:bg-surface-inset/60">
                      <td className="px-4 py-3 font-mono text-[12px] font-semibold text-brand-ink">{o.orderId}</td>
                      <td className="px-4 py-3 text-ink-2">{o.accountName}</td>
                      <td className="px-4 py-3 text-ink-2">{o.carrier}</td>
                      <td className="max-w-44 truncate px-4 py-3 text-ink-3" title={`${o.origin ?? "?"} → ${o.destination ?? "?"}`}>
                        {fmtDate(o.pickupAt ? String(o.pickupAt) : null)} · {o.origin ?? "?"} → {o.destination ?? "?"}
                      </td>
                      <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          onClick={() => onAskAI(`Check order ${o.orderId}: what is its status and promised delivery?`)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-brand-ink transition-colors hover:bg-brand-soft"
                        >
                          <Icon.Sparkle size={12} />
                          Ask AI
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="flex flex-col gap-2 md:hidden">
              {visible.map((o) => (
                <li key={o.orderId} className="rounded-xl border border-line bg-surface p-3.5 shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] font-semibold text-brand-ink">{o.orderId}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-2">
                    {o.carrier} · {o.origin ?? "?"} → {o.destination ?? "?"}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Badge>{o.accountName}</Badge>
                    <button
                      onClick={() => onAskAI(`Check order ${o.orderId}: what is its status and promised delivery?`)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-brand-ink"
                    >
                      <Icon.Sparkle size={12} />
                      Ask AI
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
