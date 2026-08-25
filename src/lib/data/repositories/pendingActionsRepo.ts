import { AgentContext } from "@/lib/types";
import { withUserContext } from "../withUserContext";

export interface PendingAction {
  id: string;
  userId: string;
  actionType: string;
  payload: any;
  displaySummary: string;
  targetAccountId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  status: 'awaiting_confirmation' | 'executed' | 'expired' | 'cancelled' | 'failed';
  expiresAt: Date;
  createdAt: Date;
}

const SELECT_COLUMNS = `
  id,
  user_id AS "userId",
  action_type AS "actionType",
  payload,
  display_summary AS "displaySummary",
  target_account_id AS "targetAccountId",
  resource_type AS "resourceType",
  resource_id AS "resourceId",
  status,
  expires_at AS "expiresAt",
  created_at AS "createdAt"
`;

export const pendingActionsRepo = {
  /**
   * Creates a drafted action that will live for a short TTL (e.g., 15 mins).
   */
  async create(
    ctx: AgentContext,
    action: {
      actionType: string;
      payload: any;
      displaySummary: string;
      targetAccountId?: string | null;
      resourceType?: string | null;
      resourceId?: string | null;
      ttlMinutes?: number;
    }
  ): Promise<PendingAction> {
    const ttl = action.ttlMinutes ?? 15;
    
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<any[]>`
        INSERT INTO pending_actions (
          user_id, action_type, payload, display_summary, 
          target_account_id, resource_type, resource_id, expires_at
        ) VALUES (
          ${ctx.userId}, 
          ${action.actionType}, 
          ${tx.json(action.payload)}, 
          ${action.displaySummary}, 
          ${action.targetAccountId ?? null}, 
          ${action.resourceType ?? null}, 
          ${action.resourceId ?? null}, 
          now() + (${ttl} || ' minutes')::interval
        )
        RETURNING ${tx.unsafe(SELECT_COLUMNS)}
      `;
      return rows[0] as PendingAction;
    });
  },

  /**
   * Retrieves a pending action. 
   * RLS automatically scopes this to the action creator (or ops_manager).
   */
  async getOwn(ctx: AgentContext, actionId: string): Promise<PendingAction | null> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<any[]>`
        SELECT ${tx.unsafe(SELECT_COLUMNS)}
        FROM pending_actions
        WHERE id = ${actionId}
      `;
      return rows.length ? (rows[0] as PendingAction) : null;
    });
  },

  /**
   * Lists all pending actions.
   * RLS automatically restricts this to ops_manager role.
   */
  async listForOps(ctx: AgentContext): Promise<PendingAction[]> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<any[]>`
        SELECT ${tx.unsafe(SELECT_COLUMNS)}
        FROM pending_actions
        WHERE status = 'awaiting_confirmation'
        ORDER BY created_at DESC
      `;
      return rows as PendingAction[];
    });
  },

  /**
   * Updates an action to be executed.
   */
  async markExecuted(ctx: AgentContext, actionId: string, resultPayload?: any): Promise<boolean> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx`
        UPDATE pending_actions
        SET 
          status = 'executed', 
          executed_at = now(), 
          executed_by = ${ctx.userId},
          result = ${resultPayload ? tx.json(resultPayload) : null}
        WHERE id = ${actionId} 
          AND status = 'awaiting_confirmation'
          AND expires_at > now()
        RETURNING id
      `;
      return rows.length > 0;
    });
  },

  /**
   * Transitions awaiting_confirmation actions that have timed out into 'expired'.
   * Usually called via a cron/sweeper mechanism without an explicit user context,
   * so it must be run with a broad context or admin privileges.
   */
  async sweepExpired(ctx: AgentContext): Promise<number> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx`
        UPDATE pending_actions
        SET status = 'expired'
        WHERE status = 'awaiting_confirmation'
          AND expires_at <= now()
        RETURNING id
      `;
      return rows.length;
    });
  }
};
