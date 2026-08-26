import { AgentContext } from "@/lib/types";
import { withUserContext } from "../withUserContext";

export interface Ticket {
  id: string;
  ticketId: string;
  accountId: string;
  category: string;
  status: 'open' | 'pending' | 'escalated' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  description: string;
  historicalResolution: string | null;
  resolutionIsHistorical: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SELECT_COLUMNS = `
  ticket_id AS "ticketId",
  account_id AS "accountId",
  category,
  status,
  priority,
  subject,
  description,
  historical_resolution AS "historicalResolution",
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
   * Lists all tickets visible to the current user (used by support).
   */
  async listAll(ctx: AgentContext): Promise<Ticket[]> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<any[]>`
        SELECT ${tx.unsafe(SELECT_COLUMNS)}
        FROM tickets
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
    changes: { status?: Ticket['status'], priority?: Ticket['priority'] }
  ): Promise<boolean> {
    return await withUserContext(ctx, async (tx) => {
      // Build dynamic update query
      const updates: any = {};
      if (changes.status !== undefined) updates.status = changes.status;
      if (changes.priority !== undefined) updates.priority = changes.priority;
      
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
