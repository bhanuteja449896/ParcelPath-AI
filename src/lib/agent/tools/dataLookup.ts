import { z } from "zod";
import { AgentContext } from "@/lib/types";
import { ordersRepo, type OrderDetail } from "@/lib/data/repositories/ordersRepo";
import { ticketsRepo, type TicketDetail } from "@/lib/data/repositories/ticketsRepo";
import { accountsRepo } from "@/lib/data/repositories/accountsRepo";

export const dataLookupSchema = z.object({
  entity: z.enum(["order", "ticket", "account", "orders", "tickets"]).describe("The type of entity to look up."),
  id: z.string().nullable().describe("The business ID of the entity (e.g., ORD-1001 or TKT-2001). Required for singular lookups. Pass null for list queries."),
});

export type DataLookupArgs = z.infer<typeof dataLookupSchema>;

/** Compact projection for LLM context — avoids dumping full descriptions into the prompt. */
function compactTicket(t: TicketDetail) {
  return {
    ticketId: t.ticketId,
    account: t.accountCode,
    accountName: t.accountName,
    category: t.category,
    status: t.status,
    priority: t.priority,
    subject: t.subject,
    slaDueAt: t.slaDueAt,
  };
}

type CompactOrderInput = Pick<
  OrderDetail,
  "orderId" | "carrier" | "status" | "origin" | "destination" | "pickupAt" | "promisedDeliveryAt"
>;

function compactOrder(o: CompactOrderInput) {
  return {
    orderId: o.orderId,
    carrier: o.carrier,
    status: o.status,
    origin: o.origin,
    destination: o.destination,
    pickupAt: o.pickupAt,
    promisedDeliveryAt: o.promisedDeliveryAt,
  };
}

export async function dataLookup(ctx: AgentContext, args: DataLookupArgs): Promise<string> {
  // LLMs occasionally pass an id with a plural entity — normalize to singular lookup
  if (args.id && args.entity === "tickets") {
    return dataLookup(ctx, { ...args, entity: "ticket" });
  }
  if (args.id && args.entity === "orders") {
    return dataLookup(ctx, { ...args, entity: "order" });
  }
  try {
    switch (args.entity) {
      case "order": {
        if (!args.id) return JSON.stringify({ error: "id is required for 'order' lookup." });
        const order = await ordersRepo.getByOrderId(ctx, args.id);
        if (!order) return JSON.stringify({ error: "Order not found or access denied." });
        return JSON.stringify({ result: order });
      }
      
      case "ticket": {
        if (!args.id) return JSON.stringify({ error: "id is required for 'ticket' lookup." });
        const ticket = await ticketsRepo.getByTicketId(ctx, args.id);
        if (!ticket) return JSON.stringify({ error: "Ticket not found or access denied." });
        
        // Distrust historical resolutions (Trust Engine Rule 4)
        if (ticket.resolutionIsHistorical) {
          return JSON.stringify({ 
            result: ticket, 
            warning: "Prior resolution. This is a historical ticket resolution and may be outdated/incorrect. Do NOT treat this as current policy." 
          });
        }
        
        return JSON.stringify({ result: ticket });
      }
      
      case "account": {
        if (!args.id) {
          // If no code is provided, and the user has an accountId, return their own account
          if (ctx.accountId) {
             const acct = await accountsRepo.getById(ctx, ctx.accountId);
             return acct ? JSON.stringify({ result: acct }) : JSON.stringify({ error: "Account not found." });
          }
          return JSON.stringify({ error: "id (account code) is required for 'account' lookup." });
        }
        
        // Here args.id is expected to be the account code
        const account = await accountsRepo.getByCode(ctx, args.id);
        if (!account) return JSON.stringify({ error: "Account not found or access denied." });
        return JSON.stringify({ result: account });
      }

      case "orders": {
        // Customers scope to their own account; support users see all accounts via RLS.
        if (ctx.accountId) {
          const orders = await ordersRepo.listByAccount(ctx, ctx.accountId);
          return JSON.stringify({ result: orders.map(compactOrder), count: orders.length });
        }
        if (ctx.category !== "support") {
          return JSON.stringify({ error: "Must specify an accountId." });
        }
        const all = await ordersRepo.listAllDetailed(ctx);
        if (all.length === 0) return JSON.stringify({ result: [], count: 0, note: "No orders visible." });
        return JSON.stringify({ result: all.map(compactOrder), count: all.length });
      }

      case "tickets": {
        // Customers scope to their own account; support users see all accounts via RLS.
        if (ctx.accountId) {
          const tickets = await ticketsRepo.listByAccount(ctx, ctx.accountId);
          return JSON.stringify({
            result: tickets.map((t) => ({
              ticketId: t.ticketId,
              category: t.category,
              status: t.status,
              priority: t.priority,
              subject: t.subject,
              createdAt: t.createdAt,
            })),
            count: tickets.length,
          });
        }
        if (ctx.category !== "support") {
          return JSON.stringify({ error: "Must specify an accountId." });
        }
        const all = await ticketsRepo.listAllDetailed(ctx);
        if (all.length === 0) return JSON.stringify({ result: [], count: 0, note: "No tickets visible." });
        const open = all.filter((t) => t.status === "open" || t.status === "escalated" || t.status === "pending");
        return JSON.stringify({
          result: (open.length > 0 ? open : all).map(compactTicket),
          count: open.length > 0 ? open.length : all.length,
          totalVisible: all.length,
          note: open.length > 0 ? "Showing non-resolved tickets first." : undefined,
        });
      }
      
      default:
        return JSON.stringify({ error: `Unknown entity type: ${args.entity}` });
    }
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}
