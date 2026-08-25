import { AgentContext } from "@/lib/types";
import { withUserContext } from "../withUserContext";

export interface Ticket {
  id: string;
  ticketId: string;
  accountId: string;
  orderId: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  subject: string;
  description: string;
  resolutionNotes: string | null;
  resolutionIsHistorical: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SELECT_COLUMNS = `
  id,
  ticket_id AS "ticketId",
  account_id AS "accountId",
  order_id AS "orderId",
  status,
  priority,
  subject,
  description,
  resolution_notes AS "resolutionNotes",
  resolution_is_historical AS "resolutionIsHistorical",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export const ticketsRepo = {
  /**
   * Retrieves a single ticket by its business ID (e.g., TKT-2001).
   */
  async getByTicketId(ctx: AgentContext, ticketId: string): Promise<Ticket | null> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<any[]>`
        SELECT ${tx.unsafe(SELECT_COLUMNS)}
        FROM tickets
        WHERE ticket_id = ${ticketId}
      `;
      return rows.length ? (rows[0] as Ticket) : null;
    });
  },

  /**
   * Lists tickets for a specific account.
   */
  async listByAccount(ctx: AgentContext, accountId: string): Promise<Ticket[]> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<any[]>`
        SELECT ${tx.unsafe(SELECT_COLUMNS)}
        FROM tickets
        WHERE account_id = ${accountId}
        ORDER BY created_at DESC
      `;
      return rows as Ticket[];
    });
  },

  /**
   * Safely mutates a ticket's properties.
   */
  async updateTicket(
    ctx: AgentContext, 
    ticketId: string, 
    changes: { status?: Ticket['status'], priority?: Ticket['priority'], resolutionNotes?: string }
  ): Promise<boolean> {
    return await withUserContext(ctx, async (tx) => {
      // Build dynamic update query
      const updates: any = {};
      if (changes.status !== undefined) updates.status = changes.status;
      if (changes.priority !== undefined) updates.priority = changes.priority;
      if (changes.resolutionNotes !== undefined) updates.resolution_notes = changes.resolutionNotes;
      
      if (Object.keys(updates).length === 0) return true;

      const rows = await tx`
        UPDATE tickets
        SET ${tx(updates)}
        WHERE ticket_id = ${ticketId}
        RETURNING id
      `;
      return rows.length > 0;
    });
  }
};
