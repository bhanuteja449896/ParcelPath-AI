import { z } from "zod";
import { AgentContext } from "@/lib/types";
import { pendingActionsRepo } from "@/lib/data/repositories/pendingActionsRepo";
import { ordersRepo } from "@/lib/data/repositories/ordersRepo";
import { ticketsRepo } from "@/lib/data/repositories/ticketsRepo";

export const draftActionSchema = z.object({
  type: z.enum(["cancel_order", "update_ticket", "create_escalation", "create_follow_up_task"])
    .describe("The type of action to draft."),
  params: z.object({
    orderId:       z.string().nullable().describe("For cancel_order: the order business ID (e.g. ORD-1001). Null otherwise."),
    ticketId:      z.string().nullable().describe("For update_ticket / create_escalation: the ticket business ID (e.g. TKT-2001). Null otherwise."),
    status:        z.string().nullable().describe("For update_ticket: the new status value. Null if not changing status."),
    priority:      z.string().nullable().describe("For update_ticket: the new priority. Null if not changing priority."),
    internalNote:  z.string().nullable().describe("For update_ticket: an internal note to add. Null if not adding a note."),
  }).describe("The payload for the action. Populate only the fields relevant to the action type, set others to null."),
  rationale: z.string().describe("The reason for drafting this action. Shown to the user for confirmation."),
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
        
        const order = await ordersRepo.getByOrderId(ctx, orderId);
        if (!order) throw new Error(`Order ${orderId} not found or access denied.`);
        if (order.status === "cancelled") throw new Error(`Order ${orderId} is already cancelled.`);
        
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
