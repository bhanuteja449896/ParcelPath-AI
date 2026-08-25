import { AgentContext } from "@/lib/types";
import { withUserContext } from "../withUserContext";

export interface Account {
  id: string;
  code: string;
  displayName: string;
  planTier: string;
  createdAt: Date;
}

export const accountsRepo = {
  /**
   * Retrieves an account by its ID.
   */
  async getById(ctx: AgentContext, accountId: string): Promise<Account | null> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<any[]>`
        SELECT 
          id, 
          code, 
          display_name AS "displayName", 
          plan_tier AS "planTier", 
          created_at AS "createdAt"
        FROM accounts
        WHERE id = ${accountId}
      `;
      return rows.length ? (rows[0] as Account) : null;
    });
  },

  /**
   * Retrieves an account by its code (e.g. 'northstar_logistics').
   */
  async getByCode(ctx: AgentContext, code: string): Promise<Account | null> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<any[]>`
        SELECT 
          id, 
          code, 
          display_name AS "displayName", 
          plan_tier AS "planTier", 
          created_at AS "createdAt"
        FROM accounts
        WHERE code = ${code}
      `;
      return rows.length ? (rows[0] as Account) : null;
    });
  }
};
