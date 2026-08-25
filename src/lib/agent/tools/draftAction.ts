import { z } from "zod";
import { AgentContext } from "@/lib/types";
import { pendingActionsRepo } from "@/lib/data/repositories/pendingActionsRepo";
import { ordersRepo } from "@/lib/data/repositories/ordersRepo";
import { ticketsRepo } from "@/lib/data/repositories/ticketsRepo";

export const draftActionSchema = z.object({
  type: z.enum(["cancel_order", "update_ticket", "create_escalation", "create_follow_up_task"])
    .describe("The type of action to draft."),
  params: z.record(z.string(), z.any())
    .describe("The payload for the action. For cancel_order: { orderId }. For update_ticket: { ticketId, status, priority, internalNote }."),
  rationale: z.string().describe("The reason for drafting this action. Shown to the user."),
});

export type DraftActionArgs = z.infer<typeof draftActionSchema>;

export async function draftAction(ctx: AgentContext, args: DraftActionArgs): Promise<string> {
  let displaySummary = "";
  let targetAccountId: string | null = null;
  let resourceType: string | null = null;
  let resourceId: string | null = null;

  try {
    switch (args.type) {
      case "cancel_order": {
        const orderId = args.params.orderId;
        if (!orderId) throw new Error("Missing orderId in params");
        
        // Semantic validation: verify the order exists and is accessible
        const order = await ordersRepo.getByOrderId(ctx, orderId);
        if (!order) throw new Error(`Order ${orderId} not found or access denied.`);
        if (order.status === "cancelled") throw new Error(`Order ${orderId} is already cancelled.`);
        
        // Check authorization matrix (e.g. only northstar can cancel orders, or specific roles)
        // This is handled by RLS on insert in theory, but we can do an explicit check here if needed.
        // Actually, the matrix is applied at execution time. The draft can be created.
        
        targetAccountId = order.accountId;
        resourceType = "order";
        resourceId = order.id;
        displaySummary = `Cancel Order ${orderId}`;
        break;
      }
      case "update_ticket": {
        const ticketId = args.params.ticketId;
        if (!ticketId) throw new Error("Missing ticketId in params");
        
        const ticket = await ticketsRepo.getByTicketId(ctx, ticketId);
        if (!ticket) throw new Error(`Ticket ${ticketId} not found or access denied.`);
        
        targetAccountId = ticket.accountId;
        resourceType = "ticket";
        resourceId = ticket.id;
        displaySummary = `Update Ticket ${ticketId}: ${args.params.status ? "Status=" + args.params.status : "Add Note"}`;
        break;
      }
      case "create_escalation": {
        const ticketId = args.params.ticketId;
        if (!ticketId) throw new Error("Missing ticketId in params");
        
        const ticket = await ticketsRepo.getByTicketId(ctx, ticketId);
        if (!ticket) throw new Error(`Ticket ${ticketId} not found or access denied.`);
        
        targetAccountId = ticket.accountId;
        resourceType = "ticket";
        resourceId = ticket.id;
        displaySummary = `Escalate Ticket ${ticketId}`;
        break;
      }
      case "create_follow_up_task": {
        // ... handled generically for now
        displaySummary = `Create follow up task: ${args.rationale}`;
        break;
      }
      default:
        throw new Error(`Unsupported action type: ${args.type}`);
    }

    // Persist the draft
    const action = await pendingActionsRepo.create(ctx, {
      actionType: args.type,
      payload: args.params,
      displaySummary,
      targetAccountId,
      resourceType,
      resourceId,
    });

    return JSON.stringify({
      status: "awaiting_confirmation",
      pendingActionId: action.id,
      summary: displaySummary,
      message: `Action drafted successfully. Present this pendingActionId to the user for confirmation: ${action.id}`,
    });

  } catch (error: any) {
    return JSON.stringify({ error: `Failed to draft action: ${error.message}` });
  }
}
