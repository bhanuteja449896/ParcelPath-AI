import { z } from "zod";
import { AgentContext } from "@/lib/types";
import { ordersRepo } from "@/lib/data/repositories/ordersRepo";
import { ticketsRepo } from "@/lib/data/repositories/ticketsRepo";
import { accountsRepo } from "@/lib/data/repositories/accountsRepo";

export const dataLookupSchema = z.object({
  entity: z.enum(["order", "ticket", "account", "orders", "tickets"]).describe("The type of entity to look up."),
  id: z.string().optional().describe("The business ID of the entity (e.g., ORD-1001 or TKT-2001). Required for singular entities."),
});

export type DataLookupArgs = z.infer<typeof dataLookupSchema>;

export async function dataLookup(ctx: AgentContext, args: DataLookupArgs): Promise<string> {
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
        // Without filters in v1, just return the recent orders for the user's account
        // Internal users must specify an account code somehow? Wait, they can just use "account" first, but let's assume they only look up by order id mostly.
        if (!ctx.accountId) return JSON.stringify({ error: "Must specify an accountId (not supported in 'orders' yet for internal users without a specific order ID)." });
        
        const orders = await ordersRepo.listByAccount(ctx, ctx.accountId);
        return JSON.stringify({ result: orders });
      }

      case "tickets": {
        if (!ctx.accountId) return JSON.stringify({ error: "Must specify an accountId." });
        
        const tickets = await ticketsRepo.listByAccount(ctx, ctx.accountId);
        return JSON.stringify({ result: tickets });
      }
      
      default:
        return JSON.stringify({ error: `Unknown entity type: ${args.entity}` });
    }
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}
